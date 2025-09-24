# mapping_gateway_management.py
import config
from api_client import call_api # Assumes api_client.py is refactored to return (data, error_msg)
from utils import generate_search_variants,generate_object_hash,parse_vos_rewrite_rules # Assuming this is the correct refactored name if used

# --- Mapping Gateway Data Retrieval Functions ---

def get_all_mapping_gateways(server_info: dict, filter_text: str = "") -> tuple[list[dict] | None, str | None]:
    if not server_info or "url" not in server_info or "name" not in server_info:
        return None, "Error: Server information is incomplete."
    base_url = server_info["url"]
    server_name = server_info["name"]

    api_data, error_msg_api = call_api(base_url, "GetGatewayMapping", {},server_name_for_log=server_name)

    if error_msg_api:
        return None, f"Could not retrieve Mapping Gateway list from server {server_name}: {error_msg_api}"
    if api_data is None:
        return None, f"Could not retrieve Mapping Gateway list from server {server_name} (no data and no specific error)."

    mappings_info_list = api_data.get("infoGatewayMappings", [])
    if not mappings_info_list:
        return [], None

    if filter_text:
        filtered_mappings = [
            m for m in mappings_info_list if filter_text.lower() in m.get("name", "").lower()
        ]
        if not filtered_mappings:
            return [], f"No Mapping Gateways found on server {server_name} matching filter: '{filter_text}'"
        return sorted(filtered_mappings, key=lambda x: x.get("name", "Unnamed_MG")), None
    else:
        return sorted(mappings_info_list, key=lambda x: x.get("name", "Unnamed_MG")), None

def get_mapping_gateway_details(server_info: dict, mg_name: str) -> tuple[dict | None, str | None]:
    if not server_info or "url" not in server_info:
        return None, "Error: Server URL not provided."
    if not mg_name:
        return None, "Error: Mapping Gateway name cannot be empty."

    base_url = server_info["url"]
    server_name = server_info.get("name", base_url)

    api_data, error_msg_api = call_api(base_url, "GetGatewayMapping", {}, server_name_for_log=server_name)

    if error_msg_api:
        return None, f"API call failed while fetching details for MG '{mg_name}' from server {server_name}: {error_msg_api}"
    
    if api_data and api_data.get("infoGatewayMappings"):
        for mg_info_item in api_data.get("infoGatewayMappings", []):
            if mg_info_item.get("name") == mg_name:
                return mg_info_item, None
        return None, f"Mapping Gateway '{mg_name}' not found on server {server_name}."
    
    return None, f"No valid Mapping Gateway data returned from server {server_name} when searching for MG '{mg_name}'."

# --- Mapping Gateway Modification Functions ---

# THAY THẾ HÀM CŨ BẰNG HÀM NÀY
def update_mapping_gateway(server_info: dict, mg_name_param: str, payload_update_data: dict, initial_hash: str | None = None) -> tuple[bool, str | None]:
    if not server_info or "url" not in server_info:
        return False, "Error: Server URL not provided for MG update."

    effective_mg_name = payload_update_data.get('name', mg_name_param)
    if not effective_mg_name:
        return False, "Error: Mapping Gateway name cannot be empty for update."
    if not payload_update_data:
        return False, "Error: Update payload cannot be empty."

    base_url = server_info["url"]
    server_name = server_info.get("name", base_url)

    # --- LOGIC KIỂM TRA XUNG ĐỘT ---
    if initial_hash:
        # 1. JIT Fetch: Tải lại dữ liệu mới nhất ngay trước khi sửa
        latest_data, error_fetch = get_mapping_gateway_details(server_info, mg_name_param)
        if error_fetch or not latest_data:
            return False, f"Could not re-fetch MG for conflict check: {error_fetch}"

        # 2. Tính hash mới và so sánh
        latest_hash = generate_object_hash(latest_data)
        if initial_hash != latest_hash:
            return False, "CONFLICT_ERROR: The data has been modified by another user. Please reload and try again."
    # --- KẾT THÚC LOGIC KIỂM TRA ---

    # Nếu không có xung đột, tiếp tục gọi API như bình thường
    api_data, error_msg_api = call_api(base_url, "ModifyGatewayMapping", payload_update_data, server_name_for_log=server_name)

    if error_msg_api:
        return False, f"Failed to update Mapping Gateway '{effective_mg_name}' on {server_name}: {error_msg_api}"
    
    return True, f"Mapping Gateway '{effective_mg_name}' on server {server_name} updated successfully."
# --- Mapping Gateway Cleanup Support Functions (Multi-Server Backend) ---

def fetch_mappings_for_server_backend(server_url: str, server_name: str) -> tuple[list[dict] | None, str | None]:
    api_data, error_msg = call_api(server_url, "GetGatewayMapping", {}, server_name_for_log=server_name)
    if error_msg:
        return None, error_msg
    if not api_data: # Should be caught by error_msg, but defensive
        return None, "No data returned from API for GetGatewayMapping."
    return api_data.get("infoGatewayMappings", []), None

def identify_mg_for_cleanup_backend(server_url: str, server_name: str, numbers_to_check_set: set[str]) -> tuple[list[dict] | None, str | None]:
    identified_mg_infos_list: list[dict] = []
    all_mappings_on_server_list, error_fetch = fetch_mappings_for_server_backend(server_url, server_name)

    if error_fetch:
        return None, f"Could not fetch MGs for cleanup from {server_name}: {error_fetch}"
    if all_mappings_on_server_list is None:
         return None, f"Received no MG list from {server_name} for cleanup (list is None)."
    if not all_mappings_on_server_list: # List is empty
        return [], None 

    for mg_data_item in all_mappings_on_server_list:
        mg_name_item = mg_data_item.get("name", f"Unnamed_MG_Cleanup_{server_name}")
        prefixes_str_item = mg_data_item.get("calloutCallerPrefixes", "")
        original_prefixes_list_item = [p.strip() for p in prefixes_str_item.split(",") if p.strip()]

        common_numbers_found_list = sorted(list(set(original_prefixes_list_item) & numbers_to_check_set))

        if common_numbers_found_list:
            identified_mg_infos_list.append({
                "type": "MG",
                "server_url": server_url, "server_name": server_name, "name": mg_name_item,
                "original_calloutCallerPrefixes_list": original_prefixes_list_item,
                "common_numbers_in_calloutCaller": common_numbers_found_list,
                "raw_mg_info": mg_data_item, # Keep raw_mg_info
            })
    return identified_mg_infos_list, None

def apply_mg_update_for_cleanup_backend(server_url: str, server_name: str, mg_name: str, updated_mg_data_payload: dict) -> tuple[bool, str]:
    api_data, error_msg = call_api(server_url, "ModifyGatewayMapping", updated_mg_data_payload, server_name_for_log=server_name)
    
    if error_msg:
        return False, f"Error updating Mapping Gateway '{mg_name}' on {server_name} for cleanup: {error_msg}"
    
    if api_data: # call_api ensured retCode == 0 if no error_msg
        new_prefixes_count_val = len([p for p in updated_mg_data_payload.get("calloutCallerPrefixes","").split(',') if p.strip()])
        return True, f"Mapping Gateway '{mg_name}' on {server_name} updated. New prefix count: {new_prefixes_count_val}."
    
    return False, f"Error updating Mapping Gateway '{mg_name}' on {server_name} for cleanup: No data but no specific error."