export interface SyncOperation {
    id: string;
    timestamp: bigint;
    type: 'create' | 'update' | 'delete';
    entity: 'product' | 'transaction' | 'cashRegister' | 'accountTransaction' | 'salesRecord' | 'report' | 'inventoryLog';
    data: string;
    deviceId: string;
    status: 'pending' | 'completed' | 'failed';
    createdAt?: Date;
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