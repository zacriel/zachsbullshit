import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './icons'; // registers the FontAwesome library once
import './theme.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
