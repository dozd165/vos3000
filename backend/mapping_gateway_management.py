
# mapping_gateway_management_backend.py
# Backend-only helpers for Mapping Gateway management (no Streamlit/UI deps).
from __future__ import annotations

from typing import Dict, List, Optional, Tuple, Set

import config
from api_client import call_api  # Expects to return (data, error_msg)
from utils import generate_object_hash  # Keep minimal util deps


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
# Queries
# ------------------------------

def get_all_mapping_gateways(server_info: dict, filter_text: str = "") -> Tuple[Optional[List[dict]], Optional[str]]:
    """
    Fetch all Mapping Gateways on a server, optional substring filter by name.
    Returns (list[dict] | [], error | None)
    """
    base_url, server_name, err = _extract_server(server_info)
    if err:
        return None, err

    api_data, error_msg_api = call_api(base_url, "GetGatewayMapping", {}, server_name_for_log=server_name)
    if error_msg_api:
        return None, f"Could not retrieve Mapping Gateway list from server {server_name}: {error_msg_api}"
    if api_data is None:
        return None, f"Could not retrieve Mapping Gateway list from server {server_name} (no data and no specific error)."

    mappings = api_data.get("infoGatewayMappings", []) or []
    if filter_text:
        ft = filter_text.lower()
        mappings = [m for m in mappings if ft in (m.get('name') or '').lower()]

    mappings_sorted = sorted(mappings, key=lambda x: x.get("name", "Unnamed_MG"))
    return mappings_sorted, None


def get_mapping_gateway_details(server_info: dict, mg_name: str) -> Tuple[Optional[dict], Optional[str]]:
    """
    Fetch details for a specific Mapping Gateway by exact name.
    Returns (mg_dict | None, error | None)
    """
    if not mg_name:
        return None, "Error: Mapping Gateway name cannot be empty."

    base_url, server_name, err = _extract_server(server_info)
    if err:
        return None, err

    api_data, error_msg_api = call_api(base_url, "GetGatewayMapping", {}, server_name_for_log=server_name)
    if error_msg_api:
        return None, f"API call failed while fetching details for MG '{mg_name}' from server {server_name}: {error_msg_api}"

    for mg in api_data.get("infoGatewayMappings", []) or []:
        if mg.get("name") == mg_name:
            return mg, None

    return None, f"Mapping Gateway '{mg_name}' not found on server {server_name}."


# ------------------------------
# Mutations
# ------------------------------

def update_mapping_gateway(server_info: dict, mg_name_param: str, payload_update_data: dict, initial_hash: Optional[str] = None) -> Tuple[bool, Optional[str]]:
    """
    Update Mapping Gateway using ModifyGatewayMapping, with optimistic concurrency via object hash.
    - mg_name_param: name chosen in UI/router; payload_update_data may contain 'name' to rename.
    Returns (ok, message_or_error).
    """
    base_url, server_name, err = _extract_server(server_info)
    if err:
        return False, err

    effective_mg_name = (payload_update_data or {}).get("name") or mg_name_param
    if not effective_mg_name:
        return False, "Error: Mapping Gateway name cannot be empty for update."
    if not payload_update_data:
        return False, "Error: Update payload cannot be empty."

    # Conflict check
    if initial_hash:
        latest_data, error_fetch = get_mapping_gateway_details(server_info, mg_name_param)
        if error_fetch or not latest_data:
            return False, f"Could not re-fetch MG for conflict check: {error_fetch or 'no data'}"
        latest_hash = generate_object_hash(latest_data)
        if initial_hash != latest_hash:
            return False, "CONFLICT_ERROR: The data has been modified by another user. Please reload and try again."

    api_data, error_msg_api = call_api(base_url, "ModifyGatewayMapping", payload_update_data, server_name_for_log=server_name)
    if error_msg_api:
        return False, f"Failed to update Mapping Gateway '{effective_mg_name}' on {server_name}: {error_msg_api}"

    return True, f"Mapping Gateway '{effective_mg_name}' on server {server_name} updated successfully."


# ------------------------------
# Cleanup (multi-server backend support)
# ------------------------------

def fetch_mappings_for_server_backend(server_url: str, server_name: str) -> Tuple[Optional[List[dict]], Optional[str]]:
    """
    Low-level fetch for all MGs. Returns (list|[], error).
    """
    api_data, error_msg = call_api(server_url, "GetGatewayMapping", {}, server_name_for_log=server_name)
    if error_msg:
        return None, error_msg
    if not api_data:
        return None, "No data returned from API for GetGatewayMapping."
    return api_data.get("infoGatewayMappings", []) or [], None


def identify_mg_for_cleanup_backend(server_url: str, server_name: str, numbers_to_check_set: Set[str]) -> Tuple[Optional[List[dict]], Optional[str]]:
    """
    Given a set of 'numbers' (caller prefixes), find MGs that contain any of them in calloutCallerPrefixes.
    Returns (list of matches | [], error).
    """
    identified: List[dict] = []
    all_mappings, error_fetch = fetch_mappings_for_server_backend(server_url, server_name)

    if error_fetch:
        return None, f"Could not fetch MGs for cleanup from {server_name}: {error_fetch}"
    if all_mappings is None:
        return None, f"Received no MG list from {server_name} for cleanup (list is None)."
    if not all_mappings:
        return [], None

    for mg in all_mappings:
        mg_name = mg.get("name") or f"Unnamed_MG_Cleanup_{server_name}"
        prefixes_str = mg.get("calloutCallerPrefixes", "") or ""
        original_list = [p.strip() for p in prefixes_str.split(",") if p.strip()]

        common = sorted(set(original_list) & set(numbers_to_check_set))
        if common:
            identified.append({
                "type": "MG",
                "server_url": server_url, "server_name": server_name, "name": mg_name,
                "original_calloutCallerPrefixes_list": original_list,
                "common_numbers_in_calloutCaller": common,
                "raw_mg_info": mg,
            })
    return identified, None


def apply_mg_update_for_cleanup_backend(server_url: str, server_name: str, mg_name: str, updated_mg_data_payload: dict) -> Tuple[bool, str]:
    """
    Apply 'ModifyGatewayMapping' with a prepared payload (e.g., prefixes removed).
    Returns (ok, message).
    """
    _, error_msg = call_api(server_url, "ModifyGatewayMapping", updated_mg_data_payload, server_name_for_log=server_name)
    if error_msg:
        return False, f"Error updating Mapping Gateway '{mg_name}' on {server_name} for cleanup: {error_msg}"

    new_prefixes_count = len([p for p in (updated_mg_data_payload.get('calloutCallerPrefixes') or '').split(',') if p.strip()])
    return True, f"Mapping Gateway '{mg_name}' on {server_name} updated. New prefix count: {new_prefixes_count}."
