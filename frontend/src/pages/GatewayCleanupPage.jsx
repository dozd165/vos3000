// frontend/src/pages/GatewayCleanupPage.jsx
import React, { useState } from 'react';
import {
  Input, Card, Typography, notification, Tag, Space,
  Modal, Row, Col, Checkbox, Empty, Tooltip, Table
} from 'antd';
// ... (Các import khác giữ nguyên)
import { 
  ScanOutlined, DeleteOutlined, ExclamationCircleOutlined, 
  CheckCircleFilled, TableOutlined
} from '@ant-design/icons';
import PageTitle from '../components/PageTitle';
import StyledButton from '../components/StyledButton';
import { scanForCleanup, executeCleanup } from '../api/vosApi';

const { TextArea } = Input;
const { Text, Title, Paragraph } = Typography;

const GatewayCleanupPage = () => {
  // ... (Giữ nguyên toàn bộ State và Logic Scan/Cleanup) ...
  const [inputNumbers, setInputNumbers] = useState('');
  const [scanResults, setScanResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState(new Set());
  const [hasScanned, setHasScanned] = useState(false);
  const [isTableModalOpen, setIsTableModalOpen] = useState(false); // Modal Table
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [modalApi, contextHolder] = Modal.useModal();

  // ... (Giữ nguyên các hàm handleScan, toggleSelection, prepareCleanupTask, performCleanup...)

  const getNumberList = () => {
    return inputNumbers.split(/[\n,;]+/).map(n => n.trim()).filter(n => n.length > 0);
  };

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

  const toggleSelection = (key) => {
    const newSelection = new Set(selectedKeys);
    if (newSelection.has(key)) newSelection.delete(key);
    else newSelection.add(key);
    setSelectedKeys(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedKeys.size === scanResults.length) setSelectedKeys(new Set());
    else setSelectedKeys(new Set(scanResults.map(r => r.key)));
  };

  const prepareCleanupTask = (record) => {
    let updatedPayload = {};
    if (record.type === 'MG') {
      const originalList = record.original_calloutCallerPrefixes_list || [];
      const toRemove = new Set(record.common_numbers_in_calloutCaller || []);
      const newList = originalList.filter(num => !toRemove.has(num));
      updatedPayload = { ...record.raw_mg_info, calloutCallerPrefixes: newList.join(',') };
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
            const valStr = (finalVals.length === 1 && finalVals[0] === 'hetso') ? 'hetso' : finalVals.join(';');
            newRulesStringParts.push(`${key}:${valStr}`);
        }
      }
      updatedPayload = { ...record.raw_rg_info, callinCallerPrefixes: newCaller.join(','), callinCalleePrefixes: newCallee.join(','), rewriteRulesInCaller: newRulesStringParts.join(',') };
    }
    return { server_name: record.server_name, gateway_name: record.name, type: record.type, updated_payload: updatedPayload };
  };

  const handleOpenConfirm = () => {
    if (selectedKeys.size === 0) return;
    setIsConfirmOpen(true);
  };

  const performCleanup = async () => {
    setIsCleaning(true);
    try {
      const selectedRecords = scanResults.filter(r => selectedKeys.has(r.key));
      const tasks = selectedRecords.map(prepareCleanupTask);
      await executeCleanup(tasks);
      setIsConfirmOpen(false);
      let secondsToGo = 5;
      const successModal = modalApi.success({
        title: 'Cleanup Successfully Completed!',
        content: (
          <div>
            <p>Đã dọn dẹp thành công <b>{selectedRecords.length}</b> gateways.</p>
            <div style={{ marginTop: '10px', padding: '10px', background: '#f5f5f5', borderRadius: '6px', maxHeight: '150px', overflowY: 'auto', border: '1px solid #d9d9d9' }}>
                <Text style={{ fontSize: '13px', fontFamily: 'monospace' }}>{selectedRecords.map(r => r.name).join(', ')}</Text>
            </div>
            <p style={{ marginTop: '10px', color: '#999', fontSize: '12px' }}>Tự động đóng sau {secondsToGo} giây...</p>
          </div>
        ),
        width: 500,
        okText: 'Close Now',
      });
      const timer = setInterval(() => {
        secondsToGo -= 1;
        successModal.update({
          content: (
            <div>
              <p>Đã dọn dẹp thành công <b>{selectedRecords.length}</b> gateways.</p>
              <div style={{ marginTop: '10px', padding: '10px', background: '#f5f5f5', borderRadius: '6px', maxHeight: '150px', overflowY: 'auto', border: '1px solid #d9d9d9' }}>
                  <Text style={{ fontSize: '13px', fontFamily: 'monospace' }}>{selectedRecords.map(r => r.name).join(', ')}</Text>
              </div>
              <p style={{ marginTop: '10px', color: '#999', fontSize: '12px' }}>Tự động đóng sau {secondsToGo} giây...</p>
            </div>
          ),
        });
      }, 1000);
      setTimeout(() => { clearInterval(timer); successModal.destroy(); }, 5000);
      setScanResults([]); setHasScanned(false); setSelectedKeys(new Set()); setInputNumbers('');
    } catch (error) {
      setIsConfirmOpen(false);
      modalApi.error({ title: 'Cleanup Failed', content: (<div><p>Có lỗi xảy ra trong quá trình dọn dẹp:</p><Text type="danger">{error.message}</Text></div>) });
    } finally { setIsCleaning(false); }
  };

  // --- RENDER CARD (GIỮ NGUYÊN) ---
  const renderCard = (item) => {
    const isSelected = selectedKeys.has(item.key);
    const details = [];
    if (item.common_numbers_in_calloutCaller?.length) details.push(<Text key="mg-caller" type="secondary">Caller: <Text type="danger">{item.common_numbers_in_calloutCaller.length}</Text></Text>);
    if (item.common_in_callin_caller?.length) details.push(<Text key="rg-caller" type="secondary">InCaller: <Text type="danger">{item.common_in_callin_caller.length}</Text></Text>);
    if (item.common_in_callin_callee?.length) details.push(<Text key="rg-callee" type="secondary">InCallee: <Text type="danger">{item.common_in_callin_callee.length}</Text></Text>);
    if (item.common_virtual_keys_to_delete?.length) details.push(<Text key="rg-key" type="secondary">V.Keys: <Text type="danger">{item.common_virtual_keys_to_delete.length}</Text></Text>);
    if (Object.keys(item.common_real_values_to_delete_map || {}).length > 0) details.push(<Text key="rg-reals" type="secondary">Rules: <Text type="danger">{Object.keys(item.common_real_values_to_delete_map).length}</Text></Text>);

    return (
      <Col xs={24} sm={12} md={8} lg={6} key={item.key}>
        <div onClick={() => toggleSelection(item.key)} style={{ position: 'relative', height: '100%', cursor: 'pointer' }}>
            {isSelected && (<div style={{ position: 'absolute', top: '-10px', right: '-10px', zIndex: 10 }}><CheckCircleFilled style={{ fontSize: '28px', color: '#52c41a', background: '#fff', borderRadius: '50%' }} /></div>)}
            <Card
                hoverable
                style={{ 
                    height: '100%', borderRadius: '30px', 
                    border: isSelected ? '2px solid #52c41a' : '1px solid #f0f0f0',
                    backgroundColor: isSelected ? '#f6ffed' : '#fff',
                    transition: 'all 0.3s', position: 'relative'
                }}
                bodyStyle={{ padding: '16px' }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        <Tag color="blue" style={{ borderRadius: '12px', margin: 0 }}>{item.server_name}</Tag>
                        <Tag color={item.type === 'MG' ? 'cyan' : 'orange'} style={{ borderRadius: '12px', margin: 0 }}>{item.type}</Tag>
                    </div>
                </div>
                <Title level={5} ellipsis={{ rows: 2 }} style={{ margin: '0 0 12px 0', fontSize: '15px', minHeight: '44px' }}>{item.name}</Title>
                <div style={{ background: '#fafafa', padding: '8px', borderRadius: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '12px' }}>{details.length > 0 ? details : <Text type="warning">Complex match</Text>}</div>
                </div>
            </Card>
        </div>
      </Col>
    );
  };

  // --- RENDER TABLE MODAL CONTENT (CẬP NHẬT LOGIC KEY) ---
  const renderTableContent = () => {
    const flattenedData = [];
    
    scanResults.forEach((r) => {
        const base = { 
            keyBase: `${r.server_name}-${r.name}`, 
            server_name: r.server_name, 
            type: r.type, 
            name: r.name 
        };

        let subIdx = 0;
        const addRow = (keyText, values) => {
            flattenedData.push({
                ...base,
                key: `${base.keyBase}-${subIdx++}`,
                matchKey: keyText, // Key này sẽ hiển thị hoặc trống
                matchValues: values
            });
        };

        // Logic mới:
        // 1. Prefix: Để trống cột Key (matchKey = null/empty)
        // 2. Virtual Key / Rule: Hiển thị Key
        if (r.common_numbers_in_calloutCaller?.length) addRow('', r.common_numbers_in_calloutCaller);
        if (r.common_in_callin_caller?.length) addRow('', r.common_in_callin_caller);
        if (r.common_in_callin_callee?.length) addRow('', r.common_in_callin_callee);
        
        // Virtual Key: Hiển thị key
        if (r.common_virtual_keys_to_delete?.length) {
            r.common_virtual_keys_to_delete.forEach(k => {
                 // Mỗi Virtual Key là một dòng riêng biệt, Key chính là số ảo
                 // Nhưng ở đây là danh sách xóa Key, nên cột Value để trống hoặc hiển thị "Deleted"
                 // Hoặc hiển thị chính nó ở cột Key và Value là "Virtual Key"
                 // Theo yêu cầu: "Key điền số ảo nếu có"
                 addRow(k, ['(Virtual Key Deleted)']); 
            });
        }
        
        // Rewrite Rule: Key là số ảo, Value là số thực
        if (r.common_real_values_to_delete_map) {
            Object.entries(r.common_real_values_to_delete_map).forEach(([k, v]) => {
                addRow(k, v); // Key = Số ảo, Value = Danh sách số thực
            });
        }
    });

    const columns = [
        {
            title: 'Server',
            dataIndex: 'server_name',
            width: 200,
            render: text => <Tag color="blue">{text}</Tag>
        },
        {
            title: 'Type',
            dataIndex: 'type',
            width: 70,
            align: 'center',
            render: text => <Tag color={text === 'MG' ? 'cyan' : 'orange'}>{text}</Tag>
        },
        {
            title: 'Gateway Name',
            dataIndex: 'name',
            width: 200,
            render: text => <Text strong>{text}</Text>
        },
        {
            title: 'Key', // Tiêu đề cột
            dataIndex: 'matchKey',
            width: 100,
            render: text => text ? <Text type="danger" strong>{text}</Text> : <Text disabled>-</Text> // Nếu có text thì đỏ, không thì gạch ngang
        },
        {
            title: 'Matched Numbers',
            dataIndex: 'matchValues',
            render: (values) => (
                <div style={{ maxHeight: '200px', overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
                    <Text>{Array.isArray(values) ? values.join(',') : values}</Text>
                </div>
            )
        }
    ];

    return (
        <Table 
            columns={columns} 
            dataSource={flattenedData} 
            pagination={{ pageSize: 10 }} 
            size="small" 
            bordered 
            scroll={{ y: 500 }} // Scroll dài hơn vì popup to hơn
        />
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <style>{`
        .custom-search-textarea.ant-input:focus,
        .custom-search-textarea.ant-input-focused { border-color: #ffffff !important; box-shadow: 0 0 0 2px #ffffff !important; }
        .custom-search-textarea.ant-input:hover { border-color: #ffffff !important; }
        .naked-textarea.ant-input { background-color: transparent !important; border: none !important; box-shadow: none !important; resize: none; }
        .naked-textarea.ant-input:focus { box-shadow: none !important; }
      `}</style>

      {contextHolder}
      
      <div style={{ textAlign: 'center' }}><PageTitle>Numbers</PageTitle></div>

      <Card style={{ marginBottom: 20, borderRadius: '24px' }}>
        <Text strong>Step 1: Enter numbers to Scan (Find & Cleanup):</Text>
        <div style={{ marginTop: 10, marginBottom: 15, borderRadius: '20px', backgroundColor: isInputFocused ? '#f0eeee' : '#f4f2f2', padding: '8px 12px', transition: 'all 0.3s', boxShadow: isInputFocused ? '0 0 1em #00000013' : 'none', border: '1px solid transparent' }}>
            <TextArea className="naked-textarea" rows={3} value={inputNumbers} onChange={(e) => setInputNumbers(e.target.value)} onFocus={() => setIsInputFocused(true)} onBlur={() => setIsInputFocused(false)} placeholder="Example: 84912345678, 0909000111..." />
        </div>
        <StyledButton type="primary" icon={<ScanOutlined />} onClick={handleScan} loading={loading} size="large" shape="round">Scan for Cleanup</StyledButton>
      </Card>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {scanResults.length > 0 ? (
          <>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '12px 16px', borderRadius: '24px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                <Space>
                    <Checkbox checked={selectedKeys.size === scanResults.length && scanResults.length > 0} indeterminate={selectedKeys.size > 0 && selectedKeys.size < scanResults.length} onChange={toggleSelectAll}>Select All</Checkbox>
                    <Text type="secondary">({selectedKeys.size} selected)</Text>
                </Space>
                <Space>
                    {/* NÚT VIEW TABLE DETAILS */}
                    <StyledButton 
                        icon={<TableOutlined />} 
                        onClick={() => setIsTableModalOpen(true)}
                        shape="round"
                        size="large"
                    >
                        View Details
                    </StyledButton>

                    <StyledButton 
                        icon={<DeleteOutlined />} onClick={handleOpenConfirm} disabled={selectedKeys.size === 0 || loading} size="large" shape="round"
                        style={{ backgroundColor: '#ff4d4f', borderColor: '#ff4d4f', color: '#fff' }}
                    >
                        Clean Selected
                    </StyledButton>
                </Space>
            </div>
            <Row gutter={[16, 16]} style={{ paddingBottom: 20 }}>{scanResults.map(renderCard)}</Row>
          </>
        ) : (hasScanned && !loading && (<div style={{ textAlign: 'center', marginTop: 40 }}><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<Text type="success" strong>No affected gateways found. System is clean!</Text>} /></div>))}
      </div>

      {/* MODAL TABLE RỘNG 1000px */}
      <Modal 
        title="Scan Results Detail" 
        open={isTableModalOpen} 
        onCancel={() => setIsTableModalOpen(false)} 
        width={1000} // <-- RỘNG HẲN
        footer={[<StyledButton key="close" onClick={() => setIsTableModalOpen(false)} shape="round">Close</StyledButton>]}
      >
        {renderTableContent()}
      </Modal>

      <Modal
        title={<Space><ExclamationCircleOutlined style={{ color: '#faad14' }} /><span>Clean {selectedKeys.size} Selected Gateways?</span></Space>}
        open={isConfirmOpen} onOk={performCleanup} onCancel={() => setIsConfirmOpen(false)}
        footer={[
            <StyledButton key="cancel" onClick={() => setIsConfirmOpen(false)} shape="round">Cancel</StyledButton>,
            <StyledButton key="submit" type="primary" danger onClick={performCleanup} loading={isCleaning} shape="round">Yes, Clean Now</StyledButton>
        ]}
      >
        <p>This action will permanently remove the scanned numbers from the selected gateways.</p>
        <p>Are you sure you want to proceed?</p>
      </Modal>
    </div>
  );
};

export default GatewayCleanupPage;