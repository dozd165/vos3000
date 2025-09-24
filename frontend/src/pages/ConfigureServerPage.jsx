import React, { useState, useEffect } from 'react';
import {
  Tabs, Table, Input, notification, Alert, Card, Spin, Button, Descriptions, Col, Row, Typography, Tag
} from 'antd';
import { useSelector } from 'react-redux';
import { getMappingGateways, getRoutingGateways, getMappingGatewayDetails, getRoutingGatewayDetails } from '../api/vosApi';
import ServerSelector from '../components/ServerSelector';
import PageTitle from '../components/PageTitle';
import { ArrowLeftOutlined } from '@ant-design/icons';

const { Search } = Input;
const { Title } = Typography;

const ConfigureServerPage = () => {
  const selectedServer = useSelector(state => state.servers.selectedServer);

  // State cho danh sách
  const [mgList, setMgList] = useState([]);
  const [rgList, setRgList] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  
  // State mới để quản lý gateway được chọn và chi tiết của nó
  const [selectedMg, setSelectedMg] = useState(null);
  const [selectedRg, setSelectedRg] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    // Reset mọi thứ khi server thay đổi
    if (selectedServer) {
      fetchGateways();
      setSelectedMg(null);
      setSelectedRg(null);
    } else {
      setMgList([]);
      setRgList([]);
      setSelectedMg(null);
      setSelectedRg(null);
    }
  }, [selectedServer]);

  const fetchGateways = async (filterText = '') => {
    if (!selectedServer) return;
    setListLoading(true);
    try {
      const [mgData, rgData] = await Promise.all([
        getMappingGateways(selectedServer, filterText),
        getRoutingGateways(selectedServer, filterText)
      ]);
      setMgList(mgData);
      setRgList(rgData);
    } catch (error) {
      notification.error({ message: 'Error loading gateway lists', description: error.message });
    } finally {
      setListLoading(false);
    }
  };
  
  // Xử lý khi click vào một hàng trong bảng Mapping Gateway
  const handleMgRowClick = async (record) => {
    setDetailLoading(true);
    setSelectedMg(null); // Xóa dữ liệu cũ trước khi fetch
    try {
      const details = await getMappingGatewayDetails(selectedServer, record.name);
      setSelectedMg(details);
    } catch (error) {
      notification.error({ message: `Error fetching details for ${record.name}`, description: error.message });
    } finally {
      setDetailLoading(false);
    }
  };

  // Xử lý khi click vào một hàng trong bảng Routing Gateway
  const handleRgRowClick = async (record) => {
    setDetailLoading(true);
    setSelectedRg(null);
    try {
      const details = await getRoutingGatewayDetails(selectedServer, record.name);
      setSelectedRg(details);
    } catch (error) {
      notification.error({ message: `Error fetching details for ${record.name}`, description: error.message });
    } finally {
      setDetailLoading(false);
    }
  };


  const onSearch = (value) => {
    fetchGateways(value);
  };
  
  // Cấu hình cột cho bảng
  const mgColumns = [
    { title: 'Mapping Gateway Name', dataIndex: 'name', key: 'name', sorter: (a, b) => a.name.localeCompare(b.name) },
    { title: 'Account', dataIndex: 'account', key: 'account', sorter: (a, b) => (a.account || '').localeCompare(b.account || '') },
  ];

  const rgColumns = [
    { title: 'Routing Gateway Name', dataIndex: 'name', key: 'name', sorter: (a, b) => a.name.localeCompare(b.name) },
  ];

  // --- Render Functions ---

  const renderMgDetailView = () => (
    <Spin spinning={detailLoading} tip="Loading Details...">
      <Button 
        icon={<ArrowLeftOutlined />} 
        onClick={() => setSelectedMg(null)} 
        style={{ marginBottom: 16 }}
      >
        Back to Gateway List
      </Button>
      {selectedMg && (
        <>
          <Title level={4}>Operating on MG: <Tag color="blue">{selectedMg.name}</Tag></Title>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={14}>
              <Title level={5}>Mapping Gateway Details</Title>
              <Descriptions bordered column={1} size="small">
                <Descriptions.Item label="Name">{selectedMg.name}</Descriptions.Item>
                <Descriptions.Item label="Account">{selectedMg.account}</Descriptions.Item>
                <Descriptions.Item label="CalloutCallerPrefixes">{selectedMg.calloutCallerPrefixes}</Descriptions.Item>
                <Descriptions.Item label="CalloutCalleePrefixes">{selectedMg.calloutCalleePrefixes}</Descriptions.Item>
                <Descriptions.Item label="Capacity">{selectedMg.capacity}</Descriptions.Item>
                <Descriptions.Item label="Status">
                  <Tag color={selectedMg.lockType === 1 ? 'volcano' : 'green'}>{selectedMg.lockType === 1 ? 'LOCKED' : 'ACTIVE'}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Register Type">{selectedMg.registerType === 1 ? 'Dynamic' : 'Static'}</Descriptions.Item>
                <Descriptions.Item label="Remote IPs">{selectedMg.remoteIps}</Descriptions.Item>
              </Descriptions>
            </Col>
            <Col xs={24} md={10}>
              <Title level={5}>Actions</Title>
              <Card>
                {/* Chúng ta sẽ thêm các form hành động vào đây ở bước sau */}
                <p>Action forms for Add/Delete Prefixes will be here.</p>
              </Card>
            </Col>
          </Row>
        </>
      )}
    </Spin>
  );
  
  const renderRgDetailView = () => (
     <Spin spinning={detailLoading} tip="Loading Details...">
      <Button 
        icon={<ArrowLeftOutlined />} 
        onClick={() => setSelectedRg(null)} 
        style={{ marginBottom: 16 }}
      >
        Back to Gateway List
      </Button>
      {selectedRg && (
        <>
          <Title level={4}>Operating on RG: <Tag color="purple">{selectedRg.name}</Tag></Title>
           <Row gutter={[16, 16]}>
            <Col xs={24} md={14}>
              <Title level={5}>Routing Gateway Details</Title>
              <Descriptions bordered column={1} size="small">
                 {/* Thêm các trường chi tiết của RG tại đây */}
                 <Descriptions.Item label="Name">{selectedRg.name}</Descriptions.Item>
                 <Descriptions.Item label="CallinCallerPrefixes">{selectedRg.callinCallerPrefixes}</Descriptions.Item>
                 <Descriptions.Item label="CallinCalleePrefixes">{selectedRg.callinCalleePrefixes}</Descriptions.Item>
                 <Descriptions.Item label="RewriteRulesInCaller">{selectedRg.rewriteRulesInCaller}</Descriptions.Item>
              </Descriptions>
            </Col>
            <Col xs={24} md={10}>
              <Title level={5}>Actions</Title>
              <Card>
                 {/* Chúng ta sẽ thêm các form hành động vào đây ở bước sau */}
                 <p>Action forms for Rewrite Rules, Prefixes will be here.</p>
              </Card>
            </Col>
          </Row>
        </>
      )}
    </Spin>
  );


  // Nội dung cho từng tab
  const mgTabContent = selectedMg ? renderMgDetailView() : (
    <Table 
      columns={mgColumns} 
      dataSource={mgList} 
      rowKey="name" 
      loading={listLoading} 
      bordered 
      onRow={(record) => ({ onClick: () => handleMgRowClick(record) })}
      rowClassName="clickable-row"
    />
  );

  const rgTabContent = selectedRg ? renderRgDetailView() : (
    <Table 
      columns={rgColumns} 
      dataSource={rgList} 
      rowKey="name" 
      loading={listLoading} 
      bordered 
      onRow={(record) => ({ onClick: () => handleRgRowClick(record) })}
      rowClassName="clickable-row"
    />
  );
  
  const tabItems = [
    {
      key: '1',
      label: `Mapping Gateways (${!selectedMg ? mgList?.length || 0 : 'Detail'})`,
      children: mgTabContent,
    },
    {
      key: '2',
      label: `Routing Gateways (${!selectedRg ? rgList?.length || 0 : 'Detail'})`,
      children: rgTabContent,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ textAlign: 'center' }}>
        <PageTitle>Server Configuration</PageTitle>
      </div>

      <Card style={{ marginBottom: '24px' }} className="raised-card">
        <ServerSelector />
      </Card>

      {selectedServer ? (
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <Card className="raised-card">
            {/* Ẩn thanh tìm kiếm khi đang xem chi tiết */}
            {!selectedMg && !selectedRg && (
              <Search
                placeholder="Filter gateways by name..."
                onSearch={onSearch}
                style={{ marginBottom: 16 }}
                allowClear
              />
            )}
            <Tabs defaultActiveKey="1" items={tabItems} />
          </Card>
        </div>
      ) : (
        <Alert message="Please select a server to view its configuration." type="info" showIcon />
      )}
    </div>
  );
};

export default ConfigureServerPage;