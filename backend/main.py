from fastapi import FastAPI, HTTPException, Body, Query
import logging
from typing import List, Optional, Dict, Set

# =================================================================
# 1. IMPORT LOGIC
# =================================================================
import config
from customer_management import (
    find_customers_across_all_servers,
    get_customer_details_canonical,
    update_customer_credit_limit,
    update_customer_lock_status
)
from mapping_gateway_management import (
    get_all_mapping_gateways,
    get_mapping_gateway_details,
    update_mapping_gateway,
)
from routing_gateway_management import (
    get_all_routing_gateways,
    get_routing_gateway_details,
    update_routing_gateway,
    find_number_info_parallel,
    identify_gateways_for_cleanup_parallel,
    find_definitions_for_virtual_keys_backend
)
from utils import generate_object_hash, generate_search_variants

# =================================================================
# 2. KHỞI TẠO FastAPI App
# =================================================================
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

app = FastAPI(
    title="VOS3000 Management API",
    description="API để quản lý tập trung các VOS3000 server. Tách biệt hoàn toàn backend và frontend.",
    version="1.0.0"
)

# =================================================================
# 3. HELPER FUNCTION
# =================================================================
def get_server_info(server_name: str) -> dict:
    """Lấy thông tin server từ config, trả về lỗi 404 nếu không tìm thấy."""
    server_info = next((s for s in config.VOS_SERVERS if s["name"] == server_name), None)
    if not server_info:
        raise HTTPException(status_code=404, detail=f"Server '{server_name}' not found in config.")
    return server_info

# =================================================================
# 4. ĐỊNH NGHĨA API ENDPOINTS
# =================================================================

# --- Root Endpoint ---
@app.get("/", tags=["General"])
def read_root():
    return {"message": "Welcome to VOS3000 Management API"}

@app.get("/servers", tags=["General"])
def list_configured_servers():
    """Lấy danh sách tất cả các server đã được cấu hình."""
    return [{"name": s["name"]} for s in config.VOS_SERVERS]


# --- Customer Management Endpoints ---
@app.get("/customers/search", tags=["Customer Management"])
def search_customers(filter_text: str, filter_type: str = "account_id"):
    results = find_customers_across_all_servers(config.VOS_SERVERS, filter_type, filter_text)
    return results

@app.get("/servers/{server_name}/customers/{account_id}", tags=["Customer Management"])
def get_customer_details(server_name: str, account_id: str):
    server_info = get_server_info(server_name)
    raw_data, canonical_data, error = get_customer_details_canonical(server_info["url"], server_name, account_id)
    if error: raise HTTPException(status_code=404, detail=error)
    canonical_data["hash"] = generate_object_hash(raw_data)
    return canonical_data

@app.put("/servers/{server_name}/customers/{account_id}/credit-limit", tags=["Customer Management"])
def set_customer_credit_limit(server_name: str, account_id: str, payload: Dict = Body(...)):
    server_info = get_server_info(server_name)
    success, message = update_customer_credit_limit(
        server_url=server_info["url"], server_list=config.VOS_SERVERS,
        customer_account=account_id, new_credit_limit_str=payload.get("new_limit"),
        initial_hash=payload.get("initial_hash")
    )
    if not success:
        if "CONFLICT" in (message or ""): raise HTTPException(status_code=409, detail=message)
        raise HTTPException(status_code=400, detail=message)
    return {"message": message}

# --- Gateway Management Endpoints ---

@app.get("/servers/{server_name}/mapping-gateways", tags=["Gateway Management"])
def list_mapping_gateways(server_name: str, filter_text: str = ""):
    server_info = get_server_info(server_name)
    gateways, error = get_all_mapping_gateways(server_info, filter_text)
    if error: raise HTTPException(status_code=500, detail=error)
    return gateways

