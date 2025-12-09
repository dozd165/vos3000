// frontend/src/components/CustomerDetailsModal.jsx
import React from 'react';
import { Modal, Descriptions, Spin, Alert, Tag, notification } from 'antd';
import { updateLockStatus } from '../api/vosApi';
import StyledButton from './StyledButton';

const CustomerDetailsModal = ({ open, onClose, customer, loading, onUpdateSuccess, onOpenEditLimit }) => {
  
  const handleToggleLock = async () => {
    if (!customer) return;
    try {
      const newStatus = customer.lockType === 1 ? '0' : '1';
      await updateLockStatus(customer._server_name_source, customer.account, newStatus, customer.hash);
      
      // CHỈ CẦN GỬI ACCOUNT LÀ ĐỦ
      onUpdateSuccess({ account: customer.account });
      
    } catch (error) {
      notification.error({ message: 'Error', description: error.response?.data?.detail || 'Update failed.' });
    }
  };
  
  const renderContent = () => {
    if (!customer && !loading) return <Alert message="Could not load customer details." type="error" />;
    const isLocked = customer?.lockType === 1;
    return (
      <Descriptions bordered column={1} size="small">
        <Descriptions.Item label="Account ID">{customer?.account}</Descriptions.Item>
        <Descriptions.Item label="Customer Name">{customer?.name}</Descriptions.Item>
        <Descriptions.Item label="Balance">{new Intl.NumberFormat('vi-VN').format(customer?.money || 0)} VND</Descriptions.Item>
        <Descriptions.Item label="Credit Limit">
          {customer?.limitMoney === -1 ? 'Unlimited' : `${new Intl.NumberFormat('vi-VN').format(customer?.limitMoney)} VND`}
        </Descriptions.Item>
        <Descriptions.Item label="Status">
          <Tag color={isLocked ? 'volcano' : 'green'}>{isLocked ? 'LOCKED' : 'ACTIVE'}</Tag>
        </Descriptions.Item>
      </Descriptions>
    );
  };

  return (
    <Modal
      title={loading || !customer ? "Loading..." : `Customer Details: ${customer.name}`}
      open={open} onCancel={onClose} destroyOnHidden
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%', gap: '8px' }}>
          <StyledButton onClick={onOpenEditLimit} disabled={loading || !customer}>Adjust Credit</StyledButton>
          <StyledButton onClick={handleToggleLock} disabled={loading || !customer} danger={customer?.lockType !== 1}>
            {customer?.lockType === 1 ? 'Unlock' : 'Lock'} Account
          </StyledButton>
          <StyledButton onClick={onClose}>Cancel</StyledButton>
        </div>
      }
    >
      <Spin spinning={loading} tip="Loading Details...">{renderContent()}</Spin>
    </Modal>
  );
};

export default CustomerDetailsModal;