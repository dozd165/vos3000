// frontend/src/pages/RewriteRulePage.jsx
import React, { useState } from 'react';
import { 
  Input, Card, Typography, notification, Spin, Empty, 
  Tag, Badge, Modal, Tabs, Form, Button, Alert, Space, 
  Radio, InputNumber, Divider, Row, Col 
} from 'antd';
import { 
  DatabaseOutlined, NodeIndexOutlined, 
  PhoneOutlined, PlusCircleOutlined, 
  EyeOutlined, SwapOutlined, SearchOutlined, 
  ArrowRightOutlined, CheckCircleOutlined, StopOutlined,
  CopyOutlined
} from '@ant-design/icons';
import PageTitle from '../components/PageTitle';
import { 
  searchRewriteRules, 
  addRealNumbersToRule, 
  replaceRealNumbersForRule 
} from '../api/vosApi';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

// --- COMPONENT CON: StyledTextArea ---
const StyledTextArea = ({ value, onChange, placeholder, rows = 1, onPressEnter, style, autoSize }) => {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{
      borderRadius: '12px',
      backgroundColor: focused ? '#fff' : '#f4f2f2', 
      padding: '8px 16px',
      transition: 'all 0.3s ease',
      boxShadow: focused ? '0 0 0 2px rgba(59, 130, 246, 0.2)' : 'none',
      border: focused ? '1px solid #3b82f6' : '1px solid transparent',
      display: 'flex',
      alignItems: 'center',
      ...style
    }}>
      <TextArea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        autoSize={autoSize} 
        onPressEnter={(e) => {
            if (!e.shiftKey && onPressEnter) {
                e.preventDefault();
                onPressEnter();
            }
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{ 
            backgroundColor: 'transparent', 
            border: 'none', 
            boxShadow: 'none', 
            padding: 0, 
            resize: 'none', 
            width: '100%',
            fontSize: '14px',
            color: '#333'
        }}
        className="naked-textarea"
      />
    </div>
  );
};

