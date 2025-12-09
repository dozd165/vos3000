// frontend/src/pages/CustomerManagementPage.jsx
import React, { useState } from 'react';
import { 
  Typography, notification, Empty, Row, Col, Card, 
  Statistic, Tag, Avatar, Spin, Modal 
} from 'antd';
import { 
  UserOutlined, DatabaseOutlined, WalletOutlined,
  CheckCircleFilled, CloseCircleFilled
} from '@ant-design/icons';
import SearchInput from '../components/SearchInput';
import CustomerDetailsModal from '../components/CustomerDetailsModal';
import EditCreditLimitModal from '../components/EditCreditLimitModal';
import { searchCustomers, getCustomerDetails } from '../api/vosApi';
import PageTitle from '../components/PageTitle';

const { Text, Title } = Typography;

const CustomerManagementPage = () => {
  const [customers, setCustomers] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [isDetailsModalOpen, setDetailsModalOpen] = useState(false);
  const [isEditLimitModalOpen, setEditLimitModalOpen] = useState(false);
  const [customerDetails, setCustomerDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [lastSearch, setLastSearch] = useState(null);
  const [hasSearched, setHasScanned] = useState(false);

  // 1. Hook Modal
  const [modalApi, contextHolder] = Modal.useModal();

  const formatCurrency = (value) => {
    if (typeof value !== 'number') return 'N/A';
    return new Intl.NumberFormat('vi-VN').format(value);
  };

  // 2. Hàm hiển thị Popup Thành công chung (Simplified)
  const showSuccessPopup = (accountName) => {
    let secondsToGo = 3;
    const instance = modalApi.success({
      title: 'Action Completed', // Tiêu đề chung
      content: (
        <div>
          <div style={{ fontSize: '16px', marginBottom: '8px' }}>
             Successfully updated account: <b>{accountName}</b>
          </div>
          <div style={{ color: '#999', fontSize: '12px' }}>Auto-close in {secondsToGo}s...</div>
        </div>
      ),
      width: 400,
      okText: 'Close',
    });

    const timer = setInterval(() => {
      secondsToGo -= 1;
      instance.update({
        content: (
          <div>
            <div style={{ fontSize: '16px', marginBottom: '8px' }}>
               Successfully updated account: <b>{accountName}</b>
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

  const handleCustomerSearch = async (filterText) => {
    setSearchLoading(true);
    setHasScanned(true);
    setLastSearch({ filterText });
    setCustomers([]); 
    try {
      const results = await searchCustomers('account_id', filterText);
      setCustomers(results);
      if (results.length === 0) {
        notification.info({ message: 'No Results', description: 'No customers found.' });
      }
    } catch (error) {
      notification.error({ message: 'Search Error' });
    } finally {
      setSearchLoading(false);
    }
  };

  const handleRowClick = async (record) => {
    setDetailsModalOpen(true);
    setDetailsLoading(true);
    try {
      const details = await getCustomerDetails(record.ServerName, record.AccountID);
      setCustomerDetails(details);
    } catch (error) {
      notification.error({ message: 'Error loading customer details' });
      setCustomerDetails(null);
    } finally {
      setDetailsLoading(false);
    }
  };

  // 3. Xử lý khi Update thành công (nhận accountName từ modal con)
  const handleUpdateSuccess = (data) => {
    setDetailsModalOpen(false);
    setEditLimitModalOpen(false);
    
    // Refresh list
    if (lastSearch) handleCustomerSearch(lastSearch.filterText);

    // Hiện popup nếu có tên account
    if (data && data.account) {
        showSuccessPopup(data.account);
    }
  };

  const handleOpenEditLimit = () => {
    setDetailsModalOpen(false);
    setEditLimitModalOpen(true);
  };

  const renderCustomerCard = (customer) => {
    const isLocked = customer.Status === 'Locked';
    const isUnlimited = customer.CreditLimitRaw === -1 || customer.CreditLimitRaw === 'Unlimited';
    const themeColor = isLocked ? '#ff4d4f' : '#52c41a';
    const bgColor = isLocked ? '#fff1f0' : '#fff';

    return (
      <Col span={24} key={`${customer.ServerName}-${customer.AccountID}`}>
        <Card
          hoverable
          onClick={() => handleRowClick(customer)}
          style={{
            borderRadius: '8px', border: '1px solid #f0f0f0', marginBottom: '0',
            overflow: 'hidden', position: 'relative', backgroundColor: bgColor
          }}
          bodyStyle={{ padding: '16px 24px' }}
        >
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '6px', backgroundColor: themeColor }} />
            <Row align="middle" gutter={[24, 16]}>
                <Col xs={24} sm={10} md={8} lg={6}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <Avatar size={48} icon={<UserOutlined />} style={{ backgroundColor: themeColor, flexShrink: 0 }} />
                        <div style={{ overflow: 'hidden' }}>
                            <Title level={5} style={{ margin: 0, fontSize: '16px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{customer.AccountID}</Title>
                            <Tag color="blue" icon={<DatabaseOutlined />} style={{ marginTop: 4, marginRight: 0, border: 'none', background: 'rgba(24, 144, 255, 0.1)' }}>{customer.ServerName}</Tag>
                        </div>
                    </div>
                </Col>
                <Col xs={12} sm={7} md={8} lg={9}>
                    <Statistic title={<Text type="secondary" style={{ fontSize: '12px' }}>Balance</Text>} value={customer.BalanceRaw} formatter={formatCurrency} valueStyle={{ fontSize: '16px', fontWeight: 600, color: customer.BalanceRaw < 0 ? '#cf1322' : '#3f8600' }} />
                </Col>
                <Col xs={12} sm={7} md={8} lg={9}>
                    <Statistic title={<Text type="secondary" style={{ fontSize: '12px' }}>Credit Limit</Text>} value={customer.CreditLimitRaw} formatter={(val) => isUnlimited ? 'Unlimited' : formatCurrency(val)} valueStyle={{ fontSize: '16px', fontWeight: 600, color: '#154e97' }} prefix={isUnlimited ? <WalletOutlined /> : null} />
                </Col>
            </Row>
            <div style={{ position: 'absolute', right: -10, top: -10, opacity: 0.1, transform: 'rotate(15deg)' }}>
                {isLocked ? <CloseCircleFilled style={{ fontSize: '100px', color: '#ff4d4f' }} /> : <CheckCircleFilled style={{ fontSize: '100px', color: '#52c41a' }} />}
            </div>
        </Card>
      </Col>
    );
  };

  const renderMainContent = () => {
    if (searchLoading) return <div style={{ textAlign: 'center', paddingTop: '50px' }}><Spin size="large" tip="Searching customers..." /></div>;
    if (!hasSearched) return <div style={{ textAlign: 'center', paddingTop: '50px' }}><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<Text type="secondary">Please enter an Account ID to start searching</Text>} /></div>;
    if (customers.length === 0) return <div style={{ textAlign: 'center', paddingTop: '50px' }}><Empty description={<Text>No customers found.</Text>} /></div>;
    return <div style={{ padding: '0 4px 20px 4px' }}><Row gutter={[0, 12]}>{customers.map(renderCustomerCard)}</Row></div>;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {contextHolder}
      <div style={{ textAlign: 'center' }}><PageTitle>Customer Management</PageTitle></div>
      <div style={{ display: 'flex', justifyContent: 'center', margin: '0 0 24px 0', flexShrink: 0 }}>
        <SearchInput onSearch={handleCustomerSearch} loading={searchLoading} placeholder="Enter Account ID to search..." />
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>{renderMainContent()}</div>
      
      <CustomerDetailsModal
        open={isDetailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        customer={customerDetails}
        loading={detailsLoading}
        onUpdateSuccess={handleUpdateSuccess}
        onOpenEditLimit={handleOpenEditLimit}
      />
      <EditCreditLimitModal
        open={isEditLimitModalOpen}
        onClose={() => setEditLimitModalOpen(false)}
        customer={customerDetails}
        onUpdateSuccess={handleUpdateSuccess}
      />
    </div>
  );
};

export default CustomerManagementPage;