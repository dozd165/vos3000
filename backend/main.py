# =================================================================
# 1. IMPORT CORE LIBRARIES & FASTAPI MODULES
# =================================================================
import logging
from typing import List, Optional, Dict

# Xóa các import liên quan đến bảo mật: Security, Depends, APIRouter
from fastapi import FastAPI, HTTPException, Body, Query
from fastapi.middleware.cors import CORSMiddleware
# =================================================================
# 2. IMPORT CUSTOM LOGIC & CONFIG
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
    apply_mg_update_for_cleanup_backend
)
from routing_gateway_management import (
    get_all_routing_gateways,
    get_routing_gateway_details,
    update_routing_gateway,
    find_number_info_parallel,
    identify_gateways_for_cleanup_parallel,
    find_definitions_for_virtual_keys_backend,
    add_real_numbers_to_rule_backend,
    get_vn_status_in_specific_rg,
    apply_rg_update_for_cleanup_backend
)
from utils import generate_object_hash, generate_search_variants

# =================================================================
# 3. KHỞI TẠO FastAPI App & LOGGING
# =================================================================
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

app = FastAPI(
    title="VOS3000 Management API (Unsecured)",
    description="API để quản lý tập trung các VOS3000 server. Lớp bảo mật API Key đã được tạm thời vô hiệu hóa.",
    version="1.1.0-dev"
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Địa chỉ của frontend Vite
    allow_credentials=True,
    allow_methods=["*"], # Cho phép tất cả các phương thức (GET, POST, etc.)
    allow_headers=["*"], # Cho phép tất cả các header
)
# =================================================================
# 4. HELPER FUNCTION
# =================================================================
def get_server_info(server_name: str) -> dict:
    """Lấy thông tin server từ config, trả về lỗi 404 nếu không tìm thấy."""
    server_info = next((s for s in config.VOS_SERVERS if s["name"] == server_name), None)
    if not server_info:
        raise HTTPException(status_code=404, detail=f"Server '{server_name}' not found in config.")
    return server_info

# =================================================================
# 5. ĐỊNH NGHĨA API ENDPOINTS (DÙNG TRỰC TIẾP @app)
# =================================================================

# --- Public Endpoints ---
@app.get("/", tags=["General"])
def read_root():
    return {"message": "Welcome to VOS3000 Management API"}

@app.get("/servers", tags=["General"])
def list_configured_servers():
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
    if canonical_data:
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

@app.put("/servers/{server_name}/customers/{account_id}/lock-status", tags=["Customer Management"])
def set_customer_lock_status(server_name: str, account_id: str, payload: Dict = Body(...)):
    server_info = get_server_info(server_name)
    success, message = update_customer_lock_status(
        server_url=server_info["url"], server_list=config.VOS_SERVERS,
        customer_account=account_id, new_lock_status_str=payload.get("new_lock_status"),
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
    if details:
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
    if details:
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

@app.post("/servers/{server_name}/routing-gateways/{rg_name}/rules/{virtual_key}/reals", tags=["Gateway Management"])
def add_reals_to_rewrite_rule(server_name: str, rg_name: str, virtual_key: str, payload: Dict = Body(...)):
    server_info = get_server_info(server_name)
    new_reals = payload.get("new_reals", [])
    initial_hash = payload.get("initial_hash")
    if not new_reals: raise HTTPException(status_code=400, detail="Payload must contain a 'new_reals' list.")
    success, message = add_real_numbers_to_rule_backend(
        server_info=server_info, rg_name=rg_name, virtual_key=virtual_key,
        new_real_numbers_to_add=new_reals, initial_hash=initial_hash
    )
    if not success:
        if "CONFLICT" in (message or ""): raise HTTPException(status_code=409, detail=message)
        raise HTTPException(status_code=400, detail=message)
    return {"message": message}

# --- System-Wide Search & Cleanup Endpoints ---
@app.post("/search/number-info", tags=["Search & Cleanup"])
def search_number_info(payload: Dict = Body(...)):
    original_inputs = payload.get("numbers", [])
    if not original_inputs: raise HTTPException(status_code=400, detail="Payload must contain a 'numbers' list.")
    all_variants = set().union(*(generate_search_variants(item) for item in original_inputs))
    results = find_number_info_parallel(config.VOS_SERVERS, all_variants, original_inputs)
    return results

@app.post("/cleanup/scan", tags=["Search & Cleanup"])
def scan_for_cleanup(payload: Dict = Body(...)):
    numbers_to_check = set(payload.get("numbers", []))
    if not numbers_to_check: raise HTTPException(status_code=400, detail="Payload must contain a 'numbers' list to check.")
    all_variants_to_check = set().union(*(generate_search_variants(num) for num in numbers_to_check))
    results = identify_gateways_for_cleanup_parallel(config.VOS_SERVERS, all_variants_to_check)
    return results

@app.post("/cleanup/execute", tags=["Search & Cleanup"])
def execute_cleanup(payload: Dict = Body(...)):
    tasks = payload.get("tasks", [])
    if not tasks: raise HTTPException(status_code=400, detail="Payload must contain a 'tasks' list.")
    results_log = []
    for task in tasks:
        server_name, gateway_name = task.get("server_name"), task.get("gateway_name")
        task_type, updated_payload = task.get("type"), task.get("updated_payload")
        if not all([server_name, gateway_name, task_type, updated_payload]):
            results_log.append(f"Skipping invalid task: {task}"); continue
        try:
            server_info = get_server_info(server_name)
            server_url = server_info["url"]
            success, message = False, "Unknown error"
            if task_type == "MG":
                success, message = apply_mg_update_for_cleanup_backend(server_url, server_name, gateway_name, updated_payload)
            elif task_type == "RG":
                success, message = apply_rg_update_for_cleanup_backend(server_url, server_name, gateway_name, updated_payload)
            else: message = f"Unsupported task type: {task_type}"
            status = "SUCCESS" if success else "FAILED"
            results_log.append(f"[{status}] {server_name} - {gateway_name}: {message}")
        except HTTPException: results_log.append(f"[FAILED] {server_name} - {gateway_name}: Server not found in config.")
        except Exception as e: results_log.append(f"[FAILED] {server_name} - {gateway_name}: An unexpected error occurred: {e}")
    return {"execution_log": results_log}

# --- Rewrite Rule & Status Endpoints ---
@app.get("/rewrite-rules/search", tags=["Rewrite Rule Management"])
def search_rewrite_rules(keys: List[str] = Query(..., description="List of virtual keys to search for definitions.")):
    if not keys: raise HTTPException(status_code=400, detail="Query parameter 'keys' is required.")
    definitions, error = find_definitions_for_virtual_keys_backend(keys)
    if error: raise HTTPException(status_code=500, detail=error)
    return definitions

@app.get("/status/virtual-number", tags=["Status"])
def get_vn_status_targeted(server_name: str, rg_name: str, vn: str):
    server_info = get_server_info(server_name)
    status, error = get_vn_status_in_specific_rg(server_info, rg_name, vn)
    if error: raise HTTPException(status_code=404, detail=error)
    return {"found": True, "definition": status}