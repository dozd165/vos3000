
# routing_gateway_management_backend.py
# Backend-only helpers for Routing Gateway management (no Streamlit/UI dependencies).
from __future__ import annotations

import logging
import concurrent.futures
from typing import Dict, List, Optional, Set, Tuple
from api_client import call_api
import concurrent.futures
import config
from api_client import call_api  # Must return (data, error_message)
from mapping_gateway_management import (
    identify_mg_for_cleanup_backend,
    get_all_mapping_gateways,
)
from utils import (
    parse_vos_rewrite_rules,
    format_rewrite_rules_for_vos,
    is_six_digit_virtual_number_candidate,
    generate_search_variants,
    generate_object_hash,
    transform_real_number_for_vos_storage,
)


Json = Dict[str, object]


# ------------------------------
# Internal helpers
# ------------------------------
def _extract_server(server_info: dict) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Validate and extract base_url & server_name from server_info.
    Returns (base_url, server_name, error).
    """
    if not isinstance(server_info, dict):
        return None, None, "Error: server_info must be a dict."
    base_url = server_info.get("url")
    if not base_url:
        return None, None, "Error: Server URL not provided."
    server_name = server_info.get("name", base_url)
    return base_url, server_name, None


# ------------------------------
# Routing Gateway Data Retrieval
# ------------------------------
def get_all_routing_gateways(server_info: dict, filter_text: str = "") -> Tuple[Optional[List[dict]], Optional[str]]:
    base_url, server_name, err = _extract_server(server_info)
    if err:
        return None, err

    api_data, error_msg_api = call_api(base_url, "GetGatewayRouting", {}, server_name_for_log=server_name)

    if error_msg_api:
        return None, f"Could not retrieve Routing Gateway list from server {server_name}: {error_msg_api}"
    if api_data is None:
        return None, f"Could not retrieve Routing Gateway list from server {server_name} (no data and no specific error)."

    routings_info_list = api_data.get("infoGatewayRoutings", []) or []
    if not routings_info_list:
        return [], None

    if filter_text:
        filtered_routings = [
            rg for rg in routings_info_list if filter_text.lower() in (rg.get("name") or "").lower()
        ]
        if not filtered_routings:
            return [], None
        return sorted(filtered_routings, key=lambda x: x.get("name", "Unnamed_RG")), None

    return sorted(routings_info_list, key=lambda x: x.get("name", "Unnamed_RG")), None


def get_routing_gateway_details(server_info: dict, rg_name: str) -> Tuple[Optional[dict], Optional[str]]:
    if not rg_name:
        return None, "Error: Routing Gateway name cannot be empty."
    base_url, server_name, err = _extract_server(server_info)
    if err:
        return None, err

    api_data, error_msg_api = call_api(base_url, "GetGatewayRouting", {}, server_name_for_log=server_name)
    if error_msg_api:
        return None, f"API call failed while fetching details for RG '{rg_name}' from server {server_name}: {error_msg_api}"

    for rg_info_item in api_data.get("infoGatewayRoutings", []) or []:
        if rg_info_item.get("name") == rg_name:
            return rg_info_item, None

    return None, f"Routing Gateway '{rg_name}' not found on server {server_name}."


# ------------------------------
# Routing Gateway Modification
# ------------------------------
def update_routing_gateway(
    server_info: dict,
    rg_name_param: str,
    payload_update_data: dict,
    initial_hash: Optional[str] = None,
) -> Tuple[bool, Optional[str]]:
    """
    Update an RG via ModifyGatewayRouting with optimistic concurrency (optional).
    """
    base_url, server_name, err = _extract_server(server_info)
    if err:
        return False, err

    effective_rg_name = (payload_update_data or {}).get("name") or rg_name_param
    if not effective_rg_name:
        return False, "Error: Routing Gateway name cannot be empty for update."
    if not payload_update_data:
        return False, "Error: Update payload cannot be empty."

    # Conflict check
    if initial_hash:
        latest_data, error_fetch = get_routing_gateway_details(server_info, rg_name_param)
        if error_fetch or not latest_data:
            return False, f"Could not re-fetch RG for conflict check: {error_fetch or 'no data'}"
        latest_hash = generate_object_hash(latest_data)
        if initial_hash != latest_hash:
            return False, "CONFLICT_ERROR: The data has been modified by another user. Please reload and try again."

    _, error_msg_api = call_api(base_url, "ModifyGatewayRouting", payload_update_data, server_name_for_log=server_name)
    if error_msg_api:
        return False, f"Failed to update Routing Gateway '{effective_rg_name}' on {server_name}: {error_msg_api}"
    return True, f"Routing Gateway '{effective_rg_name}' on server {server_name} updated successfully."


# ------------------------------
# Virtual Number + Rewrite Rule Management
# ------------------------------
def get_all_virtual_number_definitions_backend() -> Tuple[Dict[str, List[dict]], Optional[str]]:
    """
    Aggregate all VN definitions across servers (from RG.rewriteRulesInCaller).
    Returns (map: virtual_key -> list[definition], error).
    """
    all_virtuals_map: Dict[str, List[dict]] = {}
    error_messages: List[str] = []
    active_servers_list = config.VOS_SERVERS

    for server_info_item in active_servers_list:
        server_name = server_info_item["name"]
        base_url = server_info_item["url"]

        response_rg_data, error_rg_api = call_api(base_url, "GetGatewayRouting", {}, server_name_for_log=server_name)
        if error_rg_api:
            error_messages.append(f"Failed to fetch RG data from {server_name}: {error_rg_api}")
            continue
        if not response_rg_data or not response_rg_data.get("infoGatewayRoutings"):
            continue

        for rg_data_item in response_rg_data.get("infoGatewayRoutings", []) or []:
            rg_name_item = rg_data_item.get("name", f"Unnamed_RG_on_{server_name}")
            rewrite_rules_str_item = rg_data_item.get("rewriteRulesInCaller", "") or ""
            parsed_rules_item = parse_vos_rewrite_rules(rewrite_rules_str_item)

            for virtual_key, real_list_values in parsed_rules_item.items():
                is_hetso = real_list_values == ["hetso"]
                reals = [] if is_hetso or not real_list_values else real_list_values
                definition_info = {
                    "server_name": server_name,
                    "server_url": base_url,
                    "rg_name": rg_name_item,
                    "reals": reals,
                    "is_hetso": is_hetso,
                    "real_numbers_count": 0 if is_hetso else len(reals),
                    "raw_rg_info": rg_data_item,
                }
                all_virtuals_map.setdefault(virtual_key, []).append(definition_info)

    final_error = "; ".join(error_messages) if error_messages else None
    return all_virtuals_map, final_error


def find_definitions_for_virtual_keys_backend(virtual_keys_to_find: List[str]) -> Tuple[List[dict], Optional[str]]:
    """
    Lookup VN definitions across servers for a given list of virtual keys.
    """
    if not virtual_keys_to_find:
        return [], "Virtual number key list to find cannot be empty."

    definitions_list: List[dict] = []
    error_messages: List[str] = []
    keys_set = set(virtual_keys_to_find)
    active_servers_list = config.VOS_SERVERS

    for server_info_item in active_servers_list:
        server_name = server_info_item["name"]
        base_url = server_info_item["url"]
        response_rg_data, error_rg_api = call_api(base_url, "GetGatewayRouting", {}, server_name_for_log=server_name)

        if error_rg_api:
            error_messages.append(f"Failed to fetch RG data from {server_name}: {error_rg_api}")
            continue
        if not response_rg_data or not response_rg_data.get("infoGatewayRoutings"):
            continue

        for rg_data_item in response_rg_data.get("infoGatewayRoutings", []) or []:
            rg_name = rg_data_item.get("name", f"Unnamed_RG_on_{server_name}")
            rewrite_rules_str = rg_data_item.get("rewriteRulesInCaller", "") or ""
            if not rewrite_rules_str:
                continue

            parsed_rules = parse_vos_rewrite_rules(rewrite_rules_str)
            found_keys = keys_set.intersection(parsed_rules.keys())

            for key in found_keys:
                reals = parsed_rules[key]
                is_hetso = reals == ["hetso"]
                reals_count = 0 if is_hetso or not reals else len(reals)
                definitions_list.append({
                    "virtual_key": key,
                    "server_name": server_name,
                    "server_url": base_url,
                    "rg_name": rg_name,
                    "reals": reals,
                    "real_numbers_count": reals_count,
                    "is_hetso": is_hetso,
                    "raw_rg_info": rg_data_item,
                })

    final_error = "; ".join(error_messages) if error_messages else None
    return definitions_list, final_error


def add_real_numbers_to_rule_backend(
    server_info: dict,
    rg_name: str,
    virtual_key: str,
    new_real_numbers_to_add: List[str],
    initial_hash: Optional[str] = None,
) -> Tuple[bool, str]:
    """
    Add real numbers to an existing rewrite rule (no overwrite). De-duplicates and preserves order.
    Applies transform_real_number_for_vos_storage before persisting.
    Supports optional optimistic concurrency via initial_hash.
    """
    if not new_real_numbers_to_add:
        return False, "The list of real numbers to add cannot be empty."

    # Step 1: get current RG details
    rg_details, error = get_routing_gateway_details(server_info, rg_name)
    if error or not rg_details:
        return False, f"Could not retrieve details for RG '{rg_name}'. Error: {error or 'no data'}"

    # Step 2: parse existing rules
    rules_dict = parse_vos_rewrite_rules(rg_details.get("rewriteRulesInCaller", "") or "")

    # Step 3: prepare current list
    current_reals = rules_dict.get(virtual_key, [])
    if current_reals == ["hetso"]:
        current_reals = []

    # Step 4: normalize new inputs
    normalized_new = [transform_real_number_for_vos_storage(x) for x in new_real_numbers_to_add if x and x.strip()]
    combined_reals = current_reals + normalized_new

    # Step 5: de-duplicate with order
    seen: Set[str] = set()
    unique_reals = [x for x in combined_reals if not (x in seen or seen.add(x))]

    # Step 6: rebuild rules and payload
    rules_dict[virtual_key] = unique_reals
    payload = dict(rg_details)
    payload["rewriteRulesInCaller"] = format_rewrite_rules_for_vos(rules_dict)

    # Step 7: optimistic concurrency (hash from original rg_details if not provided)
    if not initial_hash:
        initial_hash = generate_object_hash(rg_details)

    ok, msg = update_routing_gateway(server_info, rg_name, payload, initial_hash=initial_hash)
    if ok:
        return True, msg or f"Successfully added numbers to rule '{virtual_key}' in RG '{rg_name}'. New total: {len(unique_reals)}."
    return False, msg or f"Failed to update rule for '{virtual_key}' in RG '{rg_name}'."


def find_rewrite_rule_keys_globally_backend(search_key_term_str: str) -> Tuple[List[dict], Optional[str]]:
    if not search_key_term_str:
        return [], "Search term for rewrite rule keys cannot be empty."

    found_definitions: List[dict] = []
    error_messages: List[str] = []
    active_servers_list = config.VOS_SERVERS

    for server_info_item in active_servers_list:
        server_name = server_info_item["name"]
        base_url = server_info_item["url"]
        response_rg_data, error_rg_api = call_api(base_url, "GetGatewayRouting", {}, server_name_for_log=server_name)

        if error_rg_api:
            error_messages.append(f"Failed to fetch RG data from {server_name} for key search '{search_key_term_str}': {error_rg_api}")
            continue
        if not response_rg_data or not response_rg_data.get("infoGatewayRoutings"):
            continue

        for rg_data_item in response_rg_data.get("infoGatewayRoutings", []) or []:
            rg_name = rg_data_item.get("name", f"Unnamed_RG_on_{server_name}")
            rewrite_rules_str = rg_data_item.get("rewriteRulesInCaller", "") or ""
            parsed_rules = parse_vos_rewrite_rules(rewrite_rules_str)

            for current_key, reals in parsed_rules.items():
                if search_key_term_str.lower() in current_key.lower():
                    is_hetso = reals == ["hetso"]
                    reals_count = 0 if is_hetso or not reals else len(reals)
                    found_definitions.append({
                        "found_key": current_key,
                        "server_name": server_name,
                        "server_url": base_url,
                        "rg_name": rg_name,
                        "reals": reals,
                        "real_numbers_count": reals_count,
                        "is_hetso": is_hetso,
                        "raw_rg_info": rg_data_item,
                    })
    final_error = "; ".join(error_messages) if error_messages else None
    return found_definitions, final_error


# ------------------------------
# Cleanup Support (Multi-Server)
# ------------------------------
def fetch_routings_for_server_backend(server_url: str, server_name: str) -> Tuple[Optional[List[dict]], Optional[str]]:
    api_data, error_msg = call_api(server_url, "GetGatewayRouting", {}, server_name_for_log=server_name)
    if error_msg:
        return None, error_msg
    if not api_data:
        return None, "No data returned from API for GetGatewayRouting."
    return api_data.get("infoGatewayRoutings", []) or [], None


def identify_rgs_for_cleanup_backend(server_url: str, server_name: str, numbers_to_check_set: Set[str]) -> Tuple[Optional[List[dict]], Optional[str]]:
    identified: List[dict] = []
    all_routings, error_fetch = fetch_routings_for_server_backend(server_url, server_name)

    if error_fetch:
        return None, f"Could not fetch RGs for cleanup from {server_name}: {error_fetch}"
    if all_routings is None:
        return None, f"Received no RG list from {server_name} for cleanup."
    if not all_routings:
        return [], None

    for rg in all_routings:
        rg_name = rg.get("name", f"Unnamed_RG_Cleanup_{server_name}")
        rg_name_lower = rg_name.lower()
        is_to_rg = ("to" in rg_name_lower or "to-" in rg_name_lower or "to_" in rg_name_lower)

        callin_caller_str = rg.get("callinCallerPrefixes", "") or ""
        caller_list = [p.strip() for p in callin_caller_str.split(",") if p.strip()]
        common_in_caller = sorted(list(set(caller_list) & numbers_to_check_set))

        callin_callee_str = rg.get("callinCalleePrefixes", "") or ""
        callee_list = [p.strip() for p in callin_callee_str.split(",") if p.strip()]
        common_in_callee = sorted(list(set(callee_list) & numbers_to_check_set)) if is_to_rg else []

        rewrite_str = rg.get("rewriteRulesInCaller", "") or ""
        parsed_rules = parse_vos_rewrite_rules(rewrite_str)

        common_virtual_keys = sorted([
            vk for vk in parsed_rules if vk in numbers_to_check_set and is_six_digit_virtual_number_candidate(vk)
        ])

        common_real_values_map: Dict[str, List[str]] = {}
        for vk_map, rv_list_map in parsed_rules.items():
            actual_reals = [r for r in rv_list_map if r.lower() != "hetso"]
            common_rv = sorted(list(set(actual_reals) & numbers_to_check_set))
            if common_rv:
                common_real_values_map[vk_map] = common_rv

        if common_in_caller or common_in_callee or common_virtual_keys or bool(common_real_values_map):
            identified.append({
                "type": "RG",
                "server_url": server_url,
                "server_name": server_name,
                "name": rg_name,
                "is_to_rg": is_to_rg,
                "original_callin_caller_prefixes_list": caller_list,
                "common_in_callin_caller": common_in_caller,
                "original_callin_callee_prefixes_list": callee_list,
                "common_in_callin_callee": common_in_callee,
                "original_rewrite_str": rewrite_str,
                "original_rewrite_parsed": parsed_rules,
                "common_virtual_keys_to_delete": common_virtual_keys,
                "common_real_values_to_delete_map": common_real_values_map,
                "raw_rg_info": rg,
            })
    return identified, None


def apply_rg_update_for_cleanup_backend(server_url: str, server_name: str, rg_name: str, updated_rg_data_payload: dict) -> Tuple[bool, str]:
    _, error_msg = call_api(server_url, "ModifyGatewayRouting", updated_rg_data_payload, server_name_for_log=server_name)
    if error_msg:
        return False, f"Error updating Routing Gateway '{rg_name}' on {server_name} for cleanup: {error_msg}"
    new_prefixes_count = len([p for p in (updated_rg_data_payload.get('callinCallerPrefixes') or '').split(',') if p.strip()])
    return True, f"Routing Gateway '{rg_name}' on {server_name} updated for cleanup. New caller prefix count: {new_prefixes_count}."


# ------------------------------
# Linked Customers via MG (Backend only)
# ------------------------------
def find_customers_linked_to_virtual_number_backend(virtual_number_key_str: str) -> Tuple[Optional[List[dict]], Optional[str]]:
    if not virtual_number_key_str:
        return None, "Virtual number key cannot be empty."

    linked_customers: List[dict] = []
    processed_pairs: Set[Tuple[str, str]] = set()  # (account, server_url)
    error_messages: List[str] = []
    active_servers_list = config.VOS_SERVERS

    for server_info_mg in active_servers_list:
        server_url_mg = server_info_mg["url"]
        server_name_mg = server_info_mg["name"]

        mg_list_api_data, mg_list_error = call_api(server_url_mg, "GetGatewayMapping", {}, timeout=20, server_name_for_log=server_name_mg)
        if mg_list_error:
            error_messages.append(f"Could not fetch MGs from {server_name_mg} for VN link check: {mg_list_error}")
            continue
        if not mg_list_api_data or not mg_list_api_data.get("infoGatewayMappings"):
            continue

        for mg_item in mg_list_api_data.get("infoGatewayMappings", []) or []:
            prefixes_str = mg_item.get("calloutCallerPrefixes", "") or ""
            if virtual_number_key_str in {p.strip() for p in prefixes_str.split(",") if p.strip()}:

                mg_account = mg_item.get("account")
                mg_account_name = mg_item.get("accountName")

                if not (mg_account and mg_account_name):
                    continue

                pair_key = (mg_account, server_url_mg)
                if pair_key in processed_pairs:
                    continue
                processed_pairs.add(pair_key)

                try:
                    # late import to avoid circular deps
                    from customer_management import get_raw_customer_details
                    customer_raw, cust_err = get_raw_customer_details(server_url_mg, server_name_mg, mg_account)
                except Exception as import_exc:  # pragma: no cover
                    error_messages.append(f"Critical: Could not import customer_management_backend for VN link check: {import_exc}")
                    continue

                if cust_err:
                    error_messages.append(f"Error fetching details for potential customer {mg_account} on {server_name_mg} (for VN link): {cust_err}")
                    continue

                if customer_raw and str(customer_raw.get("name", "")).lower() == str(mg_account_name).lower():
                    linked_customers.append({
                        "account_id": customer_raw.get("account"),
                        "customer_name_on_vos": customer_raw.get("name"),
                        "customer_name_in_mg": mg_account_name,
                        "server_name": server_name_mg,
                        "server_url": server_url_mg,
                        "linked_via_mg_name": mg_item.get("name"),
                    })

    final_error = "; ".join(error_messages) if error_messages else None
    if not linked_customers and final_error:
        return None, final_error
    return linked_customers, final_error


def get_vn_status_in_specific_rg(server_info: dict, rg_name: str, virtual_number: str) -> Tuple[Optional[dict], Optional[str]]:
    """
    Optimized check: a single virtual number inside a single RG on a given server.
    """
    rg_details, error = get_routing_gateway_details(server_info, rg_name)
    if error:
        return None, f"Could not get details for RG '{rg_name}': {error}"

    if rg_details:
        rules = parse_vos_rewrite_rules(rg_details.get("rewriteRulesInCaller", "") or "")
        if virtual_number in rules:
            reals = rules[virtual_number]
            is_hetso = reals == ["hetso"]
            count = 0 if is_hetso else len(reals)
            return {
                "server_name": server_info.get("name"),
                "rg_name": rg_name,
                "real_numbers_count": count,
                "is_hetso": is_hetso,
            }, None

    return None, f"Virtual number '{virtual_number}' not found in RG '{rg_name}'."


# ------------------------------
# Discovery / Number Search (parallel)
# ------------------------------
def _scan_server_for_cleanup(server_info: dict, numbers_to_check_set: Set[str]) -> List[dict]:
    """Scan both MG and RG on one server to find candidates for cleanup. Returns a flat list of findings."""
    s_url, s_name = server_info["url"], server_info["name"]
    found_items: List[dict] = []

    mg_items, err_mg = identify_mg_for_cleanup_backend(s_url, s_name, numbers_to_check_set)
    if mg_items:
        found_items.extend(mg_items)
    if err_mg:
        found_items.append({"_error": f"Cleanup Scan Error (MG) on {s_name}: {err_mg}", "server_name": s_name, "type": "MG"})

    rg_items, err_rg = identify_rgs_for_cleanup_backend(s_url, s_name, numbers_to_check_set)
    if rg_items:
        found_items.extend(rg_items)
    if err_rg:
        found_items.append({"_error": f"Cleanup Scan Error (RG) on {s_name}: {err_rg}", "server_name": s_name, "type": "RG"})

    return found_items


def identify_gateways_for_cleanup_parallel(server_list: List[dict], numbers_to_check_set: Set[str]) -> List[dict]:
    """Run cleanup scan across all servers in parallel."""
    if not server_list:
        return []
    all_found_items: List[dict] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(server_list)) as executor:
        future_to_server = {
            executor.submit(_scan_server_for_cleanup, server_info, numbers_to_check_set): server_info
            for server_info in server_list
        }
        for future in concurrent.futures.as_completed(future_to_server):
            try:
                result = future.result()
                if result:
                    all_found_items.extend(result)
            except Exception as exc:
                server_name = future_to_server[future]['name']
                all_found_items.append({"_error": f"Error during parallel cleanup scan for {server_name}: {exc}", "server_name": server_name})
    return all_found_items


def _scan_server_for_number_info(server_info: dict, all_variants: Set[str], original_inputs: List[str]) -> List[dict]:
    s_url, s_name = server_info["url"], server_info["name"]
    findings: List[dict] = []

    # MG scan
    mg_list, _ = get_all_mapping_gateways(server_info, "")
    if mg_list:
        for mg in mg_list:
            prefixes = {p.strip() for p in (mg.get("calloutCallerPrefixes") or "").split(',') if p.strip()}
            matched = all_variants.intersection(prefixes)
            if matched:
                findings.append({
                    "Server": s_name,
                    "Type": "MG",
                    "Gateway Name": mg.get("name"),
                    "Field": "CalloutCallerPrefixes",
                    "Found Values": ", ".join(sorted(list(matched))),
                    "Matching Original Inputs": ", ".join(sorted(list(set(orig for var in matched for orig in original_inputs if var in generate_search_variants(orig))))),
                    "Rewrite Key Context": "N/A",
                })

    # RG scan
    rg_list, _ = get_all_routing_gateways(server_info, "")
    if rg_list:
        for rg in rg_list:
            rg_name = rg.get("name")

            # CallinCallerPrefixes
            caller_prefixes = {p.strip() for p in (rg.get("callinCallerPrefixes") or "").split(',') if p.strip()}
            matched_caller = all_variants.intersection(caller_prefixes)
            if matched_caller:
                findings.append({
                    "Server": s_name,
                    "Type": "RG",
                    "Gateway Name": rg_name,
                    "Field": "CallinCallerPrefixes",
                    "Found Values": ", ".join(sorted(list(matched_caller))),
                    "Matching Original Inputs": ", ".join(sorted(list(set(orig for var in matched_caller for orig in original_inputs if var in generate_search_variants(orig))))),
                    "Rewrite Key Context": "N/A",
                })

            # CallinCalleePrefixes
            callee_prefixes = {p.strip() for p in (rg.get("callinCalleePrefixes") or "").split(',') if p.strip()}
            matched_callee = all_variants.intersection(callee_prefixes)
            if matched_callee:
                findings.append({
                    "Server": s_name,
                    "Type": "RG",
                    "Gateway Name": rg_name,
                    "Field": "CallinCalleePrefixes",
                    "Found Values": ", ".join(sorted(list(matched_callee))),
                    "Matching Original Inputs": ", ".join(sorted(list(set(orig for var in matched_callee for orig in original_inputs if var in generate_search_variants(orig))))),
                    "Rewrite Key Context": "N/A",
                })

            # RewriteRules
            rules_str = rg.get("rewriteRulesInCaller", "") or ""
            if rules_str:
                parsed_rules = parse_vos_rewrite_rules(rules_str)
                for key, reals in parsed_rules.items():
                    if key in all_variants:
                        findings.append({
                            "Server": s_name,
                            "Type": "RG",
                            "Gateway Name": rg_name,
                            "Field": "RewriteRule (Key)",
                            "Found Values": key,
                            "Matching Original Inputs": ", ".join(sorted(list(set(orig for var in {key} for orig in original_inputs if var in generate_search_variants(orig))))),
                            "Rewrite Key Context": key,
                        })

                    reals_set = {r.strip() for r in reals if r.strip().lower() != "hetso"}
                    matched_reals = all_variants.intersection(reals_set)
                    if matched_reals:
                        findings.append({
                            "Server": s_name,
                            "Type": "RG",
                            "Gateway Name": rg_name,
                            "Field": "RewriteRule (Real Numbers)",
                            "Found Values": ", ".join(sorted(list(matched_reals))),
                            "Matching Original Inputs": ", ".join(sorted(list(set(orig for var in matched_reals for orig in original_inputs if var in generate_search_variants(orig))))),
                            "Rewrite Key Context": key,
                        })
    return findings


def find_number_info_parallel(server_list: List[dict], all_variants: Set[str], original_inputs: List[str]) -> List[dict]:
    """Parallel search of MG/RG across servers for number-related occurrences."""
    if not server_list:
        return []
    all_findings: List[dict] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(server_list)) as executor:
        future_to_server = {
            executor.submit(_scan_server_for_number_info, server, all_variants, original_inputs): server
            for server in server_list
        }
        for future in concurrent.futures.as_completed(future_to_server):
            try:
                result = future.result()
                if result:
                    all_findings.extend(result)
            except Exception as exc:
                server_name = future_to_server[future]['name']
                all_findings.append({"_error": f"Error during parallel number search for {server_name}: {exc}", "server_name": server_name})
    return all_findings

