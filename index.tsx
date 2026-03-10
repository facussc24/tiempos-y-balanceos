import React from 'react';
import ReactDOM from 'react-dom/client';
import AppRouter from './AppRouter';
import { logger } from './utils/logger';
import './index.css';

// Catch unhandled promise rejections globally
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  logger.error('UnhandledRejection', reason?.message || String(reason),
    { stack: reason?.stack }, reason instanceof Error ? reason : undefined);
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AppRouter />
  </React.StrictMode>
);