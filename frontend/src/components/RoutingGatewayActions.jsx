// frontend/src/components/RoutingGatewayActions.jsx
import React, { useState } from 'react';
import { Button, Form, Input, Radio, notification, Spin, Alert, Typography, Space, Tooltip, Card, Tabs } from 'antd';
import { ArrowLeftOutlined, PlusOutlined, DeleteOutlined, CalculatorOutlined, ReloadOutlined, NumberOutlined, EditOutlined } from '@ant-design/icons';
import { updateRoutingGateway, addRealNumbersToRule } from '../api/vosApi';

const { TextArea } = Input;
const { Text, Title } = Typography;

const RoutingGatewayActions = ({ serverInfo, gatewayDetails, onBack, onUpdateSuccess }) => {
  const [formPrefix] = Form.useForm();
  const [formRule] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [conflictError, setConflictError] = useState(null);
  const [currentPrefixAction, setCurrentPrefixAction] = useState(null); // 'count', 'add_delete'

  const handlePrefixSubmit = async (values) => {
    if (!values.numbers_input || !values.numbers_input.trim()) {
      notification.warning({ message: 'Input required', description: 'Please enter numbers.' });
      return;
    }

    setLoading(true);
    setConflictError(null);

    try {
      const inputNumbers = values.numbers_input.trim().split(/[,\s\n]+/).filter(Boolean);
      // Routing Gateway dùng callinCallerPrefixes
      const currentPrefixes = gatewayDetails.callinCallerPrefixes 
          ? gatewayDetails.callinCallerPrefixes.split(',').filter(Boolean) 
          : [];
      
      const originalSet = new Set(currentPrefixes);
      let newPrefixes = [...currentPrefixes];
      let changed = false;

      if (values.action_type === 'add') {
        const toAdd = inputNumbers.filter(num => !originalSet.has(num));
        if (toAdd.length > 0) {
          newPrefixes.push(...toAdd);
          changed = true;
        } else {
          notification.info({ message: 'No new numbers to add.' });
        }
      } else if (values.action_type === 'delete') {
        const toRemoveSet = new Set(inputNumbers);
        const filteredPrefixes = currentPrefixes.filter(p => !toRemoveSet.has(p));
        if (filteredPrefixes.length < currentPrefixes.length) {
          newPrefixes = filteredPrefixes;
          changed = true;
        } else {
          notification.info({ message: 'No matching numbers found to delete.' });
        }
      }

      if (changed) {
        const payload = { 
            ...gatewayDetails, 
            callinCallerPrefixes: newPrefixes.join(',') 
        };
        
        await updateRoutingGateway(serverInfo, gatewayDetails.name, payload, gatewayDetails.hash);
        formPrefix.resetFields(['numbers_input']);
        onUpdateSuccess(); 
      }
    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleRuleSubmit = async (values) => {
      setLoading(true);
      setConflictError(null);
      try {
          const reals = values.real_numbers.trim().split(/[,\s\n]+/).filter(Boolean);
          await addRealNumbersToRule(serverInfo, gatewayDetails.name, values.virtual_key, reals, gatewayDetails.hash);
          notification.success({ message: 'Rewrite Rule Updated', description: `Added ${reals.length} numbers to ${values.virtual_key}` });
          formRule.resetFields(['real_numbers']);
          onUpdateSuccess();
      } catch (error) {
          handleError(error);
      } finally {
          setLoading(false);
      }
  };

  const handleError = (error) => {
    const errorMsg = error.response?.data?.detail || 'An unknown error occurred.';
    if (errorMsg.includes('CONFLICT_ERROR')) {
      setConflictError(errorMsg.replace('CONFLICT_ERROR: ', ''));
    } else {
      notification.error({ message: 'Update Failed', description: errorMsg });
    }
  };

  const handleReload = () => {
    setConflictError(null);
    onUpdateSuccess();
  }

  const prefixCount = gatewayDetails.callinCallerPrefixes?.split(',').filter(Boolean).length || 0;

  // --- TAB CONTENT: PREFIXES ---
  const renderPrefixTab = () => (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
            <Tooltip title="Count Callin Caller Prefixes">
                <Button icon={<CalculatorOutlined />} onClick={() => setCurrentPrefixAction('count')}>
                    Count Prefixes
                </Button>
            </Tooltip>
            <Tooltip title="Modify Callin Caller Prefixes">
                <Button type="primary" icon={<EditOutlined />} onClick={() => setCurrentPrefixAction('add_delete')}>
                    Edit Prefixes
                </Button>
            </Tooltip>
        </div>

        {currentPrefixAction === 'count' && (
            <Alert message={<Text strong>Total CallinCallerPrefixes: {prefixCount}</Text>} type="info" />
        )}

        {currentPrefixAction === 'add_delete' && (
            <Form form={formPrefix} onFinish={handlePrefixSubmit} layout="vertical" initialValues={{ action_type: 'add' }}>
            <Form.Item name="action_type" label="Action Type">
                <Radio.Group buttonStyle="solid">
                <Radio.Button value="add"><PlusOutlined /> Add</Radio.Button>
                <Radio.Button value="delete"><DeleteOutlined /> Delete</Radio.Button>
                </Radio.Group>
            </Form.Item>
            <Form.Item 
                name="numbers_input"
                label="Enter prefixes (separated by comma, space, or newline)"
                rules={[{ required: true, message: 'Please input numbers!' }]}
            >
                <TextArea rows={6} placeholder="e.g. 8491, 8494..."/>
            </Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
                Confirm Update
            </Button>
            </Form>
        )}
    </Space>
  );

  // --- TAB CONTENT: REWRITE RULES ---
  const renderRuleTab = () => (
      <Form form={formRule} onFinish={handleRuleSubmit} layout="vertical">
          <Alert 
            message="Feature: Add Real Numbers" 
            description="Add new real numbers to an existing (or new) Virtual Key. Numbers will be appended." 
            type="info" 
            showIcon 
            style={{ marginBottom: 16 }}
          />
          <Form.Item 
              name="virtual_key" 
              label="Virtual Key (So Ao)" 
              rules={[{ required: true, message: 'Virtual Key is required' }]}
          >
              <Input prefix={<NumberOutlined />} placeholder="e.g. 123456" />
          </Form.Item>
          <Form.Item 
              name="real_numbers" 
              label="Real Numbers to Add" 
              rules={[{ required: true, message: 'Real numbers are required' }]}
          >
              <TextArea rows={4} placeholder="e.g. 0912345678, 0909999999" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
              Add Real Numbers
          </Button>
      </Form>
  );

  const items = [
    { key: '1', label: 'Callin Caller Prefixes', children: renderPrefixTab() },
    { key: '2', label: 'Rewrite Rules', children: renderRuleTab() },
  ];

  return (
    <Spin spinning={loading}>
      <Button icon={<ArrowLeftOutlined />} onClick={onBack} style={{ marginBottom: 16 }}>
        Back to Details
      </Button>
      <Title level={4}>Actions for RG: <Text type="success">{gatewayDetails.name}</Text></Title>

      {conflictError ? (
         <Alert
          message="Data Conflict"
          description={conflictError}
          type="error"
          showIcon
          action={<Button size="small" danger icon={<ReloadOutlined />} onClick={handleReload}>Reload Data</Button>}
        />
      ) : (
        <Card>
            <Tabs defaultActiveKey="1" items={items} />
        </Card>
      )}
    </Spin>
  );
};

export default RoutingGatewayActions;