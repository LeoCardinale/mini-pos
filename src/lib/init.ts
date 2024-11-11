import { initDatabase } from './database';
import { syncClient } from './sync/syncClient';

export const initializeApp = async () => {
    // Inicializar deviceId si no existe
    if (!localStorage.getItem('deviceId')) {
        localStorage.setItem('deviceId', crypto.randomUUID());
    }

    // Inicializar la base de datos
    await initDatabase();

    // Iniciar sincronización
    syncClient.start();
};

// Función para limpiar recursos cuando la app se cierra
export const cleanupApp = () => {
    syncClient.stop();
};