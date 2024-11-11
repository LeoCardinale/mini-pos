import { Request, Response } from 'express';
import { PrismaClient, Product } from '@prisma/client';
import { syncService } from '../services/syncService';
import { SyncRequest, SyncResponse } from '../types/sync';
import crypto from 'crypto';

const prisma = new PrismaClient();

export async function sync(req: Request, res: Response) {
    try {
        const syncRequest = req.body as SyncRequest;
        console.log('Received sync request from device:', syncRequest.deviceId);
        console.log('Incoming operations:', syncRequest.operations);

        // Procesar operaciones entrantes
        if (syncRequest.operations.length > 0) {
            console.log('Processing incoming operations...');
            await syncService.processOperations(syncRequest.operations);
            console.log('Operations processed successfully');

            // Verificar el estado actual
            const currentProducts = await prisma.product.findMany();
            console.log('Current database state:', currentProducts);
        }

        let operations;

        // Si es una sincronización inicial
        if (syncRequest.lastSyncTimestamp === 0) {
            const products = await prisma.product.findMany();
            operations = products.map((product: Product) => ({
                id: `initial-${product.id}`, // ID único para operaciones iniciales
                timestamp: BigInt(Date.now()),
                type: 'create' as const,
                entity: 'product' as const,
                data: JSON.stringify(product),
                deviceId: 'server',
                status: 'completed' as const
            }));
        } else {
            // Obtener solo las operaciones nuevas desde la última sincronización
            operations = await syncService.getOperationsSince(
                syncRequest.lastSyncTimestamp,
                syncRequest.deviceId
            );
        }

        const response: SyncResponse = {
            success: true,
            operations: operations.map(op => ({
                ...op,
                timestamp: Number(op.timestamp)
            })),
            lastSyncTimestamp: Date.now()
        };

        res.json(response);
    } catch (error) {
        console.error('Sync error:', error);
        const response: SyncResponse = {
            success: false,
            operations: [],
            lastSyncTimestamp: 0,
            error: 'Internal server error'
        };
        res.status(500).json(response);
    }
}