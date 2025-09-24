import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  list: [], // Sẽ dùng để lưu danh sách server sau này
  selectedServer: null, // Lưu tên server đang được chọn
  status: 'idle', // Trạng thái: idle, loading, succeeded, failed
};

export const serverSlice = createSlice({
  name: 'servers', // Tên của slice này
  initialState,
  // Reducers là các hàm dùng để thay đổi state
  reducers: {
    setSelectedServer: (state, action) => {
      // action.payload sẽ là giá trị được truyền vào (tên server)
      state.selectedServer = action.payload;
    },
    // Chúng ta sẽ thêm các reducers khác ở đây sau
  },
});

// Export các "hành động" (actions) để các component khác có thể sử dụng
export const { setSelectedServer } = serverSlice.actions;

// Export reducer để kết nối vào store chính
export default serverSlice.reducer;