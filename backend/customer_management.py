
# customer_management_backend.py
# Backend-only customer management helpers (no Streamlit; no pandas).
# This module keeps network/API logic pure and UI-agnostic.
from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple, Union
import concurrent.futures

import config
from api_client import call_api  # Expects to return tuple: (data, error_msg)
from utils import format_amount_vietnamese_style, generate_object_hash


Json = Dict[str, Union[str, int, float, bool, dict, list, None]]


# ------------------------------
# Helpers
# ------------------------------

def _ms_to_iso8601_utc(ts_ms: Union[int, str, float]) -> str:
    """
    Convert milliseconds epoch to ISO 8601 UTC string. If invalid, return the original as string.
    """
    try:
        iv = int(ts_ms)
        # Guardrail: valid range roughly year 0001..9999 in ms
        if -62135596800000 <= iv <= 253402300799999:
            return datetime.fromtimestamp(iv / 1000.0, tz=timezone.utc).isoformat()
        return str(ts_ms)
    except (ValueError, TypeError, OverflowError):
        return str(ts_ms)


# ------------------------------
# Core fetch/update
# ------------------------------

def get_raw_customer_details(base_url: str, server_name: str, customer_account: str) -> Tuple[Optional[dict], Optional[str]]:
    """
    Fetch raw customer dict from API. Returns (data, error).
    """
    payload = {"accounts": [customer_account]}
    api_data, error_msg_api = call_api(base_url, "GetCustomer", payload, server_name_for_log=server_name)

    if error_msg_api:
        return None, f"Failed to get customer details for {customer_account} on {server_name}: {error_msg_api}"
    if not api_data:
        return None, f"No data returned for customer {customer_account} on {server_name} (and no specific error)."

    info_customers_list = api_data.get("infoCustomers", [])
    if not info_customers_list:
        return None, f"Customer {customer_account} not found or no data in infoCustomers list on {server_name}."

    return info_customers_list[0], None


def get_customer_details_canonical(base_url: str, server_name: str, customer_account: str) -> Tuple[Optional[dict], Optional[Json], Optional[str]]:
    """
    Fetch raw data and a canonical, UI-agnostic view with typed fields.
    Returns (raw, canonical, error). Numeric/time values kept machine-friendly.
    """
    raw, err = get_raw_customer_details(base_url, server_name, customer_account)
    if err:
        return None, None, err
    if not raw:
        return None, None, f"No raw details found for customer {customer_account} on {server_name}."

    canonical: Json = {
        "account": raw.get("account"),
        "name": raw.get("name"),
        "agentAccount": raw.get("agentAccount"),
        "feeRateGroup": raw.get("feeRateGroup"),
        "money": float(raw.get("money", 0)) if str(raw.get("money", "")).strip().replace('.', '', 1).isdigit() else raw.get("money"),
        "limitMoney": float(raw.get("limitMoney", 0)) if str(raw.get("limitMoney", "")).strip().replace('.', '', 1).isdigit() else raw.get("limitMoney"),
        "todayConsumption": float(raw.get("todayConsumption", 0)) if str(raw.get("todayConsumption", "")).strip().replace('.', '', 1).isdigit() else raw.get("todayConsumption"),
        "lockType": int(raw.get("lockType", 0)) if str(raw.get("lockType", "")).strip().isdigit() else raw.get("lockType"),
        "type": raw.get("type"),
        "category": raw.get("category"),
        "startTimeMs": raw.get("startTime"),
        "validTimeMs": raw.get("validTime"),
        "startTimeISO": _ms_to_iso8601_utc(raw.get("startTime")) if raw.get("startTime") is not None else None,
        "validTimeISO": _ms_to_iso8601_utc(raw.get("validTime")) if raw.get("validTime") is not None else None,
        "memo": raw.get("memo"),
        "_server_name_source": server_name,
        "_server_url_source": base_url,
    }
    return raw, canonical, None


