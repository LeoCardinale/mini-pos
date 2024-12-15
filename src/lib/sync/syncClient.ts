import { syncQueueOperations, initDatabase, clearDatabase } from '../database';
import { SyncOperation, SyncRequest, SyncResponse } from '../../types/sync';
import { EventEmitter } from '../utils/EventEmitter';
import { config } from '../../config';

// Definir los tipos de eventos que emitirá el cliente
interface SyncEvents {
    syncStart: () => void;
    syncComplete: () => void;
    syncError: (error: Error) => void;
}

declare interface SyncClient {
    on<E extends keyof SyncEvents>(event: E, listener: SyncEvents[E]): this;
    off<E extends keyof SyncEvents>(event: E, listener: SyncEvents[E]): this;
    emit<E extends keyof SyncEvents>(event: E, ...args: Parameters<SyncEvents[E]>): boolean;
}

class SyncClient extends EventEmitter {
    private isRunning = false;
    private syncInterval: number = 30000;
    private lastSyncTimestamp: number = 0;
    private intervalId?: number;
    private isOnline: boolean = true;

    constructor(private apiUrl: string = config.apiUrl.replace('/api', '')) {
        super();
        console.log('SyncClient initialized with URL:', this.apiUrl);
        this.isOnline = navigator.onLine;

        window.addEventListener('online', () => {
            console.log('Connection restored');
            this.isOnline = true;
            this.sync().catch(console.error);
        });

        window.addEventListener('offline', () => {
            console.log('Connection lost');
            this.isOnline = false;
        });
    }

    private getAuthToken(): string | null {
        return localStorage.getItem('token');
    }

    async start() {
        if (this.isRunning) return;

        const token = this.getAuthToken();
        if (!token) {
            console.log('No auth token, skipping sync');
            return;
        }

        this.isRunning = true;
        await this.initialSync();
        this.scheduleSync();
    }

    private async initialSync() {
        try {
            const token = this.getAuthToken();
            if (!token || !this.isOnline) {
                return;
            }

            console.log('Performing initial sync...');

            // Solo limpiar si no hay operaciones pendientes
            const pendingOps = await syncQueueOperations.getPendingOperations();
            if (pendingOps.length === 0) {
                // Solo limpiar si la base de datos está vacía
                const db = await initDatabase();
                const products = await db.getAll('products');
                if (products.length === 0) {
                    await clearDatabase();
                }
            }

            const response = await fetch(`${this.apiUrl}/sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    operations: [],
                    lastSyncTimestamp: 0,
                    deviceId: localStorage.getItem('deviceId') || 'unknown'
                })
            });

            if (!response.ok) {
                throw new Error(`Initial sync failed: ${response.statusText}`);
            }

            const syncResponse: SyncResponse = await response.json();
            if (syncResponse.success) {
                await syncQueueOperations.clearAll();
                await this.applyRemoteOperations(syncResponse.operations);
                this.lastSyncTimestamp = syncResponse.lastSyncTimestamp;
            }
        } catch (error) {
            console.error('Initial sync error:', error);
        }
    }

    stop() {
        this.isRunning = false;
        if (this.intervalId) {
            window.clearInterval(this.intervalId);
        }
    }

    async sync(): Promise<void> {
        const token = this.getAuthToken();
        if (!token || !this.isOnline) {
            console.log('Skipping sync - no token or offline');
            return;
        }

        this.emit('syncStart');
        try {
            const pendingOperations = await syncQueueOperations.getPendingOperations();

            const syncRequest: SyncRequest = {
                operations: pendingOperations,
                lastSyncTimestamp: this.lastSyncTimestamp,
                deviceId: localStorage.getItem('deviceId') || 'unknown'
            };

            const response = await fetch(`${this.apiUrl}/sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(syncRequest)
            });

            if (!response.ok) {
                throw new Error(`Sync failed: ${response.statusText}`);
            }

            const syncResponse: SyncResponse = await response.json();
            if (syncResponse.success) {
                await Promise.all(
                    pendingOperations.map(op =>
                        syncQueueOperations.markAsCompleted(op.id)
                    )
                );

                await this.applyRemoteOperations(syncResponse.operations);
                this.lastSyncTimestamp = syncResponse.lastSyncTimestamp;
                await syncQueueOperations.clearCompleted();
                this.emit('syncComplete');
            } else {
                throw new Error(syncResponse.error || 'Sync failed');
            }
        } catch (error) {
            // Convertir el error a una instancia de Error si no lo es
            const errorToEmit = error instanceof Error ? error : new Error(String(error));
            this.emit('syncError', errorToEmit);
            console.error('Sync error:', error);
            throw error;
        }
    }

    private scheduleSync() {
        this.intervalId = window.setInterval(() => {
            if (navigator.onLine) {
                this.sync().catch(console.error);
            }
        }, this.syncInterval);
    }

    private async applyRemoteOperations(operations: SyncOperation[]): Promise<void> {
        const {
            productOperations,
            transactionOperations,
            cashRegisterOperations
        } = await import('../database');

        for (const operation of operations) {
            try {
                const data = JSON.parse(operation.data);

                switch (operation.entity) {
                    case 'product':
                        // Verificar si el producto existe antes de intentar crearlo
                        const existingProduct = await productOperations.getById(data.id);

                        switch (operation.type) {
                            case 'create':
                                if (!existingProduct) {
                                    await productOperations.create(data);
                                }
                                break;
                            case 'update':
                                if (existingProduct) {
                                    await productOperations.update(data.id, data);
                                }
                                break;
                            case 'delete':
                                if (existingProduct) {
                                    await productOperations.delete(data.id);
                                }
                                break;
                        }
                        break;

                    case 'transaction':
                        const existingTransaction = await transactionOperations.getById?.(data.id);

                        switch (operation.type) {
                            case 'create':
                                if (!existingTransaction) {
                                    await transactionOperations.create(data);
                                }
                                break;
                            // Normalmente no permitimos actualizar o eliminar transacciones
                        }
                        break;

                    case 'cashRegister':
                        const existingRegister = await cashRegisterOperations.getById?.(data.id);

                        switch (operation.type) {
                            case 'create':
                                if (!existingRegister) {
                                    await cashRegisterOperations.create(data);
                                }
                                break;
                            case 'update':
                                if (existingRegister) {
                                    await cashRegisterOperations.update(data.id, data);
                                }
                                break;
                        }
                        break;
                }
            } catch (error) {
                if (error instanceof Error && error.name !== 'ConstraintError') {
                    console.error(`Failed to apply remote operation:`, operation, error);
                }
            }
        }
    }

    async forceFullSync() {
        try {
            console.log('Forcing full sync...');

            // Limpiar la base de datos local
            const db = await initDatabase();
            await db.clear('products');
            await syncQueueOperations.clearAll();

            // Resetear el timestamp para forzar una sincronización inicial
            this.lastSyncTimestamp = 0;
            console.log('Reset lastSyncTimestamp to 0');

            // Realizar sincronización inicial
            await this.initialSync();

            console.log('Full sync completed');
        } catch (error) {
            console.error('Full sync failed:', error);
            throw error;
        }
    }
}

export const syncClient = new SyncClient(config.apiUrl);