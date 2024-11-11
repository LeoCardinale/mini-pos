import { PrismaClient } from '@prisma/client';
import { SyncOperation, SyncRequest, SyncResponse } from '../types/sync';

const prisma = new PrismaClient();

class SyncService {
    async processOperations(operations: SyncRequest['operations']): Promise<void> {
        for (const operation of operations) {
            try {
                console.log(`Processing operation: ${operation.type} ${operation.entity}`, operation);

                // Convertir timestamp de number a bigint
                const syncOp: SyncOperation = {
                    ...operation,
                    timestamp: BigInt(operation.timestamp)
                };

                // Primero aplicar la operación
                await this.applyOperation(syncOp);
                console.log('Operation applied successfully');

                // Luego guardar el registro de la operación
                await prisma.syncOperation.create({
                    data: {
                        id: syncOp.id,
                        timestamp: syncOp.timestamp,
                        type: syncOp.type,
                        entity: syncOp.entity,
                        data: syncOp.data,
                        deviceId: syncOp.deviceId,
                        status: 'completed'
                    }
                });
                console.log('Operation logged successfully');
            } catch (error) {
                console.error(`Error processing operation ${operation.id}:`, error);
                // Guardar la operación como fallida
                await prisma.syncOperation.create({
                    data: {
                        ...operation,
                        timestamp: BigInt(operation.timestamp),
                        status: 'failed'
                    }
                });
            }
        }
    }

    private async applyOperation(operation: SyncOperation): Promise<void> {
        const data = JSON.parse(operation.data);

        switch (operation.entity) {
            case 'product':
                await this.applyProductOperation(operation.type, data);
                break;
            case 'transaction':
                await this.applyTransactionOperation(operation.type, data);
                break;
            case 'cashRegister':
                await this.applyCashRegisterOperation(operation.type, data);
                break;
        }
    }

    private async applyProductOperation(type: string, data: any): Promise<void> {
        // Remover campos que no están en el esquema
        const { lastUpdated, id, ...productData } = data;

        switch (type) {
            case 'create':
                await prisma.product.create({
                    data: productData
                });
                break;
            case 'update':
                await prisma.product.update({
                    where: { id: data.id },
                    data: productData
                });
                break;
            case 'delete':
                await prisma.product.delete({
                    where: { id: data.id }
                });
                break;
        }
    }

    private async applyTransactionOperation(type: string, data: any): Promise<void> {
        if (type === 'create') {
            await prisma.transaction.create({ data });
        }
    }

    private async applyCashRegisterOperation(type: string, data: any): Promise<void> {
        switch (type) {
            case 'create':
            case 'update':
                await prisma.cashRegister.upsert({
                    where: { id: data.id || -1 },
                    create: data,
                    update: data
                });
                break;
        }
    }

    async getOperationsSince(timestamp: number, deviceId: string): Promise<SyncResponse['operations']> {
        const operations = await prisma.syncOperation.findMany({
            where: {
                timestamp: { gt: BigInt(timestamp) },
                deviceId: { not: deviceId },
                status: 'completed'
            },
            orderBy: {
                timestamp: 'asc'
            }
        });

        return operations.map((op: {
            id: string;
            timestamp: bigint;
            type: string;
            entity: string;
            data: string;
            deviceId: string;
            status: string;
            createdAt: Date;
        }) => ({
            id: op.id,
            type: op.type as 'create' | 'update' | 'delete',
            entity: op.entity as 'product' | 'transaction' | 'cashRegister',
            data: op.data,
            deviceId: op.deviceId,
            status: op.status as 'pending' | 'completed' | 'failed',
            timestamp: Number(op.timestamp),
            createdAt: op.createdAt
        }));
    }
}

export const syncService = new SyncService();