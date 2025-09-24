# customer_management.py
import time
import pandas as pd
import sys # Cần import sys để dùng sys.modules
import json
import concurrent.futures
import config
from api_client import call_api # Đã refactor để trả về tuple (data, error_msg)
from utils import format_amount_vietnamese_style,generate_object_hash  # Đảm bảo utils.py có hàm này với tên đúng

# --- Customer Information Retrieval and Update Functions (Backend) ---

def get_raw_customer_details(base_url: str, server_name: str, customer_account: str) -> tuple[dict | None, str | None]:
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

def get_customer_details_for_display(base_url: str, server_name: str, customer_account: str) -> tuple[dict | None, list[dict] | None, str | None]:
    raw_details_data, error_fetch_raw = get_raw_customer_details(base_url, server_name, customer_account)
    
    if error_fetch_raw:
        return None, None, error_fetch_raw
    if not raw_details_data: 
        return None, None, f"No raw details found for customer {customer_account} on {server_name} to display."

    fields_to_display_list = [
        "account", "name", "agentAccount", "feeRateGroup",
        "money", "limitMoney", "todayConsumption",
        "lockType", "type", "category", "startTime", "validTime", "memo"
    ]
    
    display_data_key_value_list = []
    for key_item in fields_to_display_list:
        value_item = raw_details_data.get(key_item)
        display_value_item_str = "N/A"

        if value_item is not None:
            if key_item in ["money", "limitMoney", "todayConsumption"]:
                display_value_item_str = format_amount_vietnamese_style(value_item)
            elif key_item == "lockType":
                display_value_item_str = "Locked" if str(value_item) == "1" else "Active"
            elif key_item in ["startTime", "validTime"]:
                try:
                    timestamp_ms = int(value_item)
                    if -62135596800000 <= timestamp_ms <= 253402300799999 : 
                        display_value_item_str = pd.to_datetime(timestamp_ms, unit='ms').strftime('%Y-%m-%d %H:%M:%S')
                    else:
                        display_value_item_str = f"Invalid Timestamp ({value_item})"
                except (ValueError, TypeError, OverflowError):
                    display_value_item_str = str(value_item) 
            else:
                display_value_item_str = str(value_item)
            
        display_data_key_value_list.append({"field": key_item.replace("_", " ").title(), "value": display_value_item_str})
    
    return raw_details_data, display_data_key_value_list, None


def get_current_customer_limit_money(base_url: str, customer_account: str, server_name: str) -> tuple[float | str | None, str | None]:
    raw_details_data, error_fetch_raw = get_raw_customer_details(base_url, server_name, customer_account)

    if error_fetch_raw:
        return None, error_fetch_raw
    if not raw_details_data:
        return None, f"Could not retrieve customer information for '{customer_account}' to check credit limit."

    limit_money_value_data = raw_details_data.get("limitMoney")
    if limit_money_value_data is not None:
        val_str_data = str(limit_money_value_data).strip().lower()
        if val_str_data in ["-1", "infinity", "unlimited", "không giới hạn"]:
            return "Unlimited", None
        try:
            return float(limit_money_value_data), None
        except ValueError:
            return None, f"Invalid credit limit value ('{limit_money_value_data}') for customer {customer_account}."
    else: 
        return 0.0, f"Credit limit field ('limitMoney') not found for customer {customer_account}, assuming 0.0."


def _update_customer_api_call(base_url: str, payload_to_modify: dict, server_name: str) -> tuple[dict | None, str | None]:
    return call_api(
        base_url, 
        "ModifyCustomer",
        payload_to_modify, 
        server_name_for_log=server_name
    )

def update_customer_credit_limit(server_url: str, server_list: list, customer_account: str, new_credit_limit_str: str, initial_hash: str | None) -> tuple[bool, str | None]:
    server_name = config.get_server_name_from_url(server_url, server_list)

    # --- LOGIC KIỂM TRA XUNG ĐỘT BẰNG HASH ---
    if initial_hash:
        latest_data, error_fetch = get_raw_customer_details(server_url, server_name, customer_account)
        if error_fetch:
            return False, f"Could not re-fetch data for conflict check: {error_fetch}"
        
        latest_hash = generate_object_hash(latest_data)
        if initial_hash != latest_hash:
            return False, "CONFLICT_ERROR: This customer's data has been modified by someone else. Please go back and reload."
    # --- KẾT THÚC LOGIC ---

    payload = {"account": customer_account, "limitMoney": str(new_credit_limit_str)}
    _, error_msg_api = _update_customer_api_call(server_url, payload, server_name)

    if error_msg_api:
        return False, f"Failed to update credit limit: {error_msg_api}"
    return True, "Successfully updated credit limit."

def update_customer_credit_limit(server_url: str, server_list: list, customer_account: str, new_credit_limit_str: str, initial_hash: str | None) -> tuple[bool, str | None]:
    server_name = config.get_server_name_from_url(server_url, server_list)

    # --- LOGIC KIỂM TRA XUNG ĐỘT BẰNG HASH ---
    if initial_hash:
        latest_data, error_fetch = get_raw_customer_details(server_url, server_name, customer_account)
        if error_fetch:
            return False, f"Could not re-fetch data for conflict check: {error_fetch}"
        
        latest_hash = generate_object_hash(latest_data)
        if initial_hash != latest_hash:
            return False, "CONFLICT_ERROR: This customer's data has been modified by someone else. Please go back and reload."
    # --- KẾT THÚC LOGIC ---

    payload = {"account": customer_account, "limitMoney": str(new_credit_limit_str)}
    _, error_msg_api = _update_customer_api_call(server_url, payload, server_name)

    if error_msg_api:
        return False, f"Failed to update credit limit: {error_msg_api}"
    return True, "Successfully updated credit limit."

