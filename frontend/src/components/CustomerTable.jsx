import React from 'react';
import { Table, Tag } from 'antd';

const CustomerTable = ({ customers, loading, onRowClick }) => {
  const formatCurrency = (value) => {
    if (typeof value !== 'number') return 'N/A';
    return new Intl.NumberFormat('vi-VN').format(value);
  };

  const columns = [
    {
      title: 'Account ID',
      dataIndex: 'AccountID',
      key: 'AccountID',
      sorter: (a, b) => a.AccountID.localeCompare(b.AccountID),
      align: 'center', // Căn giữa
    },
    {
      title: 'Server',
      dataIndex: 'ServerName',
      key: 'ServerName',
      sorter: (a, b) => a.ServerName.localeCompare(b.ServerName),
      align: 'center', // Căn giữa
    },
    {
      title: 'Balance (VND)',
      dataIndex: 'BalanceRaw',
      key: 'balance',
      sorter: (a, b) => a.BalanceRaw - b.BalanceRaw,
      align: 'center', // Căn giữa
      render: (balance) => formatCurrency(balance),
    },
    {
      title: 'Credit Limit (VND)',
      dataIndex: 'CreditLimitRaw',
      key: 'limit',
      sorter: (a, b) => a.CreditLimitRaw - b.CreditLimitRaw,
      align: 'center', // Căn giữa
      render: (limit) => {
        if (limit === -1 || limit === 'Unlimited') {
          return <Tag>Unlimited</Tag>;
        }
        return formatCurrency(limit);
      },
    },
    {
      title: 'Status',
      dataIndex: 'Status',
      key: 'Status',
      align: 'center', // Căn giữa
      render: (status) => (
        <Tag color={status === 'Locked' ? 'volcano' : 'green'}>
          {status.toUpperCase()}
        </Tag>
      ),
    },
  ];

  return (
    <Table
      style={{ marginTop: '24px' }}
      columns={columns}
      dataSource={customers}
      loading={loading}
      rowKey={(record) => `${record.AccountID}-${record.ServerName}`}
      onRow={(record) => ({
        onClick: () => onRowClick(record),
      })}
      rowClassName={() => 'clickable-row'}
      bordered // Thêm thuộc tính này để có đường kẻ
    />
  );
};

export default CustomerTable;