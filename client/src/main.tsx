import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AuthProvider } from './auth/AuthContext';
import './icons'; // registers the FontAwesome library once
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import './theme.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);
