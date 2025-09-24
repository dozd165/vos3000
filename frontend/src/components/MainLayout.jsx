// frontend/src/components/MainLayout.jsx
import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import {
  HomeOutlined, UserOutlined, SearchOutlined, DeleteOutlined,
  PhoneOutlined, SettingOutlined
} from '@ant-design/icons';
import './MainLayout.css';

const menuItems = [
  { path: '/', icon: <HomeOutlined />, name: 'Home' },
  { path: '/customers', icon: <UserOutlined />, name: 'Customers' },
  { path: '/configure', icon: <SettingOutlined />, name: 'Servers' },
  { path: '/search-number', icon: <SearchOutlined />, name: 'Numbers' },
  { path: '/cleanup', icon: <DeleteOutlined />, name: 'Cleanup' },
  { path: '/virtual-number', icon: <PhoneOutlined />, name: 'Rewrite Rules' },
];

const MainLayout = () => {
  return (
    <div className="app-container">
      <div className="sidebar-container">
        <div className="sidebar-wrapper">
          <ul className="sidebar-list">
            {menuItems.map(item => (
              <li className="sidebar-listItem" key={item.path}>
                <NavLink to={item.path}>
                  <span className="sidebar-listIcon">{item.icon}</span>
                  <span className="sidebar-listItemText">{item.name}</span>
                </NavLink>
              </li>
            ))}
          </ul>
          <div className="sidebar-profileSection">
            <img src="https://assets.codepen.io/3306515/i-know.jpg" alt="Admin" />
            <span>Admin</span>
          </div>
        </div>
      </div>
      <main className="main-content">
        <div className="main-content-inner">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default MainLayout;