import React, { useState, useEffect } from 'react';
import { Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { syncQueueOperations } from '../../lib/database';
import { syncClient } from '../../lib/sync/syncClient';

const SyncStatus = () => {
    const [syncState, setSyncState] = useState({
        isOnline: navigator.onLine,
        isSyncing: false,
        pendingOps: 0
    });

    useEffect(() => {
        const updateStatus = async () => {
            const ops = await syncQueueOperations.getPendingOperations();
            setSyncState(prev => ({
                ...prev,
                pendingOps: ops.length
            }));
        };

        const onlineHandler = () => {
            setSyncState(prev => ({ ...prev, isOnline: true }));
            updateStatus();
        };

        const offlineHandler = () => {
            setSyncState(prev => ({ ...prev, isOnline: false }));
        };

        const syncStartHandler = () => {
            setSyncState(prev => ({ ...prev, isSyncing: true }));
        };

        const syncCompleteHandler = () => {
            setSyncState(prev => ({ ...prev, isSyncing: false }));
            updateStatus();
        };

        window.addEventListener('online', onlineHandler);
        window.addEventListener('offline', offlineHandler);
        syncClient.on('syncStart', syncStartHandler);
        syncClient.on('syncComplete', syncCompleteHandler);

        // Actualizar estado inicial y cada 5 segundos
        updateStatus();
        const interval = setInterval(updateStatus, 5000);

        return () => {
            window.removeEventListener('online', onlineHandler);
            window.removeEventListener('offline', offlineHandler);
            syncClient.off('syncStart', syncStartHandler);
            syncClient.off('syncComplete', syncCompleteHandler);
            clearInterval(interval);
        };
    }, []);

    const handleForceSync = () => {
        if (syncState.isOnline && !syncState.isSyncing) {
            syncClient.sync().catch(console.error);
        }
    };

    return (
        <div className="fixed bottom-4 right-4 flex items-center gap-2 bg-white p-2 rounded-lg shadow-lg">
            {/* Estado de conexión */}
            <div className="flex items-center gap-1">
                {syncState.isOnline ? (
                    <Cloud className="w-4 h-4 text-green-500" />
                ) : (
                    <CloudOff className="w-4 h-4 text-red-500" />
                )}
                <span className="text-sm">
                    {syncState.isOnline ? 'Conectado' : 'Desconectado'}
                </span>
            </div>

            {/* Operaciones pendientes */}
            {syncState.pendingOps > 0 && (
                <span className="text-sm text-orange-500">
                    {syncState.pendingOps} pendiente(s)
                </span>
            )}

            {/* Botón de sincronización manual */}
            <button
                onClick={handleForceSync}
                className="p-1 rounded"
                disabled={!syncState.isOnline || syncState.isSyncing}
            >
                <RefreshCw
                    className={`w-4 h-4 ${syncState.isSyncing ? 'animate-spin text-blue-500' :
                            !syncState.isOnline ? 'text-gray-400' : 'text-gray-600'
                        }`}
                />
            </button>
        </div>
    );
};

export default SyncStatus;