import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { appLogger, registerGlobalErrorHandlers } from './utils/observability.ts';

registerGlobalErrorHandlers();
appLogger.log({
  category: 'PAGE_LOAD_ROUTE',
  event: 'app_bootstrap',
  status: 'start',
  page: 'main',
  scope: 'main.tsx',
  message: 'Application bootstrap started.',
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
