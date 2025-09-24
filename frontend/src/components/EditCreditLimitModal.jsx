import React, { useState, useEffect } from 'react';
import { Modal, Form, InputNumber, notification, Typography, Descriptions, Space } from 'antd';
import { updateCreditLimit } from '../api/vosApi';
import StyledButton from './StyledButton';
import StyledRadioGroup from './StyledRadioGroup'; // Dòng import này phải hoạt động nếu tên file ở trên đúng

const { Text } = Typography;

const operationOptions = [
  { label: 'Set To', value: 'set' },
  { label: 'Add', value: 'add' },
  { label: 'Subtract', value: 'subtract' },
];

const EditCreditLimitModal = ({ open, onClose, customer, onUpdateSuccess }) => {
    const [form] = Form.useForm();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [operationMode, setOperationMode] = useState('set');

    useEffect(() => {
        if (open && customer) {
            form.setFieldsValue({ amount: customer.limitMoney === -1 ? 0 : customer.limitMoney });
            setOperationMode('set');
        }
    }, [open, customer, form]);

    const handleConfirmUpdate = async () => {
        try {
            const { amount } = await form.validateFields();
            setIsSubmitting(true);
            const currentLimit = Number(customer.limitMoney);
            let newAbsoluteLimit;
            switch (operationMode) {
                case 'add':
                    if (currentLimit === -1) { notification.warning({ message: 'Cannot add to an unlimited credit limit.' }); setIsSubmitting(false); return; }
                    newAbsoluteLimit = currentLimit + amount;
                    break;
                case 'subtract':
                    if (currentLimit === -1) { notification.warning({ message: 'Cannot subtract from an unlimited credit limit.' }); setIsSubmitting(false); return; }
                    newAbsoluteLimit = currentLimit - amount;
                    if (newAbsoluteLimit < 0) { notification.error({ message: 'Credit limit cannot be negative.' }); setIsSubmitting(false); return; }
                    break;
                default:
                    newAbsoluteLimit = amount;
                    break;
            }
            await updateCreditLimit(customer._server_name_source, customer.account, String(newAbsoluteLimit), customer.hash);
            notification.success({ message: 'Credit limit updated successfully!' });
            onUpdateSuccess();
        } catch (error) {
            const errorMsg = error.response?.data?.detail || 'Update failed.';
            notification.error({ message: 'Error', description: errorMsg });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!customer) return null;

    return (
        <Modal title="Adjust Credit Limit" open={open} onCancel={onClose} footer={null} destroyOnHidden>
            <Descriptions bordered column={1} size="small" style={{ marginBottom: 24 }}>
                <Descriptions.Item label="Account ID">{customer.account}</Descriptions.Item>
                <Descriptions.Item label="Current Limit">
                    <Text strong>{customer.limitMoney === -1 ? 'Unlimited' : new Intl.NumberFormat('vi-VN').format(customer.limitMoney)} VND</Text>
                </Descriptions.Item>
            </Descriptions>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
                <StyledRadioGroup
                    name="operationMode"
                    options={operationOptions}
                    value={operationMode}
                    onChange={setOperationMode}
                />
            </div>
            <Form form={form} layout="vertical">
                <Form.Item name="amount" label="Value" rules={[{ required: true, message: 'Value is required' }]}>
                    <InputNumber placeholder="Enter value..." style={{ width: '100%' }} formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={(value) => value.replace(/\$\s?|(,*)/g, '')} />
                </Form.Item>
                <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
                    <Space>
                        <StyledButton onClick={onClose}>Cancel</StyledButton>
                        <StyledButton onClick={handleConfirmUpdate} loading={isSubmitting}>Confirm</StyledButton>
                    </Space>
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default EditCreditLimitModal;