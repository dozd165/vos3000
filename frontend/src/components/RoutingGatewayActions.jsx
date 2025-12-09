// frontend/src/components/RoutingGatewayActions.jsx
import React, { useState } from 'react';
import { Button, Form, Input, notification, Spin, Typography } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { updateRoutingGateway } from '../api/vosApi';

const { TextArea } = Input;
const { Text, Title } = Typography;

const RoutingGatewayActions = ({ serverInfo, gatewayDetails, onBack, onUpdateSuccess }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values) => {
    if (!values.numbers_input || !values.numbers_input.trim()) {
      notification.warning({ message: 'Input required', description: 'Please enter numbers.' });
      return;
    }

    setLoading(true);
    try {
      const inputNumbers = values.numbers_input.trim().split(/[,\s\n]+/).filter(Boolean);
      // Routing Gateway: Focus on Callin Caller Prefixes for Adding
      const currentPrefixes = gatewayDetails.callinCallerPrefixes 
          ? gatewayDetails.callinCallerPrefixes.split(',').filter(Boolean) 
          : [];
      
      const originalSet = new Set(currentPrefixes);
      let newPrefixes = [...currentPrefixes];
      let addedCount = 0;

      // Logic ADD ONLY
      const toAdd = inputNumbers.filter(num => !originalSet.has(num));
      if (toAdd.length > 0) {
        newPrefixes.push(...toAdd);
        addedCount = toAdd.length;
      }

      if (addedCount > 0) {
        const payload = { 
            ...gatewayDetails, 
            callinCallerPrefixes: newPrefixes.join(',') 
        };
        
        await updateRoutingGateway(serverInfo, gatewayDetails.name, payload, gatewayDetails.hash);
        form.resetFields();
        onUpdateSuccess(); 
      } else {
        notification.info({ message: 'No new numbers added', description: 'All numbers already exist.' });
      }
    } catch (error) {
      notification.error({ message: 'Update Failed', description: error.response?.data?.detail || error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Spin spinning={loading}>
      <Button icon={<ArrowLeftOutlined />} onClick={onBack} style={{ marginBottom: 16 }}>
        Back to Details
      </Button>
      <Title level={4}>Add Prefixes: <Text type="warning">{gatewayDetails.name}</Text></Title>

      <Form form={form} onFinish={handleSubmit} layout="vertical">
        <Form.Item 
            name="numbers_input"
            label="Enter Callin Caller Prefixes (comma, space, or newline separated)"
            rules={[{ required: true, message: 'Please input numbers!' }]}
        >
            <TextArea rows={8} placeholder="e.g. 8491, 8494..."/>
        </Form.Item>
        <Button type="primary" htmlType="submit" block loading={loading} size="large">
            Add Prefixes
        </Button>
      </Form>
    </Spin>
  );
};

export default RoutingGatewayActions;