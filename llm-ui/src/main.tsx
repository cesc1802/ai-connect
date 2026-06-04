import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

async function bootstrap() {
  const useMocks =
    import.meta.env.DEV || import.meta.env.VITE_USE_MOCKS === 'true';
  if (useMocks) {
    const { enableMocking } = await import('./mocks/browser');
    await enableMocking();
  }

  const rootElement = document.getElementById('root');
  if (!rootElement) throw new Error('Root element #root not found');

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );

  const loader = document.getElementById('boot-loader');
  if (loader) {
    loader.setAttribute('data-hidden', 'true');
    setTimeout(() => loader.remove(), 320);
  }
}

void bootstrap();
