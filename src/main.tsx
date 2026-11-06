import React from 'react';
import ReactDOM from 'react-dom/client';
import 'material-icons/iconfont/material-icons.css';
import './styles/theme.css';
import { AppProvider } from './context/AppContext';
import { App } from './App';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>
);
