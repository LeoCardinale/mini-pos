import { PrismaClient } from '@prisma/client';
import { SyncOperation, SyncRequest, SyncResponse } from '../types/sync';

const prisma = new PrismaClient();

class SyncService {

    private async recordSale(
        transaction: any,
        source: 'POS' | 'ACCUMULATED' | 'PREPAID',
        prisma: any
    ) {
        for (const item of transaction.items) {
            await prisma.salesRecord.create({
                data: {
                    productId: item.productId,
                    quantity: item.quantity,
                    price: item.price,
                    total: item.quantity * item.price,
                    source,
                    sourceId: transaction.id,
                    userId: transaction.userId,
                    createdAt: new Date(transaction.createdAt)
                }
            });
        }
    }

    async processOperations(operations: SyncRequest['operations']): Promise<void> {
        console.log('Processing incoming operations:', operations);
        for (const operation of operations) {
            try {
                console.log(`Processing operation: ${operation.type} ${operation.entity}`, operation);
                console.log('Processing operation_2:', operation.type, operation.entity, operation.data);

                // Verificar si la operaci贸n ya fue procesada
                const existingOperation = await prisma.syncOperation.findUnique({
                    where: { id: operation.id }
                });

                if (existingOperation) {
                    console.log(`Operation ${operation.id} already processed, skipping`);
                    continue;
                }

                // Convertir timestamp de number a bigint
                const syncOp: SyncOperation = {
                    ...operation,
                    timestamp: BigInt(operation.timestamp)
                };

                // Primero guardar el registro de la operaci贸n como 'pending'
                await prisma.syncOperation.create({
                    data: {
                        id: syncOp.id,
                        timestamp: syncOp.timestamp,
                        type: syncOp.type,
                        entity: syncOp.entity,
                        data: syncOp.data,
                        deviceId: syncOp.deviceId,
                        status: 'pending'
                    }
                });

                // Luego aplicar la operaci贸n
                await this.applyOperation(syncOp);
                console.log('Operation applied successfully');

                // Actualizar el estado a 'completed'
                await prisma.syncOperation.update({
                    where: { id: syncOp.id },
                    data: { status: 'completed' }
                });

                console.log('Operation completed successfully');
            } catch (error) {
                console.error(`Error processing operation ${operation.id}:`, error);
                // Actualizar la operaci贸n como fallida si existe
                try {
                    await prisma.syncOperation.update({
                        where: { id: operation.id },
                        data: { status: 'failed' }
                    });
                } catch {
                    // Si no existe, crearla como fallida
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
            case 'accountTransaction':
                await this.applyTransactionOperation(operation.type, data);
                break;
            case 'cashRegister':
                await this.applyCashRegisterOperation(operation.type, data);
                break;
            case 'salesRecord':
                if (operation.type === 'create') {
                    await prisma.salesRecord.create({
                        data: {
                            productId: data.productId,
                            quantity: data.quantity,
                            price: data.price,
                            total: data.total,
                            source: data.source,
                            sourceId: data.sourceId,
                            userId: data.userId,
                            createdAt: new Date(data.createdAt)
                        }
                    });
                }
                break;
        }
    }

    private async applyProductOperation(type: string, data: any): Promise<void> {
        // Remover campos que no est谩n en el esquema
        const { lastUpdated, ...productData } = data;

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
        console.log('Processing transaction operation', { type, data });

        if (type === 'create') {
            if (data.accountId) {
                console.log('Processing account transaction', data);
                await prisma.$transaction(async (prisma) => {
                    const { accountId, items, accountType, ...transactionData } = data;
                    console.log('Creating account transaction with items:', items);

                    // Crear la transacción
                    await prisma.accountTransaction.create({
                        data: {
                            amount: transactionData.amount,
                            type: transactionData.type,
                            userId: transactionData.userId,
                            accountId: Number(accountId),
                            createdAt: new Date(transactionData.createdAt),
                            status: 'active',
                            items: {
                                create: items.map((item: any) => ({
                                    productId: item.productId,
                                    quantity: item.quantity,
                                    price: item.price
                                }))
                            }
                        }
                    });

                    if (accountType === 'PREPAID') {
                        // Actualizar prepaidProducts para transacciones PREPAID
                        for (const item of items) {
                            const existingProduct = await prisma.prepaidProduct.findFirst({
                                where: {
                                    accountId: Number(accountId),
                                    productId: item.productId
                                }
                            });

                            if (existingProduct) {
                                await prisma.prepaidProduct.update({
                                    where: { id: existingProduct.id },
                                    data: {
                                        paid: transactionData.type === 'credit'
                                            ? existingProduct.paid + item.quantity
                                            : existingProduct.paid,
                                        consumed: transactionData.type === 'debit'
                                            ? existingProduct.consumed + item.quantity
                                            : existingProduct.consumed
                                    }
                                });
                            } else if (transactionData.type === 'credit') {
                                await prisma.prepaidProduct.create({
                                    data: {
                                        accountId: Number(accountId),
                                        productId: item.productId,
                                        paid: item.quantity,
                                        consumed: 0
                                    }
                                });
                            }
                        }
                    }

                    // Actualizar stock SOLO para transacciones de crédito en PREPAID
                    // o débito en ACCUMULATED
                    if ((accountType === 'PREPAID' && transactionData.type === 'credit') ||
                        (accountType === 'ACCUMULATED' && transactionData.type === 'debit')) {
                        for (const item of items) {
                            await prisma.product.update({
                                where: { id: item.productId },
                                data: {
                                    stock: {
                                        decrement: item.quantity
                                    }
                                }
                            });
                        }
                    }

                    if ((accountType === 'PREPAID' && transactionData.type === 'credit') ||
                        (accountType === 'ACCUMULATED' && transactionData.type === 'debit')) {
                        await this.recordSale(
                            { ...transactionData, items, accountId },
                            accountType,
                            prisma
                        );
                    }
                });
            }
        } else if (type === 'update' && data.operation === 'close') {
            // Manejar cierre de cuenta
            await prisma.$transaction(async (prisma) => {
                await prisma.account.update({
                    where: { id: Number(data.accountId) },
                    data: {
                        status: 'closed',
                        closedAt: new Date(data.timestamp),
                        closedBy: data.userId
                    }
                });

                // Marcar todas las transacciones de la cuenta como cerradas
                await prisma.accountTransaction.updateMany({
                    where: { accountId: Number(data.accountId) },
                    data: { status: 'closed' }
                });
            });
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