import React, { useState, useEffect } from 'react';
import { Select, Spin, Alert } from 'antd';
import { getServers } from '../api/vosApi';

import { useDispatch, useSelector } from 'react-redux';
import { setSelectedServer } from '../store/serverSlice';

const ServerSelector = () => {
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const dispatch = useDispatch();
  const currentServer = useSelector(state => state.servers.selectedServer);

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
    dispatch(setSelectedServer(value));
  };

  if (loading) return <Spin tip="Đang tải danh sách Server..." />;
  if (error) return <Alert message="Lỗi" description={error} type="error" showIcon />;

  return (
    <Select
      value={currentServer}
      placeholder="Chọn một VOS Server"
      // >>> DÒNG NÀY ĐÃ ĐƯỢC SỬA LẠI <<<
      style={{ minWidth: '350px' }}
      options={servers.map(server => {
        const displayUrl = server.url && typeof server.url === 'string' 
          ? `(${server.url.replace(/^https?:\/\//, '')})` 
          : '';
        
        return {
          label: `${server.name} ${displayUrl}`.trim(),
          value: server.name,
        };
      })}
      onChange={handleServerChange}
      className="custom-server-selector"
      popupClassName="server-select-dropdown"
    />
  );
};

export default ServerSelector;