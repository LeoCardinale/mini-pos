export interface SyncOperation {
    id: string;
    timestamp: number;
    type: 'create' | 'update' | 'delete';
    entity: SyncEntityType;
    data: string;  // JSON serializado
    deviceId: string;
    status: 'pending' | 'completed' | 'failed';
    createdAt: Date;
}

export interface SyncRequest {
    operations: Array<Omit<SyncOperation, 'timestamp'> & { timestamp: number }>;
    lastSyncTimestamp: number;
    deviceId: string;
}

export interface SyncResponse {
    success: boolean;
    operations: Array<Omit<SyncOperation, 'timestamp'> & { timestamp: number }>;
    lastSyncTimestamp: number;
    error?: string;
}

// Tipo auxiliar para crear nuevas operaciones
export type NewSyncOperation = Omit<SyncOperation, 'id' | 'createdAt' | 'timestamp'> & {
    timestamp?: number;
};

// Re-exportar el tipo SyncEntityType para mantener la consistencia
export type SyncEntityType = 'product' | 'transaction' | 'cashRegister' | 'accountTransaction' | 'salesRecord' | 'report' | 'inventoryLog';