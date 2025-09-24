import requests
import json

# Import from config using the new, refactored function name
from config import VOS_SERVERS, DEFAULT_TIMEOUT, get_server_info_from_url

def call_api(
    base_url: str,
    endpoint: str,
    payload: dict,
    method: str = "POST",
    timeout: int = DEFAULT_TIMEOUT,
    server_name_for_log: str | None = None
) -> tuple[dict | None, str | None]:

    effective_server_name = server_name_for_log
    server_log_prefix = f"[{effective_server_name}] " if effective_server_name else ""

    if not base_url:
        return None, f"{server_log_prefix}Error: Base URL was not provided to call API."

    url = base_url + endpoint
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
    }

    if not effective_server_name:
        # Attempt to derive server name if not provided, for better error context
        # This uses the corrected function name 'get_server_info_from_url'
        current_server_info = get_server_info_from_url(base_url, VOS_SERVERS)
        effective_server_name = current_server_info.get("name", base_url)
        server_log_prefix = f"[{effective_server_name}] "

    try:
        if method.upper() == "POST":
            if endpoint in ["GetGatewayMapping", "GetGatewayRouting", "GetAllCustomers"] and \
               (payload == {} or payload == {"": ""}):
                response_obj = requests.post(url, data="{}", headers=headers, timeout=timeout)
            else:
                response_obj = requests.post(url, json=payload, headers=headers, timeout=timeout)
        else:
            return None, f"{server_log_prefix}Error: HTTP method '{method}' is not supported by this call_api function."

        response_obj.raise_for_status() # Raises HTTPError for bad responses (4XX or 5XX)

        try:
            result_data = response_obj.json()
        except json.JSONDecodeError as e_json:
            raw_response_text = response_obj.text[:500] # Get a snippet of the raw response
            return None, f"{server_log_prefix}JSON Decode Error for {endpoint}: {e_json}. Raw response (partial): {raw_response_text}"

        # Check for VOS-specific error code if present in the response
        if result_data is not None and result_data.get("retCode") != 0:
            error_exception = result_data.get('exception', 'No specific exception information from API.')
            return None, f"{server_log_prefix}API {endpoint} returned retCode={result_data.get('retCode')}: {error_exception}"
        
        # If we reach here, retCode is 0 (or not present, assuming success)
        return result_data, None

    except requests.exceptions.HTTPError as e_http:
        error_content = "No detailed response content from server."
        status_code_str = "N/A"
        if e_http.response is not None:
            status_code_str = str(e_http.response.status_code)
            try:
                # Try to get JSON error details from response if available
                error_details = e_http.response.json()
                error_content = json.dumps(error_details, indent=2, ensure_ascii=False)
            except json.JSONDecodeError:
                error_content = e_http.response.text[:500] # Fallback to raw text
        return None, f"{server_log_prefix}HTTP Error {status_code_str} at {endpoint}: {e_http}. Server Response: {error_content}"
    except requests.exceptions.ConnectionError as e_conn:
        return None, f"{server_log_prefix}Connection Error at {endpoint}: {e_conn}"
    except requests.exceptions.Timeout as e_timeout:
        return None, f"{server_log_prefix}Timeout during API call to {endpoint}: {e_timeout}"
    except requests.exceptions.RequestException as e_req: # Catch other requests-related errors
        return None, f"{server_log_prefix}General Request Error at {endpoint}: {e_req}"
    except Exception as e_general: # Catch any other unexpected errors
        return None, f"{server_log_prefix}An unexpected error occurred while calling {endpoint}: {type(e_general).__name__} - {e_general}"