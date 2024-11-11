import React from 'react';
import { AlertCircle, CheckCircle2, Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { useSyncStatus } from '../../context/SyncContext';

const SyncStatus = () => {
    const { isSyncing, lastSyncTime, pendingChanges, syncError, forceSync } = useSyncStatus();
    const isOnline = navigator.onLine;

    return (
        <div className="fixed bottom-4 right-4 flex items-center gap-2 bg-white p-2 rounded-lg shadow-lg">
            {/* Estado de conexión */}
            <div className="flex items-center gap-1">
                {isOnline ? (
                    <Cloud className="w-4 h-4 text-green-500" />
                ) : (
                    <CloudOff className="w-4 h-4 text-red-500" />
                )}
                <span className="text-sm">
                    {isOnline ? 'Conectado' : 'Desconectado'}
                </span>
            </div>

            {/* Estado de sincronización */}
            <div className="flex items-center gap-1">
                {isSyncing ? (
                    <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
                ) : syncError ? (
                    <AlertCircle className="w-4 h-4 text-red-500" />
                ) : (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                )}
            </div>

            {/* Cambios pendientes */}
            {pendingChanges > 0 && (
                <span className="text-sm text-orange-500">
                    {pendingChanges} cambio(s) pendiente(s)
                </span>
            )}

            {/* Última sincronización */}
            {lastSyncTime && (
                <span className="text-xs text-gray-500">
                    Última sync: {lastSyncTime.toLocaleTimeString()}
                </span>
            )}

            {/* Botón de sincronización manual */}
            <button
                onClick={() => forceSync()}
                disabled={isSyncing || !isOnline}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-50"
            >
                <RefreshCw className="w-4 h-4" />
            </button>
        </div>
    );
};

export default SyncStatus;