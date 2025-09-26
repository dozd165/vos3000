import React, { useState, useEffect } from 'react';
import { Button, Form, Input, Radio, notification, Spin, Alert, Typography, Space, Tooltip, Card } from 'antd';
import { ArrowLeftOutlined, PlusOutlined, DeleteOutlined, CalculatorOutlined, ReloadOutlined } from '@ant-design/icons';
import { updateMappingGateway } from '../api/vosApi';

const { TextArea } = Input;
const { Text, Title } = Typography;

const MappingGatewayActions = ({ serverInfo, gatewayDetails, onBack, onUpdateSuccess }) => {
  const [form] = Form.useForm();
  const [currentAction, setCurrentAction] = useState(null); // 'count', 'add_delete'
  const [loading, setLoading] = useState(false);
  const [conflictError, setConflictError] = useState(null);

  useEffect(() => {
    // Reset lại form và các trạng thái khi component được hiển thị
    setCurrentAction(null);
    setConflictError(null);
    form.resetFields();
  }, [gatewayDetails, form]);

  const handleFormSubmit = async (values) => {
    if (!values.numbers_input || !values.numbers_input.trim()) {
      notification.warning({ message: 'Input required', description: 'Please enter numbers to process.' });
      return;
    }

    setLoading(true);
    setConflictError(null);

    try {
      const inputNumbers = values.numbers_input.trim().split(/[,\s\n]+/).filter(Boolean);
      const currentPrefixes = gatewayDetails.calloutCallerPrefixes?.split(',').filter(Boolean) || [];
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
        const payload = { ...gatewayDetails, calloutCallerPrefixes: newPrefixes.join(',') };
        
        // Logic xử lý lockType từ file python cũ
        if (values.action_type === 'delete' && newPrefixes.length === 0 && !payload.calloutCalleePrefixes) {
            payload.lockType = 3;
        }

        await updateMappingGateway(serverInfo, gatewayDetails.name, payload, gatewayDetails.hash);
        onUpdateSuccess(); // Gọi hàm callback để báo thành công
      }
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'An unknown error occurred.';
      if (errorMsg.includes('CONFLICT_ERROR')) {
        setConflictError(errorMsg.replace('CONFLICT_ERROR: ', ''));
      } else {
        notification.error({ message: 'Update Failed', description: errorMsg });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReload = () => {
    // Khi có lỗi xung đột, nút này sẽ gọi onUpdateSuccess để fetch lại data mới nhất
    setConflictError(null);
    onUpdateSuccess();
  }

  const prefixCount = gatewayDetails.calloutCallerPrefixes?.split(',').filter(Boolean).length || 0;

  return (
    <Spin spinning={loading}>
      <Button icon={<ArrowLeftOutlined />} onClick={onBack} style={{ marginBottom: 16 }}>
        Back to Details
      </Button>
      <Title level={4}>Actions for MG: <Text type="success">{gatewayDetails.name}</Text></Title>

      {conflictError ? (
         <Alert
          message="Data Conflict"
          description={conflictError}
          type="error"
          showIcon
          action={
            <Button size="small" danger icon={<ReloadOutlined />} onClick={handleReload}>
              Reload Data
            </Button>
          }
        />
      ) : (
        <Card>
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
               <Tooltip title="Count current prefixes">
                  <Button icon={<CalculatorOutlined />} onClick={() => setCurrentAction('count')}>
                      Count Prefixes
                  </Button>
               </Tooltip>
               <Tooltip title="Add or Delete prefixes">
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => setCurrentAction('add_delete')}>
                      Add / Delete Prefixes
                  </Button>
               </Tooltip>
            </div>
            
            {currentAction === 'count' && (
              <Alert message={<Text strong>Total CalloutCallerPrefixes: {prefixCount}</Text>} type="info" />
            )}

            {currentAction === 'add_delete' && (
              <Form form={form} onFinish={handleFormSubmit} layout="vertical" initialValues={{ action_type: 'add' }}>
                <Form.Item name="action_type" label="Action Type">
                  <Radio.Group buttonStyle="solid">
                    <Radio.Button value="add"><PlusOutlined /> Add</Radio.Button>
                    <Radio.Button value="delete"><DeleteOutlined /> Delete</Radio.Button>
                  </Radio.Group>
                </Form.Item>
                <Form.Item 
                  name="numbers_input"
                  label="Enter numbers (separated by comma, space, or newline)"
                  rules={[{ required: true, message: 'Please input numbers!' }]}
                >
                  <TextArea rows={6} placeholder="e.g. 19001, 19002, 19003"/>
                </Form.Item>
                <Form.Item>
                  <Button type="primary" htmlType="submit" block loading={loading}>
                    Confirm and Update
                  </Button>
                </Form.Item>
              </Form>
            )}
          </Space>
        </Card>
      )}
    </Spin>
  );
};

export default MappingGatewayActions;