import React, { useState, useEffect } from 'react';
import {
  Tabs, Table, Input, notification, Alert, Card, Spin, Descriptions, Col, Row, Typography, Tag,
} from 'antd';
import { useSelector } from 'react-redux';
import { getMappingGateways, getRoutingGateways, getMappingGatewayDetails, getRoutingGatewayDetails } from '../api/vosApi';
import ServerSelector from '../components/ServerSelector';
import PageTitle from '../components/PageTitle';
import { ArrowLeftOutlined } from '@ant-design/icons';
import SearchInput from '../components/SearchInput';
import MappingGatewayActions from '../components/MappingGatewayActions';
import StyledButton from '../components/StyledButton';
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
  const [showFullRules, setShowFullRules] = useState(false);
  const [showFullCallerPrefixes, setShowFullCallerPrefixes] = useState(false);
  const [showFullRewriteRules, setShowFullRewriteRules] = useState(false);
  const [showMgActionView, setShowMgActionView] = useState(false);
  const [showRgActionView, setShowRgActionView] = useState(false);
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
      <div style={{ marginTop: 20, marginBottom: 20 }}></div>
      <StyledButton 
        onClick={() => setSelectedMg(null)}
      >
        Back 
      </StyledButton> 
      <StyledButton 
          onClick={() => setShowMgActionView(true)}
          style={{ marginLeft: '20px' }}
        >
          Action
        </StyledButton>
      {selectedMg && (
        <>
        <div style={{ marginTop: 20, marginBottom: 20 }}></div>
          <Title level={4}>
            Operating on MG:{' '}
            <Tag
              color="pink"
              style={{
                fontSize: '16px',      // chữ to hơn
                padding: '6px 12px',   // tăng vùng nền
                height: 'auto',        // cho phép co giãn
                lineHeight: '20px',    // cân giữa chữ
              }}
            >
              {selectedMg.name}
            </Tag>
            <div style={{ marginTop: 20, marginBottom: 20 }}></div>
          </Title>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={14}>
              <Descriptions
                bordered
                column={1}
                size="middle"        // nhìn gọn hơn size="small"
                labelStyle={{ width: '30%', fontWeight: 500, background: '#fafafa' }}
                contentStyle={{ background: '#fff' }}
              >
                <Descriptions.Item label="Name">
                  <Typography.Text strong>{selectedMg.name}</Typography.Text>
                </Descriptions.Item>
                <Descriptions.Item label="Account">
                  {selectedMg.account}
                </Descriptions.Item>
                <Descriptions.Item label="Callout Caller Prefixes">
                  <Typography.Paragraph copyable ellipsis={{ rows: 2 }}>
                    {selectedMg.calloutCallerPrefixes}
                  </Typography.Paragraph>
                </Descriptions.Item>
                <Descriptions.Item label="Callout Callee Prefixes">
                  <Typography.Paragraph copyable ellipsis={{ rows: 2 }}>
                    {selectedMg.calloutCalleePrefixes}
                  </Typography.Paragraph>
                </Descriptions.Item>
                <Descriptions.Item label="Capacity">
                  {selectedMg.capacity}
                </Descriptions.Item>
                <Descriptions.Item label="Status">
                  <Tag color={selectedMg.lockType === 1 ? 'volcano' : 'green'}>
                    {selectedMg.lockType === 1 ? 'LOCKED' : 'ACTIVE'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Register Type">
                  {selectedMg.registerType === 1 ? 'Dynamic' : 'Static'}
                </Descriptions.Item>
                <Descriptions.Item label="Remote IPs">
                  <Typography.Paragraph copyable ellipsis={{ rows: 2 }}>
                    {selectedMg.remoteIps}
                  </Typography.Paragraph>
                </Descriptions.Item>
              </Descriptions>
            </Col>
          </Row>
        </>
      )}
    </Spin>
  );
  
  const renderRgDetailView = () => (
     <Spin spinning={detailLoading} tip="Loading Details...">
      <div style={{ marginTop: 20, marginBottom: 20 }}></div>
      <StyledButton 
        icon={<ArrowLeftOutlined />} 
        onClick={() => setSelectedRg(null)} 
        style={{ marginBottom: 16 }}
      >
        Back 
      </StyledButton>
      {selectedRg && (
        <>
        <div style={{ marginTop: 20, marginBottom: 20 }}></div>
          <Title level={4}>
            Operating on RG:{' '}
            <Tag
              color="orange"
              style={{
                fontSize: '16px',      // chữ to hơn
                padding: '6px 12px',   // tăng vùng nền
                height: 'auto',        // cho phép co giãn
                lineHeight: '20px',    // cân giữa chữ
              }}
            >
              {selectedRg.name}
            </Tag>
            <div style={{ marginTop: 20, marginBottom: 20 }}></div>
          </Title>
           <Row gutter={[16, 16]}>
              <Col xs={24} md={14}>
              <Descriptions
                bordered
                column={1}
                size="middle"        // nhìn gọn hơn size="small"
                labelStyle={{ width: '30%', fontWeight: 500, background: '#fafafa' }}
                contentStyle={{ background: '#fff' }}
              >
                  <Descriptions.Item label="Name">
                    <Typography.Text strong>{selectedRg.name}</Typography.Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="CallinCallerPrefixes">
                    <div
                      style={{
                        maxHeight: showFullCallerPrefixes ? 'none' : '63px',
                        overflow: 'hidden',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {selectedRg.callinCallerPrefixes} {/* đúng field */}
                    </div>
                    <StyledButton
                      type="link"
                      onClick={() => setShowFullCallerPrefixes(!showFullCallerPrefixes)}
                      style={{ padding: 0 }}
                    >
                      {showFullCallerPrefixes ? 'less' : 'more'}
                    </StyledButton>
                  </Descriptions.Item>

                  <Descriptions.Item label="CallinCalleePrefixes">
                    {selectedRg.callinCalleePrefixes}
                  </Descriptions.Item>
                  <Descriptions.Item label="RewriteRulesInCaller">
                    <div
                      style={{
                        maxHeight: showFullRewriteRules ? 'none' : '63px',
                        overflow: 'hidden',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {selectedRg.rewriteRulesInCaller}
                    </div>
                    <StyledButton
                      type="link"
                      onClick={() => setShowFullRewriteRules(!showFullRewriteRules)}
                      style={{ padding: 0 }}
                    >
                      {showFullRewriteRules ? 'less' : 'more'}
                    </StyledButton>
                  </Descriptions.Item>
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
  const mgTabContent = () => {
    if (!selectedMg) {
      // 1. View danh sách
      return (
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
    } else if (showMgActionView) {
      // 2. View actions MỚI
      return (
        <MappingGatewayActions
          serverInfo={selectedServer}
          gatewayDetails={selectedMg}
          onBack={() => setShowMgActionView(false)}
          onUpdateSuccess={() => {
             // Hàm này sẽ được gọi từ component con để làm mới dữ liệu
             notification.success({ message: 'Gateway updated successfully!' });
             setShowMgActionView(false); // Quay lại trang chi tiết
             handleMgRowClick(selectedMg); // Fetch lại data mới
          }}
        />
      );
    } else {
      // 3. View chi tiết (như cũ)
      return renderMgDetailView();
    }
  };

  const rgTabContent = () => {
    if (!selectedRg) {
        return (
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
     } else if (showRgActionView) {
        // return (
        //     <RoutingGatewayActions 
        //         // ... props tương tự
        //     />
        // );
        return <div>Routing Gateway Actions Component will be here.</div>
    } else {
        return renderRgDetailView();
    }
  };
  const tabItems = [
    {
      key: '1',
      label: `Mapping Gateways (${!selectedMg ? mgList?.length || 0 : (showMgActionView ? 'Actions' : 'Detail')})`,
      children: mgTabContent(), // Gọi hàm để nhận JSX
    },
    {
      key: '2',
      label: `Routing Gateways (${!selectedRg ? rgList?.length || 0 : (showRgActionView ? 'Actions' : 'Detail')})`,
      children: rgTabContent(), // Gọi hàm để nhận JSX
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ textAlign: 'center' }}>
        <PageTitle>Server Configuration</PageTitle>
      </div> 
            <div className="inline-selector-container">
                <Typography.Text style={{ 
                    fontFamily: 'Poppins, sans-serif', 
                    fontSize: '20px', 
                    fontWeight: '500', 
                    color: '#000000ff' 
                }}>
                    You want to config this:
                </Typography.Text>
                <ServerSelector />
            </div>
        {selectedServer ? (
        <div style={{ flex: 1, overflow: 'auto', paddingTop: '20px' }}>
          
          {/* Kiểm tra xem có đang ở chế độ xem chi tiết không */}
          {selectedMg || selectedRg ? (
            // Nếu CÓ, chỉ hiển thị nội dung chi tiết mà không có Tabs
            // Nội dung này được lấy từ các hàm mgTabContent() hoặc rgTabContent()
            <>
              {selectedMg ? mgTabContent() : rgTabContent()}
            </>
          ) : (
            // Nếu KHÔNG, hiển thị thanh tìm kiếm và Tabs như cũ
            <>
              <div style={{ marginBottom: 20 }}>
                <SearchInput
                  placeholder="Filter gateways by name..."
                  onSearch={onSearch}
                  style={{ marginBottom: 16 }}
                  allowClear
                />
              </div>
              <Tabs defaultActiveKey="1" items={tabItems} />
            </>
          )}

        </div>
      ) : (
        <Alert message="Please select a server to view its configuration." type="info" showIcon />
      )}
    </div>
  );
};

export default ConfigureServerPage;