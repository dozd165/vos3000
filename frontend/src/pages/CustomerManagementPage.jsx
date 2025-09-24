import React, { useState } from 'react';
import { Typography, notification, Empty } from 'antd';
import SearchInput from '../components/SearchInput';
import CustomerTable from '../components/CustomerTable';
import CustomerDetailsModal from '../components/CustomerDetailsModal';
import EditCreditLimitModal from '../components/EditCreditLimitModal';
import { searchCustomers, getCustomerDetails } from '../api/vosApi';
import PageTitle from '../components/PageTitle'; // <-- DÒNG IMPORT BỊ THIẾU

const { Text } = Typography;

const CustomerManagementPage = () => {
  const [customers, setCustomers] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [isDetailsModalOpen, setDetailsModalOpen] = useState(false);
  const [isEditLimitModalOpen, setEditLimitModalOpen] = useState(false);
  const [customerDetails, setCustomerDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [lastSearch, setLastSearch] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleCustomerSearch = async (filterText) => {
    setSearchLoading(true);
    setHasSearched(true);
    setLastSearch({ filterText });
    try {
      const results = await searchCustomers('account_id', filterText);
      setCustomers(results);
      if (results.length === 0) {
        notification.info({
          message: 'No Results',
          description: 'No customers found matching your criteria.'
        });
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

  const handleUpdateSuccess = () => {
    setDetailsModalOpen(false);
    setEditLimitModalOpen(false);
    if (lastSearch) {
      handleCustomerSearch(lastSearch.filterText);
    }
  };

  const handleOpenEditLimit = () => {
    setDetailsModalOpen(false);
    setEditLimitModalOpen(true);
  };

  const renderMainContent = () => {
    if (!hasSearched) {
      return (
        <div style={{ textAlign: 'center', paddingTop: '50px' }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={<Text type="secondary">Please enter an Account ID to start searching</Text>}
          />
        </div>
      );
    }
    return <CustomerTable customers={customers} loading={searchLoading} onRowClick={handleRowClick} />;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ textAlign: 'center' }}>
        <PageTitle>Customer Management</PageTitle>
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'center', margin: '24px 0', flexShrink: 0 }}>
        <SearchInput
          onSearch={handleCustomerSearch}
          loading={searchLoading}
          placeholder="Enter Account ID to search..."
        />
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {renderMainContent()}
      </div>
      
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