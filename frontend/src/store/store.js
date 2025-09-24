import { configureStore } from '@reduxjs/toolkit';
import serverReducer from './serverSlice'; // Import reducer từ slice

export const store = configureStore({
  reducer: {
    // Khai báo rằng "servers" slice sẽ được quản lý bởi serverReducer
    servers: serverReducer,
  },
});