import axios from 'axios';

// Cấu hình một "client" Axios với địa chỉ của backend
const apiClient = axios.create({
  baseURL: 'http://127.0.0.1:8000', // Địa chỉ Backend API của bạn
  timeout: 10000, // Thời gian chờ tối đa: 10 giây
});

/**
 * Hàm để gọi API lấy danh sách tất cả các server
 * @returns {Promise<Array>} Danh sách các server
 */
export const getServers = async () => {
  try {
    const response = await apiClient.get('/servers');
    return response.data;
  } catch (error) {
    console.error('Error fetching servers:', error);
    throw error;
  }
};

/**
 * Hàm để tìm kiếm khách hàng
 * @param {string} filterType - Loại tìm kiếm ('account_id' hoặc 'account_name')
 * @param {string} filterText - Từ khóa tìm kiếm
 * @returns {Promise<Array>} Danh sách khách hàng tìm thấy
 */
export const searchCustomers = async (filterType, filterText) => {
  try {
    const response = await apiClient.get('/customers/search', {
      params: {
        filter_type: filterType,
        filter_text: filterText,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error searching customers:', error);
    throw error;
  }
};

/**
 * Lấy thông tin chi tiết của một khách hàng
 * @param {string} serverName - Tên server chứa khách hàng
 * @param {string} accountId - ID của khách hàng
 * @returns {Promise<Object>} Đối tượng chứa thông tin chi tiết của khách hàng
 */
export const getCustomerDetails = async (serverName, accountId) => {
  try {
    const response = await apiClient.get(`/servers/${serverName}/customers/${accountId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching customer details:', error);
    throw error;
  }
};

/**
 * Cập nhật hạn mức tín dụng cho khách hàng
 * @param {string} serverName Tên server
 * @param {string} accountId ID khách hàng
 * @param {string} newLimit Hạn mức mới
 * @param {string} initialHash Hash của dữ liệu lúc bắt đầu sửa
 * @returns {Promise<Object>}
 */
export const updateCreditLimit = async (serverName, accountId, newLimit, initialHash) => {
  try {
    const payload = { new_limit: newLimit, initial_hash: initialHash };
    const response = await apiClient.put(`/servers/${serverName}/customers/${accountId}/credit-limit`, payload);
    return response.data;
  } catch (error) {
    console.error('Error updating credit limit:', error);
    throw error;
  }
};

/**
 * Cập nhật trạng thái khóa cho khách hàng
 * @param {string} serverName Tên server
 * @param {string} accountId ID khách hàng
 * @param {string} newStatus Trạng thái mới ('0' hoặc '1')
 * @param {string} initialHash Hash của dữ liệu lúc bắt đầu sửa
 * @returns {Promise<Object>}
 */
export const updateLockStatus = async (serverName, accountId, newStatus, initialHash) => {
  try {
    const payload = { new_lock_status: newStatus, initial_hash: initialHash };
    const response = await apiClient.put(`/servers/${serverName}/customers/${accountId}/lock-status`, payload);
    return response.data;
  } catch (error) {
    console.error('Error updating lock status:', error);
    throw error;
  }
};

/**
 * Lấy danh sách mapping gateways của một server
 * @param {string} serverName - Tên của server
 * @param {string} filterText - Từ khóa để lọc theo tên
 * @returns {Promise<Array>} Danh sách các mapping gateways
 */
export const getMappingGateways = async (serverName, filterText = '') => {
  try {
    const response = await apiClient.get(`/servers/${serverName}/mapping-gateways`, {
      params: {
        filter_text: filterText,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching mapping gateways:', error);
    throw error;
  }
};

/**
 * Lấy danh sách routing gateways của một server
 * @param {string} serverName - Tên của server
 * @param {string} filterText - Từ khóa để lọc theo tên
 * @returns {Promise<Array>} Danh sách các routing gateways
 */
export const getRoutingGateways = async (serverName, filterText = '') => {
  try {
    const response = await apiClient.get(`/servers/${serverName}/routing-gateways`, {
      params: {
        filter_text: filterText,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching routing gateways:', error);
    throw error;
  }
};

// === CÁC HÀM MỚI BẮT ĐẦU TỪ ĐÂY ===

/**
 * Lấy chi tiết một Mapping Gateway
 * @param {string} serverName - Tên server
 * @param {string} mgName - Tên Mapping Gateway
 * @returns {Promise<Object>}
 */
export const getMappingGatewayDetails = async (serverName, mgName) => {
  try {
    const response = await apiClient.get(`/servers/${serverName}/mapping-gateways/${mgName}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching details for MG ${mgName}:`, error);
    throw error;
  }
};

/**
 * Cập nhật một Mapping Gateway
 * @param {string} serverName - Tên server
 * @param {string} mgName - Tên Mapping Gateway
 * @param {Object} payload - Dữ liệu cập nhật
 * @param {string} initialHash - Hash để kiểm tra xung đột
 * @returns {Promise<Object>}
 */
export const updateMappingGateway = async (serverName, mgName, payload, initialHash) => {
    try {
        const response = await apiClient.put(`/servers/${serverName}/mapping-gateways/${mgName}`, {
            payload_update_data: payload,
            initial_hash: initialHash,
        });
        return response.data;
    } catch (error) {
        console.error(`Error updating MG ${mgName}:`, error);
        throw error;
    }
};

/**
 * Lấy chi tiết một Routing Gateway
 * @param {string} serverName - Tên server
 * @param {string} rgName - Tên Routing Gateway
 * @returns {Promise<Object>}
 */
export const getRoutingGatewayDetails = async (serverName, rgName) => {
  try {
    const response = await apiClient.get(`/servers/${serverName}/routing-gateways/${rgName}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching details for RG ${rgName}:`, error);
    throw error;
  }
};

/**
 * Cập nhật một Routing Gateway
 * @param {string} serverName - Tên server
 * @param {string} rgName - Tên Routing Gateway
 * @param {Object} payload - Dữ liệu cập nhật
 * @param {string} initialHash - Hash để kiểm tra xung đột
 * @returns {Promise<Object>}
 */
export const updateRoutingGateway = async (serverName, rgName, payload, initialHash) => {
    try {
        const response = await apiClient.put(`/servers/${serverName}/routing-gateways/${rgName}`, {
            payload_update_data: payload,
            initial_hash: initialHash,
        });
        return response.data;
    } catch (error) {
        console.error(`Error updating RG ${rgName}:`, error);
        throw error;
    }
};

/** 
* Thêm danh sách số thực vào một Virtual Key trong Routing Gateway
 * @param {string} serverName - Tên server
 * @param {string} rgName - Tên Routing Gateway
 * @param {string} virtualKey - Số ảo (Key)
 * @param {Array<string>} newReals - Danh sách số thực cần thêm
 * @param {string} initialHash - Hash để kiểm tra xung đột
 * @returns {Promise<Object>}
 */
export const addRealNumbersToRule = async (serverName, rgName, virtualKey, newReals, initialHash) => {
  try {
    const payload = { new_reals: newReals, initial_hash: initialHash };
    const response = await apiClient.post(`/servers/${serverName}/routing-gateways/${rgName}/rules/${virtualKey}/reals`, payload);
    return response.data;
  } catch (error) {
    console.error('Error adding reals to rule:', error);
    throw error;
  }
};

/**
 * Tìm kiếm thông tin số điện thoại trên toàn hệ thống
 * @param {Array<string>} numbers - Danh sách số điện thoại cần tra cứu
 * @returns {Promise<Array>} Danh sách kết quả tìm thấy
 */
export const searchNumberInfo = async (numbers) => {
  try {
    const response = await apiClient.post('/search/number-info', { numbers });
    return response.data;
  } catch (error) {
    console.error('Error searching number info:', error);
    throw error;
  }
};

/**
 * Quét các gateway để tìm các số rác cần dọn dẹp
 * @param {Array<string>} numbers - Danh sách số cần quét
 * @returns {Promise<Array>} Danh sách các gateway bị ảnh hưởng
 */
export const scanForCleanup = async (numbers) => {
  try {
    const response = await apiClient.post('/cleanup/scan', { numbers });
    return response.data;
  } catch (error) {
    console.error('Error scanning for cleanup:', error);
    throw error;
  }
};

/**
 * Thực thi lệnh dọn dẹp (Update gateway với danh sách số mới)
 * @param {Array<Object>} tasks - Danh sách các tác vụ dọn dẹp
 * @returns {Promise<Object>} Kết quả từ server
 */
export const executeCleanup = async (tasks) => {
  try {
    const response = await apiClient.post('/cleanup/execute', { tasks });
    return response.data;
  } catch (error) {
    console.error('Error executing cleanup:', error);
    throw error;
  }
};

/**
 * Tìm kiếm định nghĩa Rewrite Rules dựa trên danh sách Virtual Keys
 * @param {Array<string>} keys - Danh sách các số ảo cần tìm
 * @returns {Promise<Array>} Danh sách các định nghĩa tìm thấy
 */
export const searchRewriteRules = async (keys) => {
  try {
    const response = await apiClient.get('/rewrite-rules/search', {
      params: { keys },
      // THÊM ĐOẠN NÀY: Để serialize mảng theo chuẩn FastAPI (keys=a&keys=b)
      paramsSerializer: function(params) {
        const searchParams = new URLSearchParams();
        Object.keys(params).forEach(key => {
          const value = params[key];
          if (Array.isArray(value)) {
            value.forEach(v => searchParams.append(key, v));
          } else {
            searchParams.append(key, value);
          }
        });
        return searchParams.toString();
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error searching rewrite rules:', error);
    throw error;
  }
};

/**
 * Thay thế hoàn toàn danh sách số thực cho một Virtual Key cụ thể
 * @param {string} serverName - Tên server
 * @param {string} rgName - Tên Routing Gateway
 * @param {string} virtualKey - Số ảo cần sửa
 * @param {Array<string>} newRealNumbers - Danh sách số thực MỚI (sẽ đè lên cũ)
 * @param {string} initialHash - Hash để kiểm tra xung đột (nếu có)
 */
export const replaceRealNumbersForRule = async (serverName, rgName, virtualKey, newRealNumbers, initialHash) => {
  try {
    // 1. Lấy thông tin Gateway hiện tại
    const rgDetails = await getRoutingGatewayDetails(serverName, rgName);
    
    // 2. Parse chuỗi rule hiện tại: "key1:val1;val2,key2:val3"
    const currentRulesStr = rgDetails.rewriteRulesInCaller || "";
    const ruleMap = {};
    
    if (currentRulesStr) {
        currentRulesStr.split(',').forEach(segment => {
            const [k, v] = segment.split(':');
            if (k && v) ruleMap[k.trim()] = v.trim();
        });
    }

    // 3. Cập nhật rule cho key đang chọn
    if (newRealNumbers.length === 0) {
        // Nếu danh sách rỗng -> Xóa rule này khỏi map (hoặc để là hetso tùy logic, ở đây ta xóa luôn rule)
        delete ruleMap[virtualKey];
    } else {
        // Nếu có số -> Cập nhật (nối bằng dấu chấm phẩy)
        // Nếu danh sách có 1 phần tử là 'hetso' -> Giữ nguyên
        const valStr = (newRealNumbers.length === 1 && newRealNumbers[0] === 'hetso') 
            ? 'hetso' 
            : newRealNumbers.join(';');
        ruleMap[virtualKey] = valStr;
    }

    // 4. Build lại chuỗi rule tổng
    const newRulesStr = Object.entries(ruleMap)
        .map(([k, v]) => `${k}:${v}`)
        .join(',');

    // 5. Gửi update lên Server
    const payload = {
        ...rgDetails,
        rewriteRulesInCaller: newRulesStr
    };

    const response = await updateRoutingGateway(serverName, rgName, payload, initialHash || rgDetails.hash);
    return response;

  } catch (error) {
    console.error('Error replacing rule:', error);
    throw error;
  }
};