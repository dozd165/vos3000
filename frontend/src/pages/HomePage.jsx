import React, { useState, useEffect } from 'react';
import { Typography, Row, Col, Card, Statistic, Button, Tag, Space } from 'antd';
import { HddOutlined, TeamOutlined, ApiOutlined, CheckCircleOutlined, UserOutlined, DeleteOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { getServers } from '../api/vosApi';

const { Title, Paragraph } = Typography;

const HomePage = () => {
  const [serverCount, setServerCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getServers()
      .then(data => setServerCount(data.length))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <Title level={2}>Welcome back, Admin!</Title>
      <Paragraph type="secondary">
        Here's a quick overview of your VOS3000 system.
      </Paragraph>

      <Row gutter={[16, 16]} style={{ marginTop: '24px' }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Total Servers"
              value={serverCount}
              loading={loading}
              prefix={<HddOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Active Customers"
              value={1128} // Dữ liệu giả, sẽ thay thế sau
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="API Status"
              valueRender={() => <Tag color="green">Online</Tag>}
              prefix={<ApiOutlined />}
            />
          </Card>
        </Col>
         <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="System Status"
              valueRender={() => <Tag color="green">Healthy</Tag>}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Title level={3} style={{ marginTop: '48px' }}>Quick Actions</Title>
      <Paragraph type="secondary">
        Get started with your most common tasks.
      </Paragraph>
      <Space wrap size="large" style={{ marginTop: '16px' }}>
        <Link to="/customers">
          <Button type="primary" icon={<UserOutlined />} size="large">
            Manage Customers
          </Button>
        </Link>
        <Link to="/cleanup">
           <Button icon={<DeleteOutlined />} size="large">
            Gateway Cleanup
          </Button>
        </Link>
      </Space>
    </div>
  );
};

export default HomePage;