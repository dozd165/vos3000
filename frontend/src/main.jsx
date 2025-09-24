import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import 'antd/dist/reset.css';

import { store } from './store/store';
import { Provider } from 'react-redux';

// 1. Import StyleProvider
import { StyleProvider } from '@ant-design/cssinjs';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      {/* 2. Bọc App trong StyleProvider */}
      <StyleProvider hashPriority="high">
        <App />
      </StyleProvider>
    </Provider>
  </React.StrictMode>,
);