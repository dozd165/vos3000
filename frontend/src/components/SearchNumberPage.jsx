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
const { Text } = Typography;

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
    setResults([]); // Clear old results

    try {
      // Tách chuỗi nhập vào thành mảng các số
      const numberList = inputNumbers
        .split(/[\n,;]+/) // Tách bằng xuống dòng, dấu phẩy, hoặc chấm phẩy
        .map(n => n.trim())
        .filter(n => n.length > 0); // Loại bỏ chuỗi rỗng

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

  // Cấu hình cột cho bảng kết quả
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
      render: (text) => <Text strong>{text}</Text>,
      sorter: (a, b) => a['Gateway Name'].localeCompare(b['Gateway Name']),
    },
    {
      title: 'Location (Field)',
      dataIndex: 'Field',
      key: 'Field',
      render: (text) => <Text type="secondary">{text}</Text>,
    },
    {
      title: 'Found Value',
      dataIndex: 'Found Values',
      key: 'FoundValues',
      render: (text) => <Text code>{text}</Text>,
    },
    {
      title: 'Matched Input',
      dataIndex: 'Matching Original Inputs',
      key: 'MatchingInput',
      render: (text) => <Tag color="green">{text}</Tag>,
    },
    {
      title: 'Context (Rewrite Key)',
      dataIndex: 'Rewrite Key Context',
      key: 'Context',
      render: (text) => text !== 'N/A' ? <Text code>{text}</Text> : <Text disabled>N/A</Text>,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ textAlign: 'center' }}>
        <PageTitle>Number Information Search</PageTitle>
      </div>

      <Card style={{ marginBottom: 20 }}>
        <Text strong>Enter numbers to search (one per line or comma-separated):</Text>
        <TextArea
          rows={4}
          value={inputNumbers}
          onChange={(e) => setInputNumbers(e.target.value)}
          placeholder="Example: 0912345678, 84909999999"
          style={{ marginTop: 10, marginBottom: 15 }}
        />
        <Space>
          <Button 
            type="primary" 
            icon={<SearchOutlined />} 
            onClick={handleSearch} 
            loading={loading}
            size="large"
          >
            Search Everywhere
          </Button>
          <Button 
            icon={<ClearOutlined />} 
            onClick={handleClear}
            disabled={loading}
            size="large"
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
            pagination={{ pageSize: 10 }}
            bordered
            size="middle"
          />
        )}
        
        {hasSearched && results.length === 0 && !loading && (
           <Alert message="No data found." type="info" showIcon />
        )}
      </div>
    </div>
  );
};

export default SearchNumberPage;