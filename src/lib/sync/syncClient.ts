import { syncQueueOperations, initDatabase } from '../database';
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
    private syncInterval: number = 30000; // 30 segundos
    private lastSyncTimestamp: number = 0;
    private intervalId?: number;

    constructor(private apiUrl: string = config.apiUrl) {
        super();
    }

    async start() {
        if (this.isRunning) return;

        this.isRunning = true;

        // Realizar sincronización inicial
        await this.initialSync();

        this.scheduleSync();

        // Escuchar cambios en la conectividad
        window.addEventListener('online', () => {
            console.log('Connection restored. Starting sync...');
            this.sync().catch(console.error);
        });
    }

    private async initialSync() {
        try {
            console.log('Performing initial sync...');

            // Limpiar cualquier operación pendiente antes de la sincronización inicial
            await syncQueueOperations.clearAll();

            // Solicitar todas las operaciones desde el inicio del tiempo
            const response = await fetch(`${this.apiUrl}/sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
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
                // Aplicar todas las operaciones recibidas
                await this.applyRemoteOperations(syncResponse.operations);
                this.lastSyncTimestamp = syncResponse.lastSyncTimestamp;
                console.log('Initial sync completed successfully');
            }
        } catch (error) {
            console.error('Initial sync failed:', error);
            // Intentar de nuevo en 5 segundos
            setTimeout(() => this.initialSync(), 5000);
        }
    }

    stop() {
        this.isRunning = false;
        if (this.intervalId) {
            window.clearInterval(this.intervalId);
        }
    }

    // Hacemos público el método sync
    async sync(): Promise<void> {
        this.emit('syncStart');
        try {
            // Obtener operaciones pendientes
            const pendingOperations = await syncQueueOperations.getPendingOperations();
            console.log('Pending operations to sync:', pendingOperations);

            if (pendingOperations.length === 0 && this.lastSyncTimestamp === 0) {
                this.lastSyncTimestamp = Date.now();
                console.log('No pending operations and initial sync, setting timestamp:', this.lastSyncTimestamp);
                this.emit('syncComplete');
                return;
            }

            // Preparar request
            const syncRequest: SyncRequest = {
                operations: pendingOperations.map(op => ({
                    ...op,
                    timestamp: op.timestamp
                })),
                lastSyncTimestamp: this.lastSyncTimestamp,
                deviceId: localStorage.getItem('deviceId') || 'unknown'
            };

            console.log('Sending sync request:', {
                deviceId: syncRequest.deviceId,
                operationsCount: syncRequest.operations.length,
                lastSyncTimestamp: new Date(syncRequest.lastSyncTimestamp).toISOString()
            });

            // Enviar request
            const response = await fetch(`${this.apiUrl}/sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(syncRequest)
            });

            if (!response.ok) {
                throw new Error(`Sync failed: ${response.statusText}`);
            }

            const syncResponse: SyncResponse = await response.json();
            console.log('Received sync response:', {
                success: syncResponse.success,
                operationsCount: syncResponse.operations.length,
                timestamp: new Date(syncResponse.lastSyncTimestamp).toISOString()
            });

            if (syncResponse.success) {
                // Marcar operaciones locales como completadas
                console.log('Marking operations as completed:', pendingOperations.map(op => op.id));
                await Promise.all(
                    pendingOperations.map(op =>
                        syncQueueOperations.markAsCompleted(op.id)
                    )
                );

                // Aplicar operaciones remotas
                if (syncResponse.operations.length > 0) {
                    console.log('Applying remote operations:', syncResponse.operations);
                }
                await this.applyRemoteOperations(syncResponse.operations);

                // Actualizar timestamp
                this.lastSyncTimestamp = syncResponse.lastSyncTimestamp;
                console.log('Updated lastSyncTimestamp:', new Date(this.lastSyncTimestamp).toISOString());

                // Limpiar operaciones completadas
                await syncQueueOperations.clearCompleted();
                console.log('Cleared completed operations');

                this.emit('syncComplete');
            } else {
                throw new Error(syncResponse.error || 'Sync failed without specific error');
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

export const syncClient = new SyncClient();