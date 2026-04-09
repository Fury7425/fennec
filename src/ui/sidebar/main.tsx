import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SidebarApp } from './components/SidebarApp';

const container = document.getElementById('root');
if (!container) throw new Error('Root element not found');

createRoot(container).render(
  <StrictMode>
    <SidebarApp />
  </StrictMode>
);
