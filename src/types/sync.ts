export interface SyncOperation {
    id: string;
    timestamp: number;
    type: 'create' | 'update' | 'delete';
    entity: 'product' | 'transaction' | 'cashRegister' | 'accountTransaction' | 'salesRecord';
    data: string;  // JSON serializado
    deviceId: string;
    status: 'pending' | 'completed' | 'failed';
}

export interface SyncRequest {
    operations: SyncOperation[];
    lastSyncTimestamp: number;
    deviceId: string;
}

export interface SyncResponse {
    success: boolean;
    operations: SyncOperation[];
    lastSyncTimestamp: number;
    error?: string;
}

export type SyncEntityType = 'product' | 'transaction' | 'cashRegister' | 'accountTransaction' | 'salesRecord';