def get_customer_details_for_display(base_url: str, server_name: str, customer_account: str) -> Tuple[Optional[dict], Optional[List[dict]], Optional[str]]:
    """
    (Optional) Presentational helper kept for transition. Formats for UI readout.
    Returns (raw, list-of-{field, value}, error).
    """
    raw, err = get_raw_customer_details(base_url, server_name, customer_account)
    if err:
        return None, None, err
    if not raw:
        return None, None, f"No raw details found for customer {customer_account} on {server_name} to display."

    fields_to_display = [
        "account", "name", "agentAccount", "feeRateGroup",
        "money", "limitMoney", "todayConsumption",
        "lockType", "type", "category", "startTime", "validTime", "memo"
    ]

    display_rows: List[dict] = []
    for key in fields_to_display:
        value = raw.get(key)
        view = "N/A"
        if value is not None:
            if key in ["money", "limitMoney", "todayConsumption"]:
                view = format_amount_vietnamese_style(value)
            elif key == "lockType":
                view = "Locked" if str(value) == "1" else "Active"
            elif key in ["startTime", "validTime"]:
                view = _ms_to_iso8601_utc(value)
            else:
                view = str(value)
        display_rows.append({"field": key.replace("_", " ").title(), "value": view})

    return raw, display_rows, None


def get_current_customer_limit_money(base_url: str, customer_account: str, server_name: str) -> Tuple[Optional[Union[float, str]], Optional[str]]:
    """
    Return current limitMoney (float) or the string 'Unlimited' when applicable. Returns (value, error).
    """
    raw, err = get_raw_customer_details(base_url, server_name, customer_account)
    if err:
        return None, err
    if not raw:
        return None, f"Could not retrieve customer information for '{customer_account}' to check credit limit."

    lm = raw.get("limitMoney")
    if lm is not None:
        s = str(lm).strip().lower()
        if s in ["-1", "infinity", "unlimited", "không giới hạn"]:
            return "Unlimited", None
        try:
            return float(lm), None
        except ValueError:
            return None, f"Invalid credit limit value ('{lm}') for customer {customer_account}."
    else:
        return 0.0, f"Credit limit field ('limitMoney') not found for customer {customer_account}, assuming 0.0."


def _update_customer_api_call(base_url: str, payload_to_modify: dict, server_name: str) -> Tuple[Optional[dict], Optional[str]]:
    return call_api(base_url, "ModifyCustomer", payload_to_modify, server_name_for_log=server_name)


def update_customer_credit_limit(server_url: str, server_list: list, customer_account: str, new_credit_limit_str: str, initial_hash: Optional[str]) -> Tuple[bool, Optional[str]]:
    """
    Update limitMoney with optimistic concurrency via object hash.
    """
    server_name = config.get_server_name_from_url(server_url, server_list)

    # Conflict detection
    if initial_hash:
        latest_data, error_fetch = get_raw_customer_details(server_url, server_name, customer_account)
        if error_fetch:
            return False, f"Could not re-fetch data for conflict check: {error_fetch}"
        latest_hash = generate_object_hash(latest_data)
        if initial_hash != latest_hash:
            return False, "CONFLICT_ERROR: This customer's data has been modified by someone else. Please reload."

    payload = {"account": customer_account, "limitMoney": str(new_credit_limit_str)}
    _, error_msg_api = _update_customer_api_call(server_url, payload, server_name)
    if error_msg_api:
        return False, f"Failed to update credit limit: {error_msg_api}"
    return True, "Successfully updated credit limit."


def update_customer_lock_status(server_url: str, server_list: list, customer_account: str, new_lock_status_str: str, initial_hash: Optional[str]) -> Tuple[bool, Optional[str]]:
    """
    Update lockType (0/1) with optimistic concurrency.
    """
    server_name = config.get_server_name_from_url(server_url, server_list)

    if initial_hash:
        latest_data, error_fetch = get_raw_customer_details(server_url, server_name, customer_account)
        if error_fetch:
            return False, f"Could not re-fetch data for conflict check: {error_fetch}"
        latest_hash = generate_object_hash(latest_data)
        if initial_hash != latest_hash:
            return False, "CONFLICT_ERROR: This customer's data has been modified by someone else. Please reload."

    payload = {"account": customer_account, "lockType": str(new_lock_status_str)}
    _, error_msg_api = _update_customer_api_call(server_url, payload, server_name)

    if error_msg_api:
        return False, f"Failed to update lock status: {error_msg_api}"
    action = "locked" if new_lock_status_str == "1" else "unlocked"
    return True, f"Successfully {action} account."


