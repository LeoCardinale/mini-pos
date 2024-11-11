import React, { createContext, useContext, useState, useEffect } from 'react';
import { syncClient } from '../lib/sync/syncClient';
import { syncQueueOperations } from '../lib/database';

interface SyncContextType {
    isSyncing: boolean;
    lastSyncTime: Date | null;
    pendingChanges: number;
    syncError: string | null;
    forceSync: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType | null>(null);

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
    const [pendingChanges, setPendingChanges] = useState(0);
    const [syncError, setSyncError] = useState<string | null>(null);

    // Monitorear cambios pendientes
    useEffect(() => {
        const checkPendingChanges = async () => {
            const operations = await syncQueueOperations.getPendingOperations();
            setPendingChanges(operations.length);
        };

        // Verificar inmediatamente
        checkPendingChanges();

        // Verificar periódicamente
        const interval = setInterval(checkPendingChanges, 5000);

        return () => clearInterval(interval);
    }, []);

    // Subscribirse a eventos de sincronización
    useEffect(() => {
        const syncStartHandler = () => {
            setIsSyncing(true);
            setSyncError(null);
        };

        const syncCompleteHandler = () => {
            setIsSyncing(false);
            setLastSyncTime(new Date());
            setSyncError(null);
        };

        const syncErrorHandler = (error: Error) => {
            setIsSyncing(false);
            setSyncError(error.message);
        };

        // Suscribirse a eventos
        syncClient.on('syncStart', syncStartHandler);
        syncClient.on('syncComplete', syncCompleteHandler);
        syncClient.on('syncError', syncErrorHandler);

        return () => {
            // Limpiar suscripciones
            syncClient.off('syncStart', syncStartHandler);
            syncClient.off('syncComplete', syncCompleteHandler);
            syncClient.off('syncError', syncErrorHandler);
        };
    }, []);

    const forceSync = async () => {
        try {
            setIsSyncing(true);
            setSyncError(null);
            await syncClient.sync();
            setLastSyncTime(new Date());
        } catch (error) {
            setSyncError(error instanceof Error ? error.message : 'Error de sincronización');
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <SyncContext.Provider
            value={{
                isSyncing,
                lastSyncTime,
                pendingChanges,
                syncError,
                forceSync
            }}
        >
            {children}
        </SyncContext.Provider>
    );
};

export const useSyncStatus = () => {
    const context = useContext(SyncContext);
    if (!context) {
        throw new Error('useSyncStatus must be used within a SyncProvider');
    }
    return context;
};