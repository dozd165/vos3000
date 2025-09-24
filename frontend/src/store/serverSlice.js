import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { getServers } from '../api/vosApi';

// Hành động (thunk) để lấy danh sách server từ API
export const fetchServers = createAsyncThunk('servers/fetchServers', async () => {
  const response = await getServers();
  return response;
});

const initialState = {
  list: [],
  // Thay đổi quan trọng nhất là ở đây
  // Đặt giá trị mặc định là 'VOS-01'
  selectedServer: 'VOS-01 (171.244.56.166)', 
  loading: false,
  error: null,
};

const serverSlice = createSlice({
  name: 'servers',
  initialState,
  reducers: {
    // Action để người dùng có thể chọn một server khác
    setSelectedServer(state, action) {
      state.selectedServer = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchServers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchServers.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload;
      })
      .addCase(fetchServers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      });
  },
});

export const { setSelectedServer } = serverSlice.actions;
export default serverSlice.reducer;