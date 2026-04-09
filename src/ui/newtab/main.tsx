import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { NewTabApp } from './components/NewTabApp';

const container = document.getElementById('root');
if (!container) throw new Error('Root element not found');

createRoot(container).render(
  <StrictMode>
    <NewTabApp />
  </StrictMode>
);
