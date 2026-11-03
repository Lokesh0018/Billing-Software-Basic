import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import '@fontsource-variable/inter'; // bundled so the app works offline
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { BrandingProvider } from './context/BrandingContext';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <BrandingProvider>
      <AuthProvider>
        <App />
        <Toaster
          position="bottom-right"
          gutter={10}
          toastOptions={{
            duration: 3500,
            style: {
              fontSize: '14px',
              borderRadius: '12px',
              padding: '10px 14px',
              color: '#14213d',
              border: '1px solid #e6e8ee',
              boxShadow: '0 16px 40px -16px rgba(12,21,41,0.35)',
            },
            success: { iconTheme: { primary: '#047857', secondary: '#fff' } },
            error: { iconTheme: { primary: '#b91c1c', secondary: '#fff' } },
          }}
        />
      </AuthProvider>
      </BrandingProvider>
    </BrowserRouter>
  </StrictMode>,
);
