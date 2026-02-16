import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';
import 'leaflet/dist/leaflet.css';

console.log('[INIT] Main.tsx loaded');
console.log('[INIT] React version:', StrictMode);
console.log('[INIT] Config check:', {
  hasApp: !!App,
  hasErrorBoundary: !!ErrorBoundary
});

const rootElement = document.getElementById('root');
console.log('[INIT] Root element:', rootElement);

if (!rootElement) {
  throw new Error('Root element not found');
}

try {
  console.log('[INIT] Creating root...');
  const root = createRoot(rootElement);

  console.log('[INIT] Rendering app...');
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>
  );

  console.log('[INIT] ✅ App rendered successfully');
} catch (error) {
  console.error('[INIT] ❌ Fatal error:', error);
  rootElement.innerHTML = `
    <div style="padding: 40px; max-width: 800px; margin: 0 auto; font-family: system-ui;">
      <h1 style="color: #dc2626; margin-bottom: 20px;">Application Initialization Failed</h1>
      <p style="color: #4b5563; margin-bottom: 20px;">The application could not start. Details:</p>
      <pre style="background: #f3f4f6; padding: 20px; border-radius: 8px; overflow: auto; font-size: 12px;">
${error instanceof Error ? error.message + '\n\n' + error.stack : String(error)}
      </pre>
      <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">
        Reload Page
      </button>
    </div>
  `;
}
