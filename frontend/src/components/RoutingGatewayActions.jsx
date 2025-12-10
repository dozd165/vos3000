// frontend/src/components/RoutingGatewayActions.jsx
import React, { useState, useMemo } from 'react';
import { Button, Form, Input, notification, Spin, Typography, Alert, Row, Col } from 'antd';
import { ArrowLeftOutlined, CheckCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { updateRoutingGateway } from '../api/vosApi';

const { TextArea } = Input;
const { Text, Title } = Typography;

const RoutingGatewayActions = ({ serverInfo, gatewayDetails, onBack, onUpdateSuccess }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const analysis = useMemo(() => {
    if (!inputValue.trim()) return { newNumbers: [], duplicates: [] };

    const currentPrefixes = gatewayDetails.callinCallerPrefixes 
        ? gatewayDetails.callinCallerPrefixes.split(',').filter(Boolean) 
        : [];
    const currentSet = new Set(currentPrefixes);

    const inputs = inputValue.trim().split(/[,\s\n]+/).filter(Boolean);
    const uniqueInputs = [...new Set(inputs)];

    const duplicates = uniqueInputs.filter(num => currentSet.has(num));
    const newNumbers = uniqueInputs.filter(num => !currentSet.has(num));

    return { newNumbers, duplicates };
  }, [inputValue, gatewayDetails]);

  const handleSubmit = async () => {
    const { newNumbers } = analysis;
    if (newNumbers.length === 0) {
      notification.warning({ message: 'Input required', description: 'Please enter valid new numbers.' });
      return;
    }

    setLoading(true);
    try {
      const currentPrefixes = gatewayDetails.callinCallerPrefixes 
          ? gatewayDetails.callinCallerPrefixes.split(',').filter(Boolean) 
          : [];
      const finalPrefixes = [...currentPrefixes, ...newNumbers];
      const payload = { ...gatewayDetails, callinCallerPrefixes: finalPrefixes.join(',') };
      
      await updateRoutingGateway(serverInfo, gatewayDetails.name, payload, gatewayDetails.hash);
      form.resetFields();
      setInputValue('');
      onUpdateSuccess(); 
      notification.success({ message: 'Success', description: `Added ${newNumbers.length} new prefixes.` });
    } catch (error) {
      notification.error({ message: 'Update Failed', description: error.response?.data?.detail || error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Spin spinning={loading}>
      <Button icon={<ArrowLeftOutlined />} onClick={onBack} style={{ marginBottom: 16 }}>Back to Details</Button>
      <Title level={4}>Add Prefixes (Routing): <Text type="warning">{gatewayDetails.name}</Text></Title>

      <Form form={form} onFinish={handleSubmit} layout="vertical">
        <Form.Item label="Enter Callin Caller Prefixes (comma, space, or newline separated)" required>
            <TextArea rows={6} placeholder="e.g. 8491, 8494..." value={inputValue} onChange={(e) => setInputValue(e.target.value)} />
        </Form.Item>

        {inputValue && (
            <div style={{ marginBottom: 16 }}>
                <Row gutter={[16, 16]}>
                    <Col span={12}>
                        <Alert
                            message="Valid New Numbers"
                            type="success"
                            showIcon
                            icon={<CheckCircleOutlined />}
                            description={<Text strong style={{ fontSize: '18px' }}>{analysis.newNumbers.length}</Text>}
                        />
                    </Col>
                    <Col span={12}>
                        <Alert
                            message="Duplicates (Skipped)"
                            type={analysis.duplicates.length > 0 ? "warning" : "info"}
                            showIcon
                            icon={<WarningOutlined />}
                            description={<Text strong style={{ fontSize: '18px' }}>{analysis.duplicates.length}</Text>}
                        />
                    </Col>
                </Row>
            </div>
        )}

        <Button type="primary" htmlType="submit" block loading={loading} size="large" disabled={!inputValue || analysis.newNumbers.length === 0}>
            {analysis.newNumbers.length > 0 ? `Add ${analysis.newNumbers.length} New Prefixes` : "No new numbers to add"}
        </Button>
      </Form>
    </Spin>
  );
};

export default RoutingGatewayActions;