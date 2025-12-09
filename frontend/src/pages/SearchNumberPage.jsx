// frontend/src/pages/SearchNumberPage.jsx
import React, { useState } from 'react';
import {
  Table,
  Input,
  Button,
  Card,
  Typography,
  notification,
  Tag,
  Space,
  Alert
} from 'antd';
import { SearchOutlined, ClearOutlined } from '@ant-design/icons';
import PageTitle from '../components/PageTitle';
import { searchNumberInfo } from '../api/vosApi';

const { TextArea } = Input;
const { Text, Paragraph } = Typography;

// --- Component hiển thị Text thông minh ---
const ExpandableText = ({ text, maxLength = 100 }) => {
  const [expanded, setExpanded] = useState(false);

  if (!text) return <Text disabled>N/A</Text>;

  // Nếu text ngắn hơn ngưỡng, hiển thị luôn (kèm nút copy)
  if (text.length <= maxLength) {
    return (
      <Paragraph style={{ marginBottom: 0 }} copyable>
        {text}
      </Paragraph>
    );
  }

  // Nếu text dài, cắt ngắn thủ công để tránh giật lag
  return (
    <div>
      <Paragraph 
        style={{ marginBottom: 0, display: 'inline' }} 
        copyable={{ text: text }} // Copy luôn lấy text gốc đầy đủ
      >
        {expanded ? text : `${text.substring(0, maxLength)}... `}
      </Paragraph>
      <a
        style={{ marginLeft: 8, fontSize: '13px', whiteSpace: 'nowrap', userSelect: 'none' }}
        onClick={(e) => {
          e.preventDefault();
          setExpanded(!expanded);
        }}
      >
        {expanded ? 'less' : 'more'}
      </a>
    </div>
  );
};

const SearchNumberPage = () => {
  const [inputNumbers, setInputNumbers] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!inputNumbers.trim()) {
      notification.warning({ message: 'Input required', description: 'Please enter at least one number.' });
      return;
    }

    setLoading(true);
    setHasSearched(true);
    setResults([]);

    try {
      const numberList = inputNumbers
        .split(/[\n,;]+/)
        .map(n => n.trim())
        .filter(n => n.length > 0);

      if (numberList.length === 0) {
        notification.warning({ message: 'No valid numbers found.' });
        setLoading(false);
        return;
      }

      const data = await searchNumberInfo(numberList);
      setResults(data);
      
      if (data.length === 0) {
        notification.info({ message: 'No matches found', description: 'These numbers do not appear in any configuration.' });
      } else {
        notification.success({ message: 'Search completed', description: `Found ${data.length} matches.` });
      }

    } catch (error) {
      notification.error({ 
        message: 'Search Failed', 
        description: error.response?.data?.detail || error.message 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setInputNumbers('');
    setResults([]);
    setHasSearched(false);
  };

  // Cấu hình Cột
  const columns = [
    {
      title: 'Server',
      dataIndex: 'Server',
      key: 'Server',
      width: 120,
      render: (text) => <Tag color="blue">{text}</Tag>,
      sorter: (a, b) => a.Server.localeCompare(b.Server),
    },
    {
      title: 'Type',
      dataIndex: 'Type',
      key: 'Type',
      width: 80,
      align: 'center',
      render: (text) => (
        <Tag color={text === 'MG' ? 'pink' : 'orange'}>
          {text}
        </Tag>
      ),
      filters: [
        { text: 'MG', value: 'MG' },
        { text: 'RG', value: 'RG' },
      ],
      onFilter: (value, record) => record.Type === value,
    },
    {
      title: 'Gateway Name',
      dataIndex: 'Gateway Name',
      key: 'GatewayName',
      width: 250,
      render: (text) => <Text strong style={{ color: '#1677ff' }}>{text}</Text>,
      sorter: (a, b) => a['Gateway Name'].localeCompare(b['Gateway Name']),
    },
    {
      title: 'Matched Input',
      dataIndex: 'Matching Original Inputs',
      key: 'MatchingInput',
      // Đã tăng maxLength lên 100 theo yêu cầu
      render: (text) => <ExpandableText text={text} maxLength={88} />,
    },
    {
      title: 'Context',
      dataIndex: 'Rewrite Key Context',
      key: 'Context',
      width: 150,
      align: 'center',
      render: (text) => text !== 'N/A' ? <Tag color="cyan" style={{ fontSize: '13px' }}>{text}</Tag> : <Text disabled>-</Text>,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ textAlign: 'center' }}>
        <PageTitle>Number Information Search</PageTitle>
      </div>

      <Card style={{ marginBottom: 20, borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <Text strong>Enter numbers to search (one per line or comma-separated):</Text>
        <TextArea
          rows={4}
          value={inputNumbers}
          onChange={(e) => setInputNumbers(e.target.value)}
          placeholder="Example: 0912345678, 84909999999"
          style={{ marginTop: 10, marginBottom: 15, borderRadius: '6px' }}
        />
        <Space>
          <Button 
            type="primary" 
            icon={<SearchOutlined />} 
            onClick={handleSearch} 
            loading={loading}
            size="large"
            style={{ borderRadius: '6px' }}
          >
            Search
          </Button>
          <Button 
            icon={<ClearOutlined />} 
            onClick={handleClear}
            disabled={loading}
            size="large"
            style={{ borderRadius: '6px' }}
          >
            Clear
          </Button>
        </Space>
      </Card>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {results.length > 0 && (
          <Table
            columns={columns}
            dataSource={results}
            rowKey={(record, index) => `${record.Server}-${record['Gateway Name']}-${index}`}
            pagination={{ pageSize: 10, showSizeChanger: true }}
            bordered
            size="middle"
            scroll={{ x: 800 }}
            style={{ borderRadius: '8px', overflow: 'hidden' }}
          />
        )}
        
        {hasSearched && results.length === 0 && !loading && (
           <Alert message="No data found." description="Try searching with a different format or checking your input." type="info" showIcon />
        )}
      </div>
    </div>
  );
};

export default SearchNumberPage;