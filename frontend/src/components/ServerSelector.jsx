import React, { useState, useEffect } from 'react';
import { Select, Spin, Alert } from 'antd';
import { getServers } from '../api/vosApi';

// Imports mới cho Redux
import { useDispatch } from 'react-redux';
import { setSelectedServer } from '../store/serverSlice';

const ServerSelector = () => {
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const dispatch = useDispatch(); // Hàm để "gửi" hành động lên store

  useEffect(() => {
    const fetchServers = async () => {
      try {
        const serverData = await getServers();
        setServers(serverData);
      } catch (err) {
        setError('Không thể tải danh sách server từ API.');
      } finally {
        setLoading(false);
      }
    };
    fetchServers();
  }, []);

  const handleServerChange = (value) => {
    // Khi người dùng chọn một server, gửi hành động setSelectedServer
    // với giá trị là tên server (value) lên store
    dispatch(setSelectedServer(value));
  };

  if (loading) return <Spin tip="Đang tải danh sách Server..." />;
  if (error) return <Alert message="Lỗi" description={error} type="error" showIcon />;

  return (
    <Select
      placeholder="Chọn một VOS Server"
      style={{ width: 350 }}
      options={servers.map(server => ({
        label: server.name,
        value: server.name,
      }))}
      onChange={handleServerChange} // <-- GỌI HÀM KHI CÓ THAY ĐỔI
    />
  );
};

export default ServerSelector;