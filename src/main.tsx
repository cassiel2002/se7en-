import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { purgeStaleDailyCaches } from './utils/safeStorage';

// Libera espacio de caches diarios viejos antes de arrancar (ver safeStorage.ts).
purgeStaleDailyCaches();

// Scripts de mantenimiento (initDevData, fixVisitas, cleanDuplicatePremios)
// solo disponibles en desarrollo, no en producción.
if (import.meta.env.DEV) {
  import('./scripts/initDevData');
  import('./scripts/cleanDuplicatePremios');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
