import './i18n/i18nConfig';

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { initializeApp } from './lib/init';

// Registrar Service Worker
const registerServiceWorker = async () => {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw-custom.ts', {
        type: 'module',
      });
      console.log('Service Worker registered successfully:', registration);
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }
};

// Inicializar la aplicación antes de renderizar
initializeApp()
  .then(() => {
    // Renderizar la aplicación
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  })
  .catch(error => {
    console.error('Failed to initialize app:', error);
    // Aquí podrías mostrar un mensaje de error al usuario
  });