@app.get("/servers/{server_name}/mapping-gateways/{mg_name}", tags=["Gateway Management"])
def get_mg_details(server_name: str, mg_name: str):
    server_info = get_server_info(server_name)
    details, error = get_mapping_gateway_details(server_info, mg_name)
    if error: raise HTTPException(status_code=404, detail=error)
    details["hash"] = generate_object_hash(details)
    return details

@app.put("/servers/{server_name}/mapping-gateways/{mg_name}", tags=["Gateway Management"])
def update_mg(server_name: str, mg_name: str, payload: Dict = Body(...)):
    server_info = get_server_info(server_name)
    initial_hash = payload.pop("initial_hash", None)
    success, message = update_mapping_gateway(server_info, mg_name, payload, initial_hash)
    if not success:
        if "CONFLICT" in (message or ""): raise HTTPException(status_code=409, detail=message)
        raise HTTPException(status_code=400, detail=message)
    return {"message": message}

@app.get("/servers/{server_name}/routing-gateways", tags=["Gateway Management"])
def list_routing_gateways(server_name: str, filter_text: str = ""):
    server_info = get_server_info(server_name)
    gateways, error = get_all_routing_gateways(server_info, filter_text)
    if error: raise HTTPException(status_code=500, detail=error)
    return gateways

@app.get("/servers/{server_name}/routing-gateways/{rg_name}", tags=["Gateway Management"])
def get_rg_details(server_name: str, rg_name: str):
    server_info = get_server_info(server_name)
    details, error = get_routing_gateway_details(server_info, rg_name)
    if error: raise HTTPException(status_code=404, detail=error)
    details["hash"] = generate_object_hash(details)
    return details
    
@app.put("/servers/{server_name}/routing-gateways/{rg_name}", tags=["Gateway Management"])
def update_rg(server_name: str, rg_name: str, payload: Dict = Body(...)):
    server_info = get_server_info(server_name)
    initial_hash = payload.pop("initial_hash", None)
    success, message = update_routing_gateway(server_info, rg_name, payload, initial_hash)
    if not success:
        if "CONFLICT" in (message or ""): raise HTTPException(status_code=409, detail=message)
        raise HTTPException(status_code=400, detail=message)
    return {"message": message}

# --- System-Wide Search & Cleanup Endpoints ---
@app.post("/search/number-info", tags=["Search & Cleanup"])
def search_number_info(payload: Dict = Body(...)):
    original_inputs = payload.get("numbers", [])
    if not original_inputs:
        raise HTTPException(status_code=400, detail="Payload must contain a 'numbers' list.")
    all_variants = set().union(*(generate_search_variants(item) for item in original_inputs))
    results = find_number_info_parallel(config.VOS_SERVERS, all_variants, original_inputs)
    return results

@app.post("/cleanup/scan", tags=["Search & Cleanup"])
def scan_for_cleanup(payload: Dict = Body(...)):
    """Quét toàn bộ hệ thống để tìm các gateway chứa số cần dọn dẹp."""
    numbers_to_check = set(payload.get("numbers", []))
    if not numbers_to_check:
        raise HTTPException(status_code=400, detail="Payload must contain a 'numbers' list to check.")
    
    # Tạo các biến thể để quét cho chắc chắn
    all_variants_to_check = set().union(*(generate_search_variants(num) for num in numbers_to_check))

    results = identify_gateways_for_cleanup_parallel(config.VOS_SERVERS, all_variants_to_check)
    return results

# Thêm endpoint cho Rewrite Rules
@app.get("/rewrite-rules/search", tags=["Rewrite Rule Management"])
def search_rewrite_rules(keys: List[str] = Query(None)):
    """Tìm kiếm định nghĩa cho một hoặc nhiều virtual key."""
    if not keys:
        raise HTTPException(status_code=400, detail="Query parameter 'keys' is required.")
    
    definitions, error = find_definitions_for_virtual_keys_backend(keys)
    if error:
        raise HTTPException(status_code=500, detail=error)
    return definitions

