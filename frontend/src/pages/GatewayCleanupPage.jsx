// frontend/src/pages/GatewayCleanupPage.jsx
import React, { useState } from 'react';
import {
  Input, Button, Card, Typography, notification, Tag, Space,
  Alert, Modal, Row, Col, Checkbox, Empty, Tooltip
} from 'antd';
import { 
  ScanOutlined, DeleteOutlined, ExclamationCircleOutlined, 
  CheckCircleFilled, EyeOutlined 
} from '@ant-design/icons';
import PageTitle from '../components/PageTitle';
import { scanForCleanup, executeCleanup } from '../api/vosApi';

const { TextArea } = Input;
const { Text, Title } = Typography;

const GatewayCleanupPage = () => {
  const [inputNumbers, setInputNumbers] = useState('');
  const [scanResults, setScanResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState(new Set());
  const [hasScanned, setHasScanned] = useState(false);
  
  const [viewDetailRecord, setViewDetailRecord] = useState(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);

  // --- QUAN TRỌNG: Sử dụng hook useModal để fix lỗi không hiện popup ---
  const [modalApi, contextHolder] = Modal.useModal();

  // --- Logic xử lý Input ---
  const getNumberList = () => {
    return inputNumbers
      .split(/[\n,;]+/)
      .map(n => n.trim())
      .filter(n => n.length > 0);
  };

  // --- 1. SCAN PHASE ---
  const handleScan = async () => {
    const numbers = getNumberList();
    if (numbers.length === 0) {
      notification.warning({ message: 'Input required', description: 'Please enter numbers to scan.' });
      return;
    }

    setLoading(true);
    setScanResults([]);
    setSelectedKeys(new Set());
    setHasScanned(true);

    try {
      const results = await scanForCleanup(numbers);
      const resultsWithKey = results.map((item, index) => ({
        ...item,
        key: `${item.server_name}-${item.name}-${index}`, 
      }));
      setScanResults(resultsWithKey);
      
      if (results.length > 0) {
        notification.success({ message: 'Scan Complete', description: `Found ${results.length} affected gateways.` });
        setSelectedKeys(new Set(resultsWithKey.map(r => r.key)));
      } else {
        notification.info({ message: 'System Clean', description: 'No gateways contain these numbers.' });
      }
    } catch (error) {
      notification.error({ message: 'Scan Failed', description: error.message });
    } finally {
      setLoading(false);
    }
  };

  // --- Logic chọn Card ---
  const toggleSelection = (key) => {
    const newSelection = new Set(selectedKeys);
    if (newSelection.has(key)) {
      newSelection.delete(key);
    } else {
      newSelection.add(key);
    }
    setSelectedKeys(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedKeys.size === scanResults.length) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(scanResults.map(r => r.key)));
    }
  };

  const handleViewDetail = (e, record) => {
    e.stopPropagation();
    setViewDetailRecord(record);
  };

  // --- 2. PREPARE PAYLOAD ---
  const prepareCleanupTask = (record) => {
    let updatedPayload = {};

    if (record.type === 'MG') {
      const originalList = record.original_calloutCallerPrefixes_list || [];
      const toRemove = new Set(record.common_numbers_in_calloutCaller || []);
      const newList = originalList.filter(num => !toRemove.has(num));
      
      updatedPayload = {
        ...record.raw_mg_info,
        calloutCallerPrefixes: newList.join(',')
      };
    } else if (record.type === 'RG') {
      const originalCaller = record.original_callin_caller_prefixes_list || [];
      const removeCaller = new Set(record.common_in_callin_caller || []);
      const newCaller = originalCaller.filter(n => !removeCaller.has(n));

      const originalCallee = record.original_callin_callee_prefixes_list || [];
      const removeCallee = new Set(record.common_in_callin_callee || []);
      const newCallee = originalCallee.filter(n => !removeCallee.has(n));

      const rules = { ...(record.original_rewrite_parsed || {}) };
      const keysToDelete = new Set(record.common_virtual_keys_to_delete || []);
      const valuesToDeleteMap = record.common_real_values_to_delete_map || {};

      let newRulesStringParts = [];
      for (const [key, vals] of Object.entries(rules)) {
        if (keysToDelete.has(key)) continue;

        let finalVals = vals;
        if (valuesToDeleteMap[key]) {
          const valsToRemove = new Set(valuesToDeleteMap[key]);
          finalVals = vals.filter(v => !valsToRemove.has(v));
        }

        if (finalVals.length > 0) {
            const valStr = (finalVals.length === 1 && finalVals[0] === 'hetso') 
                ? 'hetso' 
                : finalVals.join(';');
            newRulesStringParts.push(`${key}:${valStr}`);
        }
      }

      updatedPayload = {
        ...record.raw_rg_info,
        callinCallerPrefixes: newCaller.join(','),
        callinCalleePrefixes: newCallee.join(','),
        rewriteRulesInCaller: newRulesStringParts.join(',')
      };
    }

    return {
      server_name: record.server_name,
      gateway_name: record.name,
      type: record.type,
      updated_payload: updatedPayload
    };
  };

  const handleOpenConfirm = () => {
    if (selectedKeys.size === 0) return;
    setIsConfirmOpen(true);
  };

  // --- 4. THỰC THI (ĐÃ SỬA: DÙNG modalApi ĐỂ HIỂN THỊ POPUP) ---
  const performCleanup = async () => {
    setIsCleaning(true);
    try {
      const selectedRecords = scanResults.filter(r => selectedKeys.has(r.key));
      const tasks = selectedRecords.map(prepareCleanupTask);
      
      await executeCleanup(tasks);
      
      // Đóng modal xác nhận
      setIsConfirmOpen(false);

      // --- HIỂN THỊ POPUP THÀNH CÔNG BẰNG HOOK ---
      let secondsToGo = 5;
      
      // Dùng modalApi thay vì Modal tĩnh
      const successModal = modalApi.success({
        title: 'Cleanup Successfully Completed!',
        content: (
          <div>
            <p>Đã dọn dẹp thành công <b>{selectedRecords.length}</b> gateways.</p>
            <div style={{ 
                marginTop: '10px', 
                padding: '10px', 
                background: '#f5f5f5', 
                borderRadius: '6px',
                maxHeight: '150px',
                overflowY: 'auto',
                border: '1px solid #d9d9d9'
            }}>
                <Text style={{ fontSize: '13px', fontFamily: 'monospace' }}>
                    {selectedRecords.map(r => r.name).join(', ')}
                </Text>
            </div>
            <p style={{ marginTop: '10px', color: '#999', fontSize: '12px' }}>
               Tự động đóng sau {secondsToGo} giây...
            </p>
          </div>
        ),
        width: 500,
        okText: 'Close Now',
      });

      // Logic đếm ngược
      const timer = setInterval(() => {
        secondsToGo -= 1;
        successModal.update({
          content: (
            <div>
              <p>Đã dọn dẹp thành công <b>{selectedRecords.length}</b> gateways.</p>
              <div style={{ 
                  marginTop: '10px', 
                  padding: '10px', 
                  background: '#f5f5f5', 
                  borderRadius: '6px',
                  maxHeight: '150px',
                  overflowY: 'auto',
                  border: '1px solid #d9d9d9'
              }}>
                  <Text style={{ fontSize: '13px', fontFamily: 'monospace' }}>
                      {selectedRecords.map(r => r.name).join(', ')}
                  </Text>
              </div>
              <p style={{ marginTop: '10px', color: '#999', fontSize: '12px' }}>
                 Tự động đóng sau {secondsToGo} giây...
              </p>
            </div>
          ),
        });
      }, 1000);

      setTimeout(() => {
        clearInterval(timer);
        successModal.destroy();
      }, 5000);
      
      // Reset
      setScanResults([]);
      setHasScanned(false);
      setSelectedKeys(new Set());
      setInputNumbers('');

    } catch (error) {
      setIsConfirmOpen(false);
      modalApi.error({
        title: 'Cleanup Failed',
        content: (
          <div>
            <p>Có lỗi xảy ra trong quá trình dọn dẹp:</p>
            <Text type="danger">{error.message}</Text>
          </div>
        )
      });
    } finally {
      setIsCleaning(false);
    }
  };

  // --- Render Card (Giữ nguyên) ---
  const renderCard = (item) => {
    const isSelected = selectedKeys.has(item.key);
    const details = [];
    
    if (item.common_numbers_in_calloutCaller?.length) {
        details.push(<Text type="secondary" key="mg-caller">Caller Prefix: <Text type="danger">{item.common_numbers_in_calloutCaller.length} nums</Text></Text>);
    }
    if (item.common_in_callin_caller?.length) {
        details.push(<Text type="secondary" key="rg-caller">Callin Caller: <Text type="danger">{item.common_in_callin_caller.length} nums</Text></Text>);
    }
    if (item.common_in_callin_callee?.length) {
        details.push(<Text type="secondary" key="rg-callee">Callin Callee: <Text type="danger">{item.common_in_callin_callee.length} nums</Text></Text>);
    }
    if (item.common_virtual_keys_to_delete?.length) {
        details.push(<Text type="secondary" key="rg-key">Virtual Keys: <Text type="danger">{item.common_virtual_keys_to_delete.length} keys</Text></Text>);
    }
    const realRulesCount = Object.keys(item.common_real_values_to_delete_map || {}).length;
    if (realRulesCount > 0) {
        details.push(<Text type="secondary" key="rg-reals">Rewrite Values: <Text type="danger">{realRulesCount} rules</Text></Text>);
    }

    return (
      <Col xs={24} sm={12} md={8} lg={6} key={item.key}>
        <div 
            onClick={() => toggleSelection(item.key)}
            style={{ position: 'relative', height: '100%', cursor: 'pointer' }}
        >
            {isSelected && (
                <div style={{ position: 'absolute', top: -8, right: -8, zIndex: 10 }}>
                    <CheckCircleFilled style={{ fontSize: '24px', color: '#1890ff', background: '#fff', borderRadius: '50%' }} />
                </div>
            )}
            <Card
                hoverable
                style={{ 
                    height: '100%', 
                    borderColor: isSelected ? '#1890ff' : '#d9d9d9',
                    backgroundColor: isSelected ? '#e6f7ff' : '#fff',
                    transition: 'all 0.3s',
                    position: 'relative'
                }}
                bodyStyle={{ padding: '12px' }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        <Tag color="blue" style={{ marginRight: 0 }}>{item.server_name}</Tag>
                        <Tag color={item.type === 'MG' ? 'pink' : 'orange'} style={{ marginRight: 0 }}>{item.type}</Tag>
                    </div>
                    
                    <Tooltip title="View Details">
                        <Button 
                            type="text" 
                            size="small" 
                            icon={<EyeOutlined />} 
                            onClick={(e) => handleViewDetail(e, item)}
                            style={{ minWidth: '24px', height: '24px', padding: 0, marginTop: '-2px', color: '#8c8c8c' }}
                        />
                    </Tooltip>
                </div>
                
                <Title level={5} style={{ margin: '8px 0', fontSize: '15px', wordBreak: 'break-word', minHeight: '45px' }}>
                    {item.name}
                </Title>
                
                <Space direction="vertical" size={2} style={{ width: '100%' }}>
                    <div style={{ borderTop: '1px solid #d9d9d940', paddingTop: 8, marginTop: 4 }}>
                        <Text strong style={{ fontSize: '12px', color: '#8c8c8c' }}>MATCHES:</Text>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '13px' }}>
                            {details.length > 0 ? details : <Text type="warning">Complex match</Text>}
                        </div>
                    </div>
                </Space>
            </Card>
        </div>
      </Col>
    );
  };

  // --- Render Modal Detail Content (Giữ nguyên) ---
  const renderDetailContent = () => {
    if (!viewDetailRecord) return null;
    const r = viewDetailRecord;
    const sections = [];

    const renderTags = (list, title) => {
        if (!list || list.length === 0) return null;
        return (
            <div key={title} style={{ marginBottom: 16 }}>
                <Text strong>{title} ({list.length}):</Text>
                <div style={{ marginTop: 8, maxHeight: '100px', overflowY: 'auto', border: '1px solid #f0f0f0', padding: '8px', borderRadius: '4px', background: '#fafafa' }}>
                    {list.map(num => <Tag key={num} color="volcano">{num}</Tag>)}
                </div>
            </div>
        );
    };

    if (r.type === 'MG') {
        sections.push(renderTags(r.common_numbers_in_calloutCaller, 'Callout Caller Prefixes'));
    } else {
        sections.push(renderTags(r.common_in_callin_caller, 'Callin Caller Prefixes'));
        sections.push(renderTags(r.common_in_callin_callee, 'Callin Callee Prefixes'));
        sections.push(renderTags(r.common_virtual_keys_to_delete, 'Virtual Keys to Delete'));
        
        if (r.common_real_values_to_delete_map && Object.keys(r.common_real_values_to_delete_map).length > 0) {
            sections.push(
                <div key="rewrite-vals" style={{ marginBottom: 16 }}>
                    <Text strong>Real Numbers inside Rewrite Rules:</Text>
                    <div style={{ marginTop: 8, maxHeight: '150px', overflowY: 'auto', border: '1px solid #f0f0f0', padding: '8px', borderRadius: '4px', background: '#fafafa' }}>
                        {Object.entries(r.common_real_values_to_delete_map).map(([key, vals]) => (
                            <div key={key} style={{ marginBottom: 4 }}>
                                <Text code>{key}</Text>: {vals.map(v => <Tag key={v} color="volcano">{v}</Tag>)}
                            </div>
                        ))}
                    </div>
                </div>
            );
        }
    }

    return (
        <div>
            <Alert message="Confirm removal" description="These numbers will be removed from the gateway configuration." type="warning" showIcon style={{ marginBottom: 16 }} />
            {sections.length > 0 ? sections : <Empty description="No direct matches found" />}
        </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* --- QUAN TRỌNG: THÊM contextHolder VÀO JSX --- */}
      {contextHolder}

      <div style={{ textAlign: 'center' }}><PageTitle>Gateway Cleanup Tool</PageTitle></div>

      <Card style={{ marginBottom: 20, borderRadius: '8px' }}>
        <Text strong>Step 1: Enter numbers to remove (Trash/Spam numbers):</Text>
        <TextArea
          rows={3}
          value={inputNumbers}
          onChange={(e) => setInputNumbers(e.target.value)}
          placeholder="Example: 84912345678, 0909000111..."
          style={{ marginTop: 10, marginBottom: 15 }}
        />
        <Button 
          type="primary" 
          icon={<ScanOutlined />} 
          onClick={handleScan} 
          loading={loading}
          size="large"
          style={{ borderRadius: '6px' }}
        >
          Scan for Cleanup
        </Button>
      </Card>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {scanResults.length > 0 ? (
          <>
            <div style={{ 
                marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: '#fff', padding: '12px 16px', borderRadius: '8px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}>
                <Space>
                    <Checkbox 
                        checked={selectedKeys.size === scanResults.length && scanResults.length > 0}
                        indeterminate={selectedKeys.size > 0 && selectedKeys.size < scanResults.length}
                        onChange={toggleSelectAll}
                    >
                        Select All
                    </Checkbox>
                    <Text type="secondary">({selectedKeys.size} selected)</Text>
                </Space>
                <Button 
                    type="primary" danger icon={<DeleteOutlined />} 
                    onClick={handleOpenConfirm}
                    disabled={selectedKeys.size === 0 || loading}
                    size="large"
                    style={{ borderRadius: '6px' }}
                >
                    Clean Selected ({selectedKeys.size})
                </Button>
            </div>

            <Row gutter={[16, 16]} style={{ paddingBottom: 20 }}>
                {scanResults.map(renderCard)}
            </Row>
          </>
        ) : (
            hasScanned && !loading && (
               <div style={{ textAlign: 'center', marginTop: 40 }}>
                   <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<Text type="success" strong>No affected gateways found. System is clean!</Text>} />
               </div>
            )
        )}
      </div>

      <Modal
        title={`Details: ${viewDetailRecord?.name}`}
        open={!!viewDetailRecord}
        onCancel={() => setViewDetailRecord(null)}
        footer={[
            <Button key="close" onClick={() => setViewDetailRecord(null)}>Close</Button>
        ]}
      >
        {renderDetailContent()}
      </Modal>

      <Modal
        title={
            <Space>
                <ExclamationCircleOutlined style={{ color: '#faad14' }} />
                <span>Clean {selectedKeys.size} Selected Gateways?</span>
            </Space>
        }
        open={isConfirmOpen}
        onOk={performCleanup}
        onCancel={() => setIsConfirmOpen(false)}
        okText="Yes, Clean Now"
        okType="danger"
        confirmLoading={isCleaning}
        cancelButtonProps={{ disabled: isCleaning }}
      >
        <p>This action will permanently remove the scanned numbers from the selected gateways.</p>
        <p>Are you sure you want to proceed?</p>
      </Modal>
    </div>
  );
};

export default GatewayCleanupPage;