// frontend/src/pages/ConfigureServerPage.jsx
import React, { useState, useEffect } from 'react';
import {
  notification, Alert, Card, Spin, Descriptions, 
  Col, Row, Typography, Tag, Avatar, Modal, Statistic, Button, Empty
} from 'antd';
import { useSelector } from 'react-redux';
import { 
  getMappingGateways, getRoutingGateways, 
  getMappingGatewayDetails, getRoutingGatewayDetails 
} from '../api/vosApi';
import ServerSelector from '../components/ServerSelector';
import PageTitle from '../components/PageTitle';
import SearchInput from '../components/SearchInput';
import MappingGatewayActions from '../components/MappingGatewayActions';
import RoutingGatewayActions from '../components/RoutingGatewayActions';
import StyledRadioGroup from '../components/StyledRadioGroup'; // <-- Import StyledRadioGroup
import { 
  DatabaseOutlined, NodeIndexOutlined, 
  CheckCircleFilled, CloseCircleFilled, 
  PlusOutlined, NumberOutlined 
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

const ConfigureServerPage = () => {
  const selectedServer = useSelector(state => state.servers.selectedServer);

  // Data State
  const [mgList, setMgList] = useState([]);
  const [rgList, setRgList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  
  // View State: 'mg' or 'rg'
  const [viewFilter, setViewFilter] = useState('mg'); 
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('details'); 
  const [selectedGateway, setSelectedGateway] = useState(null); 
  const [detailLoading, setDetailLoading] = useState(false);
  
  const [modalApi, contextHolder] = Modal.useModal();

  useEffect(() => {
    setMgList([]);
    setRgList([]);
    setHasFetched(false);
    setViewFilter('mg');
  }, [selectedServer]);

  // --- API CALLS ---
  const fetchGateways = async (filterText = '') => {
    if (!selectedServer) {
        notification.warning({ message: 'Please select a server first.' });
        return;
    }
    setLoading(true);
    setHasFetched(true); 
    try {
      const [mgData, rgData] = await Promise.all([
        getMappingGateways(selectedServer, filterText),
        getRoutingGateways(selectedServer, filterText)
      ]);
      setMgList(mgData);
      setRgList(rgData);
      
      if (mgData.length === 0 && rgData.length > 0) {
          setViewFilter('rg');
      } else {
          setViewFilter('mg');
      }

    } catch (error) {
      notification.error({ message: 'Error loading gateways', description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const fetchDetailsAndOpen = async (name, type) => {
    setDetailLoading(true);
    setSelectedGateway({ name, type }); 
    setIsModalOpen(true);
    setModalMode('details');

    try {
      let details;
      if (type === 'MG') {
        details = await getMappingGatewayDetails(selectedServer, name);
        details.type = 'MG';
      } else {
        details = await getRoutingGatewayDetails(selectedServer, name);
        details.type = 'RG';
      }
      setSelectedGateway(details);
    } catch (error) {
      notification.error({ message: `Error fetching details for ${name}` });
      setIsModalOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  // --- POPUP SUCCESS ---
  const showSuccessPopup = (gatewayName) => {
    let secondsToGo = 3;
    const instance = modalApi.success({
      title: 'Action Completed',
      content: (
        <div>
          <div style={{ fontSize: '16px', marginBottom: '8px' }}>
             Successfully updated: <b style={{ color: '#52c41a' }}>{gatewayName}</b>
          </div>
          <div style={{ color: '#999', fontSize: '12px' }}>Auto-close in {secondsToGo}s...</div>
        </div>
      ),
      width: 450,
      okText: 'Close',
    });
    const timer = setInterval(() => {
      secondsToGo -= 1;
      instance.update({
        content: (
          <div>
            <div style={{ fontSize: '16px', marginBottom: '8px' }}>
               Successfully updated: <b style={{ color: '#52c41a' }}>{gatewayName}</b>
            </div>
            <div style={{ color: '#999', fontSize: '12px' }}>Auto-close in {secondsToGo}s...</div>
          </div>
        ),
      });
    }, 1000);
    setTimeout(() => {
      clearInterval(timer);
      instance.destroy();
    }, 3000);
  };

  const handleActionSuccess = (data) => {
    setModalMode('details'); 
    if (selectedGateway) {
        fetchDetailsAndOpen(selectedGateway.name, selectedGateway.type); 
    }
    const nameToShow = data?.name || selectedGateway?.name;
    showSuccessPopup(nameToShow);
  };

  // --- HELPER RENDERS ---
  const countItems = (str) => str ? str.split(',').filter(Boolean).length : 0;
  
  const renderLongText = (text) => {
    if (!text) return <Text disabled>None</Text>;
    return (
      <Paragraph 
        copyable={{ text }} 
        ellipsis={{ rows: 2, expandable: true, symbol: 'more' }}
        style={{ marginBottom: 0 }}
      >
        {text}
      </Paragraph>
    );
  };

  // --- RENDER CARD ---
  const renderGatewayCard = (item, type) => {
    const isMG = type === 'MG';
    const isLocked = isMG ? (item.lockType === 1 || item.lockType === 3) : false;
    
    const themeColor = isLocked ? '#ff4d4f' : '#52c41a'; 
    const bgColor = isLocked ? '#fff1f0' : '#fff';
    const IconComponent = isMG ? DatabaseOutlined : NodeIndexOutlined;

    const col1Title = 'Caller Prefixes';
    const col1Value = countItems(isMG ? item.calloutCallerPrefixes : item.callinCallerPrefixes);
    
    const col2Title = isMG ? 'Callee Prefixes' : 'Rewrite Rules';
    const col2Value = countItems(isMG ? item.calloutCalleePrefixes : item.rewriteRulesInCaller);

    return (
      <Col span={24} key={item.name}>
        <Card
          hoverable
          onClick={() => fetchDetailsAndOpen(item.name, type)}
          style={{ 
            borderRadius: '8px', border: '1px solid #f0f0f0', 
            overflow: 'hidden', position: 'relative', 
            backgroundColor: bgColor, marginBottom: 0
          }}
          bodyStyle={{ padding: '16px 24px' }}
        >
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '6px', backgroundColor: themeColor }} />
          <Row align="middle" gutter={[24, 16]}>
             <Col xs={24} sm={8} md={8} lg={6}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <Avatar 
                        shape="square" size={48} icon={<IconComponent />} 
                        style={{ backgroundColor: themeColor, borderRadius: '6px', flexShrink: 0 }} 
                    />
                    <div style={{ overflow: 'hidden' }}>
                        <Title level={5} ellipsis style={{ margin: 0, fontSize: '16px' }}>{item.name}</Title>
                        {isMG && item.account && <Text type="secondary" style={{ fontSize: '13px' }}>{item.account}</Text>}
                    </div>
                 </div>
             </Col>
             <Col xs={12} sm={8} md={8} lg={9}>
                <Statistic title={<Text type="secondary" style={{fontSize: '12px'}}>{col1Title}</Text>} value={col1Value} valueStyle={{ fontSize: '18px', fontWeight: 600, color: '#595959' }} prefix={<NumberOutlined style={{ fontSize: '14px', color: '#8c8c8c' }}/>} />
             </Col>
             <Col xs={12} sm={8} md={8} lg={9}>
                <Statistic title={<Text type="secondary" style={{fontSize: '12px'}}>{col2Title}</Text>} value={col2Value} valueStyle={{ fontSize: '18px', fontWeight: 600, color: '#595959' }} prefix={isMG ? <NumberOutlined style={{ fontSize: '14px', color: '#8c8c8c' }}/> : <NodeIndexOutlined style={{ fontSize: '14px', color: '#8c8c8c' }}/>} />
             </Col>
          </Row>
          <div style={{ position: 'absolute', right: -10, top: -10, opacity: 0.1, transform: 'rotate(15deg)' }}>
             {isLocked ? <CloseCircleFilled style={{ fontSize: '100px', color: themeColor }} /> : <CheckCircleFilled style={{ fontSize: '100px', color: themeColor }} />}
          </div>
        </Card>
      </Col>
    );
  };

  const renderModalContent = () => {
    if (!selectedGateway) return null;
    
    if (modalMode === 'action') {
       if (selectedGateway.type === 'MG') {
           return <MappingGatewayActions serverInfo={selectedServer} gatewayDetails={selectedGateway} onBack={() => setModalMode('details')} onUpdateSuccess={handleActionSuccess} />;
       } else {
           return <RoutingGatewayActions serverInfo={selectedServer} gatewayDetails={selectedGateway} onBack={() => setModalMode('details')} onUpdateSuccess={handleActionSuccess} />;
       }
    }

    const isMG = selectedGateway.type === 'MG';
    return (
        <div style={{ padding: '0 8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <Title level={4} style={{ margin: 0 }}>
                    {selectedGateway.name} 
                    <Tag color={isMG ? 'blue' : 'green'} style={{ marginLeft: 10, verticalAlign: 'middle' }}>
                        {isMG ? 'Mapping Gateway' : 'Routing Gateway'}
                    </Tag>
                </Title>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalMode('action')}>Add Prefixes</Button>
            </div>
            <Descriptions bordered column={1} size="small" layout="vertical">
                {isMG ? (
                    <>
                        <Descriptions.Item label="Account">{selectedGateway.account}</Descriptions.Item>
                        <Descriptions.Item label="Status"><Tag color={selectedGateway.lockType === 1 ? 'red' : 'green'}>{selectedGateway.lockType === 1 ? 'LOCKED' : 'ACTIVE'}</Tag></Descriptions.Item>
                        <Descriptions.Item label="Callout Caller Prefixes">{renderLongText(selectedGateway.calloutCallerPrefixes)}</Descriptions.Item>
                        <Descriptions.Item label="Callout Callee Prefixes">{renderLongText(selectedGateway.calloutCalleePrefixes)}</Descriptions.Item>
                    </>
                ) : (
                    <>
                         <Descriptions.Item label="Callin Caller Prefixes">{renderLongText(selectedGateway.callinCallerPrefixes)}</Descriptions.Item>
                         <Descriptions.Item label="Rewrite Rules (Caller)">{renderLongText(selectedGateway.rewriteRulesInCaller)}</Descriptions.Item>
                         <Descriptions.Item label="Callin Callee Prefixes">{renderLongText(selectedGateway.callinCalleePrefixes)}</Descriptions.Item>
                    </>
                )}
            </Descriptions>
        </div>
    );
  };

  const renderContent = () => {
    if (!selectedServer) return <Alert message="Please select a server to view configuration." type="info" showIcon style={{ marginTop: 20 }} />;
    if (!hasFetched) {
        return (
            <div style={{ textAlign: 'center', paddingTop: '80px' }}>
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span>Server <Text strong>{selectedServer}</Text> selected.<br/><Text type="secondary">Enter a name to search, or leave empty and press Search to load gateways.</Text></span>} />
            </div>
        );
    }
    if (loading) return <div style={{ textAlign: 'center', paddingTop: '50px' }}><Spin size="large" tip="Loading data from VOS..." /></div>;
    
    const displayList = viewFilter === 'mg' ? mgList : rgList;
    const itemType = viewFilter === 'mg' ? 'MG' : 'RG';

    return (
        <Row gutter={[0, 12]}>
            {displayList.length > 0 ? (
                displayList.map(item => renderGatewayCard(item, itemType))
            ) : (
                <Col span={24}><Empty description={`No ${viewFilter === 'mg' ? 'Mapping' : 'Routing'} Gateways found`} /></Col>
            )}
        </Row>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {contextHolder}
      <div style={{ textAlign: 'center' }}><PageTitle>Server Configuration</PageTitle></div>
      <div className="inline-selector-container">
          <Text style={{ fontSize: '16px', fontWeight: '500' }}>Select Server:</Text>
          <ServerSelector />
      </div>
      <div style={{ flex: 1, overflow: 'auto', paddingTop: '10px' }}>
         {selectedServer && (
            <div style={{ marginBottom: 16 }}>
                <Row gutter={8}>
                    <Col flex="auto">
                        <SearchInput placeholder="Search gateways..." onSearch={(val) => fetchGateways(val)} loading={loading} allowClear />
                    </Col>
                </Row>
                
                {/* --- SỬ DỤNG STYLED RADIO GROUP --- */}
                {hasFetched && (
                    <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center' }}>
                        <StyledRadioGroup 
                            options={[
                                { label: `Mapping GWs (${mgList.length})`, value: 'mg' },
                                { label: `Routing GWs(${rgList.length})`, value: 'rg' }
                            ]}
                            value={viewFilter}
                            onChange={setViewFilter}
                        />
                    </div>
                )}
            </div>
         )}
         {renderContent()}
      </div>
      <Modal open={isModalOpen} onCancel={() => setIsModalOpen(false)} footer={null} width={700} destroyOnHidden centered title={null} bodyStyle={{ padding: '24px' }}>
         <Spin spinning={detailLoading}>{renderModalContent()}</Spin>
      </Modal>
    </div>
  );
};

export default ConfigureServerPage;