def fetch_all_customer_details_on_server(base_url: str, server_name: str, customer_accounts_list: List[str]) -> Tuple[Optional[List[dict]], Optional[str]]:
    """
    Batch fetch details for multiple accounts on a single server.
    """
    if not customer_accounts_list:
        return [], None

    out: List[dict] = []
    errs: List[str] = []

    for acc in customer_accounts_list:
        raw, err = get_raw_customer_details(base_url, server_name, acc)
        if err:
            errs.append(f"Error for account {acc}: {err}")
            out.append({
                "account": acc, "name": "[Error Loading Data]",
                "money": "0", "limitMoney": "0", "lockType": "0",
                "_error_fetching_details": err,
                "_server_name_source": server_name, "_server_url_source": base_url
            })
        elif raw:
            raw["_server_name_source"] = server_name
            raw["_server_url_source"] = base_url
            raw.setdefault("account", acc)
            raw.setdefault("name", f"[Name data missing for {acc}]")
            raw.setdefault("money", "0")
            raw.setdefault("limitMoney", "0")
            raw.setdefault("lockType", "0")
            out.append(raw)

    final_err = "; ".join(errs) if errs else None
    if not out and final_err:
        return None, final_err
    return out, final_err


def _fetch_customers_for_single_server(server_info: dict, filter_type: str, filter_text: str) -> List[dict]:
    """
    Internal: fetch and filter customers on a single server.
    """
    server_url = server_info["url"]
    server_name = server_info["name"]

    all_accounts_data, err = call_api(server_url, "GetAllCustomers", {}, timeout=45, server_name_for_log=server_name)
    if err or not all_accounts_data or not all_accounts_data.get("accounts"):
        return []

    accounts_on_server = all_accounts_data.get("accounts", [])
    accounts_to_fetch = [acc for acc in accounts_on_server if filter_text.lower() in acc.lower()]

    if not accounts_to_fetch:
        return []

    detailed_customers, _ = fetch_all_customer_details_on_server(server_url, server_name, accounts_to_fetch)

    found: List[dict] = []
    if detailed_customers:
        for cust in detailed_customers:
            found.append({
                "AccountID": cust.get("account"),
                "BalanceRaw": cust.get("money", 0.0),
                "CreditLimitRaw": cust.get("limitMoney", 0.0),
                "LockType": cust.get("lockType", "0"),
                "Status": "Locked" if str(cust.get("lockType", "0")) == "1" else "Active",
                "ServerName": server_name,
                "_server_url": server_url
            })
    return found


def find_customers_across_all_servers(server_list: List[dict], filter_type: str, filter_text: str) -> List[dict]:
    """
    Parallel search across servers. Returns a sorted list of lightweight entries.
    """
    if not server_list or not filter_text:
        return []

    all_found: List[dict] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(server_list)) as executor:
        future_to_server = {
            executor.submit(_fetch_customers_for_single_server, server_info, filter_type, filter_text): server_info
            for server_info in server_list
        }
        for future in concurrent.futures.as_completed(future_to_server):
            try:
                result = future.result()
                if result:
                    all_found.extend(result)
            except Exception as exc:  # noqa: BLE001
                # Avoid print/log side effects in backend helper; propagate via None entries if needed
                server_name = future_to_server[future]['name']
                all_found.append({"_error": f"Error fetching from {server_name}: {exc}", "ServerName": server_name})

    return sorted(all_found, key=lambda x: (x.get("ServerName", ""), x.get("AccountID", "")))