# --- THAY THẾ HÀM NÀY ---
def update_customer_lock_status(server_url: str, server_list: list, customer_account: str, new_lock_status_str: str, initial_hash: str | None) -> tuple[bool, str | None]:
    server_name = config.get_server_name_from_url(server_url, server_list)

    # --- LOGIC KIỂM TRA XUNG ĐỘT BẰNG HASH ---
    if initial_hash:
        latest_data, error_fetch = get_raw_customer_details(server_url, server_name, customer_account)
        if error_fetch:
            return False, f"Could not re-fetch data for conflict check: {error_fetch}"

        latest_hash = generate_object_hash(latest_data)
        if initial_hash != latest_hash:
            return False, "CONFLICT_ERROR: This customer's data has been modified by someone else. Please go back and reload."
    # --- KẾT THÚC LOGIC ---

    payload = {"account": customer_account, "lockType": str(new_lock_status_str)}
    _, error_msg_api = _update_customer_api_call(server_url, payload, server_name)
    
    if error_msg_api:
        return False, f"Failed to update lock status: {error_msg_api}"
    action = "Locked" if new_lock_status_str == "1" else "Unlocked"
    return True, f"Successfully {action.lower()} account."

def fetch_all_customer_details_on_server(base_url: str, server_name: str, customer_accounts_list: list[str]) -> tuple[list[dict] | None, str | None]:
    if not customer_accounts_list:
        return [], None

    customer_details_compiled_list = []
    errors_collated_list = []

    for i, acc_item in enumerate(customer_accounts_list):
        raw_detail_item, error_item = get_raw_customer_details(base_url, server_name, acc_item)

        if error_item:
            errors_collated_list.append(f"Error for account {acc_item}: {error_item}")
            customer_details_compiled_list.append({
                "account": acc_item, "name": "[Error Loading Data]",
                "money": "0", "limitMoney": "0", "lockType": "0",
                "_error_fetching_details": error_item,
                "_server_name_source": server_name, "_server_url_source": base_url
            })
        elif raw_detail_item:
            raw_detail_item["_server_name_source"] = server_name
            raw_detail_item["_server_url_source"] = base_url
            raw_detail_item.setdefault("account", acc_item)
            raw_detail_item.setdefault("name", f"[Name data missing for {acc_item}]")
            raw_detail_item.setdefault("money", "0")
            raw_detail_item.setdefault("limitMoney", "0")
            raw_detail_item.setdefault("lockType", "0")
            customer_details_compiled_list.append(raw_detail_item)
    
    final_error_message = "; ".join(errors_collated_list) if errors_collated_list else None
    if not customer_details_compiled_list and final_error_message:
        return None, final_error_message
        
    return customer_details_compiled_list, final_error_message


def find_customers_across_all_servers(server_list: list, filter_type: str, filter_text: str) -> list[dict]:
    """
    Tìm kiếm khách hàng trên tất cả các server một cách song song.
    """
    if not server_list or not filter_text:
        return []

    all_found_customers = []
    # Sử dụng ThreadPoolExecutor để chạy các yêu cầu song song
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(server_list)) as executor:
        # Gửi yêu cầu cho mỗi server và lưu lại "lời hứa" (future)
        future_to_server = {
            executor.submit(_fetch_customers_for_single_server, server_info, filter_type, filter_text): server_info
            for server_info in server_list
        }

        # Lấy kết quả khi mỗi "lời hứa" được hoàn thành
        for future in concurrent.futures.as_completed(future_to_server):
            try:
                result = future.result()
                if result:
                    all_found_customers.extend(result)
            except Exception as exc:
                server_name = future_to_server[future]['name']
                print(f"Error fetching from {server_name}: {exc}")

    return sorted(all_found_customers, key=lambda x: (x["ServerName"], x["AccountID"]))
def _fetch_customers_for_single_server(server_info: dict, filter_type: str, filter_text: str) -> list[dict]:
    """Hàm con để lấy dữ liệu khách hàng từ một server duy nhất."""
    server_url = server_info["url"]
    server_name = server_info["name"]

    # Lấy danh sách tất cả account trên server
    all_accounts_data, err = call_api(server_url, "GetAllCustomers", {}, timeout=45, server_name_for_log=server_name)
    if err or not all_accounts_data or not all_accounts_data.get("accounts"):
        return []

    accounts_on_server = all_accounts_data.get("accounts", [])

    # Lọc theo ID nếu cần
    accounts_to_fetch = [acc for acc in accounts_on_server if filter_text.lower() in acc.lower()]

    if not accounts_to_fetch:
        return []

    # Lấy chi tiết các account đã lọc
    detailed_customers, _ = fetch_all_customer_details_on_server(server_url, server_name, accounts_to_fetch)

    # Xử lý và định dạng kết quả
    found_customers = []
    if detailed_customers:
        for cust in detailed_customers:
            found_customers.append({
                "AccountID": cust.get("account"),
                "BalanceRaw": cust.get("money", 0.0),
                "CreditLimitRaw": cust.get("limitMoney", 0.0),
                "Status": "Locked" if str(cust.get("lockType", "0")) == "1" else "Active",
                "ServerName": server_name,
                "_server_url": server_url
            })
    return found_customers