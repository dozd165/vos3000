import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
// Bỏ import 'Button' và 'Space' từ antd, chỉ giữ lại những gì cần thiết
import { Form, InputNumber, Radio, notification, Spin, Card, Typography, Descriptions } from 'antd';
import { getCustomerDetails, updateCreditLimit } from '../api/vosApi';
import StyledButton from '../components/StyledButton'; // <-- IMPORT STYLED BUTTON

const { Title, Text } = Typography;

const EditCreditLimitPage = () => {
  const { serverName, accountId } = useParams();
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [operationMode, setOperationMode] = useState('set');

  // ... (toàn bộ logic bên trong component giữ nguyên, không cần thay đổi)
  const fetchDetails = useCallback(async () => { /* ... */ }, [serverName, accountId, form]);
  useEffect(() => { /* ... */ }, [fetchDetails]);
  const handleConfirmUpdate = async () => { /* ... */ };

  if (loading) {
    return <Spin size="large" />;
  }
  if (!customer) return null;

  return (
    <Card>
      <Title level={3}>Điều chỉnh Hạn mức Tín dụng</Title>
      <Descriptions bordered column={1} style={{ marginBottom: 24 }}>
        <Descriptions.Item label="Account ID">{customer.account}</Descriptions.Item>
        <Descriptions.Item label="Tên Khách hàng">{customer.name}</Descriptions.Item>
        <Descriptions.Item label="Hạn mức hiện tại">
          <Text strong>{customer.limitMoney === -1 ? 'Không giới hạn' : new Intl.NumberFormat('vi-VN').format(customer.limitMoney)} VNĐ</Text>
        </Descriptions.Item>
      </Descriptions>

      <Radio.Group onChange={(e) => setOperationMode(e.target.value)} value={operationMode} style={{ marginBottom: 16 }}>
        <Radio.Button value="set">Đặt lại</Radio.Button>
        <Radio.Button value="add">Cộng thêm</Radio.Button>
        <Radio.Button value="subtract">Trừ đi</Radio.Button>
      </Radio.Group>

      <Form form={form} layout="inline">
        <Form.Item name="amount" rules={[{ required: true, message: 'Số tiền là bắt buộc' }]}>
          <InputNumber
            placeholder={
              operationMode === 'set' ? 'Nhập hạn mức mới' :
              operationMode === 'add' ? 'Nhập số tiền cần cộng' : 'Nhập số tiền cần trừ'
            }
            style={{ width: 250 }}
            formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            parser={(value) => value.replace(/\$\s?|(,*)/g, '')}
          />
        </Form.Item>
        <Form.Item>
          {/* THAY THẾ CÁC NÚT BẤM Ở ĐÂY */}
          {/* Dùng div với flexbox để tạo khoảng cách thay cho <Space> */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <StyledButton onClick={handleConfirmUpdate} loading={isSubmitting} type="submit">
              Xác nhận
            </StyledButton>
            <StyledButton onClick={() => navigate('/customers')}>
              Quay lại
            </StyledButton>
          </div>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default EditCreditLimitPage;