const RewriteRulePage = () => {
  // --- STATE DATA ---
  const [groupedData, setGroupedData] = useState({});
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchKeys, setSearchKeys] = useState([]); 
  
  // --- STATE SEARCH ---
  const [mainSearchInput, setMainSearchInput] = useState('');

  // --- STATE MODAL ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentRecord, setCurrentRecord] = useState(null);
  const [activeTab, setActiveTab] = useState('view');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // --- STATE REPLACE LOGIC ---
  const [sourceKeyInput, setSourceKeyInput] = useState('');
  const [sourceNumbers, setSourceNumbers] = useState(null);
  const [isSearchingSource, setIsSearchingSource] = useState(false);
  const [limitCount, setLimitCount] = useState(0);
  const [replaceMode, setReplaceMode] = useState('merge');

  // --- STATE MANUAL ADD ---
  const [manualAddInput, setManualAddInput] = useState('');

  // 1. MAIN SEARCH
  const handleSearch = async () => {
    const value = mainSearchInput;
    if (!value || !value.trim()) return;
    
    const keys = value.split(/[\n,; ]+/).filter(k => k.trim());
    if (keys.length === 0) return;

    setSearchKeys(keys);
    await executeSearch(keys);
  };

  const executeSearch = async (keys) => {
    setLoading(true);
    setHasSearched(true);
    setGroupedData({});
    try {
      const results = await searchRewriteRules(keys);
      const groups = {};
      results.forEach(item => {
        if (!groups[item.virtual_key]) groups[item.virtual_key] = [];
        groups[item.virtual_key].push(item);
      });
      setGroupedData(groups);
    } catch (error) {
      notification.error({ message: 'Search Error', description: error.message });
    } finally {
      setLoading(false);
    }
  };

  // 2. MODAL LOGIC
  const handleOpenModal = (record, tab = 'view') => {
    setCurrentRecord(record);
    setActiveTab(tab);
    setIsModalOpen(true);
    
    // Reset inputs
    setManualAddInput('');
    setSourceKeyInput(`${record.virtual_key}bk`);
    setSourceNumbers(null);
    setLimitCount(0);
    setReplaceMode('merge');

    if (tab === 'replace') {
        autoCheckSourceKey(`${record.virtual_key}bk`, record);
    }
  };

  const handleTabChange = (key) => {
    setActiveTab(key);
    if (key === 'replace' && sourceNumbers === null && currentRecord) {
        autoCheckSourceKey(`${currentRecord.virtual_key}bk`, currentRecord);
    }
  };

  const autoCheckSourceKey = async (keyToSearch, targetRecord) => {
    if (!keyToSearch) return;
    setIsSearchingSource(true);
    setSourceNumbers(null);
    
    try {
        const results = await searchRewriteRules([keyToSearch]);
        const matchedSource = results.find(r => 
            r.server_name === targetRecord.server_name && 
            r.rg_name === targetRecord.rg_name
        );

        if (matchedSource) {
            let nums = matchedSource.reals || [];
            if (matchedSource.is_hetso) nums = ['hetso'];
            setSourceNumbers(nums);
            setLimitCount(nums.length);
            notification.success({ 
                message: 'Source Found', 
                description: `Key "${keyToSearch}" has ${nums.length} numbers.`,
                duration: 2
            });
        } else {
            setSourceNumbers([]); 
        }
    } catch (error) {
        notification.error({ message: 'Source Search Error', description: error.message });
        setSourceNumbers([]);
    } finally {
        setIsSearchingSource(false);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentRecord(null);
  };

  const refreshData = async () => {
    if (searchKeys.length > 0) await executeSearch(searchKeys);
    handleCloseModal();
  };

  // 3. ACTION: REPLACE
  const handleExecuteReplace = async () => {
    if (!sourceNumbers || sourceNumbers.length === 0) return;

    let numbersToTake = sourceNumbers[0] === 'hetso' ? ['hetso'] : sourceNumbers.slice(0, limitCount);
    let finalNumbers = [];

    if (replaceMode === 'overwrite') {
        finalNumbers = numbersToTake;
    } else {
        const currentNums = currentRecord.is_hetso ? [] : currentRecord.reals;
        const combined = [...currentNums, ...numbersToTake];
        const cleanCombined = combined.filter(n => n !== 'hetso');
        if (cleanCombined.length === 0 && numbersToTake[0] === 'hetso') finalNumbers = ['hetso'];
        else finalNumbers = [...new Set(cleanCombined)];
    }

    try {
        setIsSubmitting(true);
        await replaceRealNumbersForRule(
            currentRecord.server_name, currentRecord.rg_name, currentRecord.virtual_key, finalNumbers
        );
        notification.success({ message: 'Update Successful!' });
        await refreshData();
    } catch (error) {
        notification.error({ message: 'Update Failed', description: error.message });
    } finally {
        setIsSubmitting(false);
    }
  };

  // 4. ACTION: MANUAL ADD
  const onAddSubmit = async () => {
    try {
        const newReals = manualAddInput.split(/[\n,; ]+/).filter(n => n.trim());
        if (newReals.length === 0) {
            notification.warning({ message: 'Please enter numbers to add' });
            return;
        }
        setIsSubmitting(true);
        await addRealNumbersToRule(currentRecord.server_name, currentRecord.rg_name, currentRecord.virtual_key, newReals);
        notification.success({ message: 'Added Successfully!' });
        await refreshData();
    } catch (error) {
        notification.error({ message: 'Add Failed', description: error.message });
    } finally {
        setIsSubmitting(false);
    }
  };

  // --- RENDER CARD (MÀU SẮC ĐÃ ĐƯỢC KHÔI PHỤC) ---
  const renderGatewayCard = (record) => {
    const isHetso = record.is_hetso;
    const cardStyle = isHetso ? {
        borderLeft: '5px solid #ff4d4f', // Đỏ đậm
        background: '#fff1f0',           // Nền đỏ nhạt
        borderColor: '#ffa39e'           
    } : {
        borderLeft: '5px solid #52c41a', // Xanh lá đậm
        background: '#f6ffed',           // Nền xanh lá nhạt (ĐÃ SỬA LẠI ĐÚNG MÀU)
        borderColor: '#b7eb8f'           
    };

    return (
        <Card
            hoverable
            onClick={() => handleOpenModal(record, 'view')}
            style={{ 
                width: '100%', 
                borderRadius: '8px', 
                marginBottom: 0,
                ...cardStyle 
            }}
            styles={{ body: { padding: '12px 16px' } }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, paddingRight: 8 }}>
                    <div style={{ marginBottom: 6 }}>
                        <Tag color="blue" style={{ margin: 0, borderRadius: '4px' }}>
                            <DatabaseOutlined style={{ marginRight: 4 }}/> {record.server_name}
                        </Tag>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <NodeIndexOutlined style={{ marginRight: 8, color: '#8c8c8c' }} />
                        <Text strong style={{ fontSize: '14px', color: '#434343' }} ellipsis={{ tooltip: record.rg_name }}>
                            {record.rg_name}
                        </Text>
                    </div>
                </div>
                <div style={{ textAlign: 'center', minWidth: '50px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    {isHetso ? (
                        <div style={{ marginTop: 2 }}>
                            <StopOutlined style={{ fontSize: '22px', color: '#ff4d4f' }} />
                            <div style={{ fontSize: '10px', color: '#ff4d4f', fontWeight: 'bold', marginTop: 2 }}>BLOCKED</div>
                        </div>
                    ) : (
                        <div style={{ marginTop: 2 }}>
                            <Badge 
                                count={record.real_numbers_count} 
                                overflowCount={999} 
                                style={{ backgroundColor: '#52c41a', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} 
                            />
                            <div style={{ fontSize: '10px', color: '#8c8c8c', marginTop: 2 }}>Real Nums</div>
                        </div>
                    )}
                </div>
            </div>
        </Card>
    );
  };

  const modalItems = [
    {
      key: 'view', label: <span><EyeOutlined /> View</span>,
      children: currentRecord && (
        <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
            <div style={{ marginBottom: 16, background: '#fafafa', padding: '8px 12px', borderRadius: 4 }}>
                <Space split={<Divider type="vertical" />}>
                    <Text type="secondary">Key: <Text strong code>{currentRecord.virtual_key}</Text></Text>
                    <Text type="secondary">Total: <Text strong>{currentRecord.is_hetso ? 'Block' : currentRecord.real_numbers_count}</Text></Text>
                </Space>
            </div>
            {currentRecord.is_hetso ? (
                <Empty description={<span style={{ color: '#ff4d4f' }}>GATEWAY BLOCKED (HETSO)</span>} image={<StopOutlined style={{ fontSize: 40, color: '#ffccc7' }} />} />
            ) : (
                <div style={{ padding: '8px', background: '#fff', borderRadius: '8px', border: '1px solid #f0f0f0' }}>
                    <Paragraph 
                        copyable 
                        style={{ fontSize: '14px', fontFamily: 'monospace', color: '#595959', margin: 0, wordBreak: 'break-all' }}
                    >
                        {currentRecord.reals.join(', ')}
                    </Paragraph>
                </div>
            )}
        </div>
      )
    },
    {
      key: 'add', label: <span><PlusCircleOutlined /> Manual Add</span>,
      children: (
        <div style={{ paddingTop: 10 }}>
            <div style={{ marginBottom: 8 }}><Text strong>Paste number list (comma or newline):</Text></div>
            <StyledTextArea 
                value={manualAddInput}
                onChange={(e) => setManualAddInput(e.target.value)}
                placeholder="091xxxx, 092xxxx..."
                rows={6}
            />
            <Button 
                type="primary" 
                icon={<PlusCircleOutlined />} 
                loading={isSubmitting} 
                block 
                style={{ marginTop: 16 }}
                onClick={onAddSubmit}
            >
                Add Numbers
            </Button>
        </div>
      )
    },
    {
      key: 'replace', label: <span><SwapOutlined /> Copy from Source</span>,
      children: (
        <div style={{ paddingTop: 10 }}>
            <div style={{ marginBottom: 16 }}>
                <Text strong>1. Source Key (Same Gateway):</Text>
                <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                        <StyledTextArea 
                            value={sourceKeyInput}
                            onChange={(e) => {
                                setSourceKeyInput(e.target.value);
                                setSourceNumbers(null);
                            }}
                            placeholder="Enter source key..."
                            rows={1}
                            autoSize
                            onPressEnter={() => autoCheckSourceKey(sourceKeyInput, currentRecord)}
                        />
                    </div>
                    <Button 
                        type="primary" 
                        onClick={() => autoCheckSourceKey(sourceKeyInput, currentRecord)} 
                        loading={isSearchingSource}
                        icon={<SearchOutlined />}
                        style={{ height: 'auto', padding: '8px 16px', borderRadius: '12px' }}
                    >
                        Check
                    </Button>
                </div>
            </div>

            {isSearchingSource ? (
                <div style={{ textAlign: 'center', padding: 20 }}><Spin tip="Checking..." /></div>
            ) : sourceNumbers !== null ? (
                sourceNumbers.length > 0 || sourceNumbers[0] === 'hetso' ? (
                    <div style={{ background: '#f6ffed', padding: '12px', borderRadius: '8px', border: '1px solid #b7eb8f' }}>
                        <div style={{ marginBottom: 12 }}>
                            <CheckCircleOutlined style={{ color: '#52c41a' }} /> Found: <b>{sourceNumbers[0] === 'hetso' ? 'BLOCKED' : `${sourceNumbers.length} numbers`}</b>.
                        </div>
                        <Row gutter={[16, 16]} align="middle" style={{ marginBottom: 16 }}>
                            <Col span={12}>
                                <Text type="secondary">Quantity:</Text>
                                <InputNumber 
                                    min={1} 
                                    max={sourceNumbers[0] === 'hetso' ? 1 : sourceNumbers.length} 
                                    value={limitCount} 
                                    onChange={setLimitCount} 
                                    style={{ width: '100%' }} 
                                    disabled={sourceNumbers[0] === 'hetso'}
                                />
                            </Col>
                            <Col span={12}>
                                <Text type="secondary">Action:</Text><br/>
                                <Radio.Group value={replaceMode} onChange={e => setReplaceMode(e.target.value)} size="small" buttonStyle="solid">
                                    <Radio.Button value="merge">Merge</Radio.Button>
                                    <Radio.Button value="overwrite">Overwrite</Radio.Button>
                                </Radio.Group>
                            </Col>
                        </Row>
                        <Button type="primary" danger block icon={<ArrowRightOutlined />} onClick={handleExecuteReplace} loading={isSubmitting}>
                            Execute
                        </Button>
                    </div>
                ) : (
                    <Alert message="Source Key not found." type="warning" showIcon />
                )
            ) : (
                <div style={{ color: '#999', textAlign: 'center', padding: 20 }}>Enter source key to check...</div>
            )}
        </div>
      )
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <style>{`
        .naked-textarea.ant-input:focus { box-shadow: none !important; }
        .naked-textarea::placeholder { color: #bfbfbf; }
      `}</style>
      <div style={{ textAlign: 'center' }}><PageTitle>Rewrite Rules Manager</PageTitle></div>
      
      {/* MAIN SEARCH AREA */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
        <div style={{ width: '100%', maxWidth: '600px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
                <StyledTextArea
                    value={mainSearchInput}
                    onChange={(e) => setMainSearchInput(e.target.value)}
                    placeholder="Enter Virtual Keys (e.g. 160520, 510024...)"
                    rows={1}
                    autoSize={{ minRows: 1, maxRows: 10 }}
                    onPressEnter={handleSearch}
                />
            </div>
            <Button 
                type="primary" 
                icon={<SearchOutlined />} 
                onClick={handleSearch} 
                loading={loading}
                size="large"
                style={{ borderRadius: '12px', height: 'auto', minHeight: '40px' }}
            >
                Search
            </Button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px 20px 10px' }}>
        {loading ? <div style={{ textAlign: 'center', paddingTop: 50 }}><Spin size="large" /></div> :
         !hasSearched ? <div style={{ textAlign: 'center', paddingTop: 50 }}><Empty description="Enter Key to start" /></div> :
         Object.keys(groupedData).length === 0 ? <div style={{ textAlign: 'center', paddingTop: 50 }}><Empty description="No results found" /></div> : (
            Object.entries(groupedData).map(([key, items]) => (
                <Card 
                    key={key} 
                    style={{ marginBottom: 20, borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                    styles={{ body: { padding: '16px' } }}
                    title={
                        <Space>
                            <PhoneOutlined style={{ color: '#1890ff' }} /> 
                            <span style={{ fontSize: '16px' }}>Virtual Key: <Tag color="gold" style={{ fontSize: '15px' }}>{key}</Tag></span>
                            <Badge count={items.length} showZero color="#faad14" title="Gateways Count" />
                        </Space>
                    }
                >
                    <Row gutter={[16, 12]}>
                        {items.map((item, idx) => (
                            <Col span={24} key={`${item.server_name}-${idx}`}>
                                {renderGatewayCard(item)}
                            </Col>
                        ))}
                    </Row>
                </Card>
            ))
        )}
      </div>

      <Modal title={<Space><NodeIndexOutlined /><Text>Gateway Details: <Text code strong>{currentRecord?.rg_name}</Text></Text></Space>} open={isModalOpen} onCancel={handleCloseModal} footer={null} width={550} destroyOnHidden>
        <Tabs activeKey={activeTab} onChange={handleTabChange} items={modalItems} type="line" centered />
      </Modal>
    </div>
  );
};

export default RewriteRulePage;