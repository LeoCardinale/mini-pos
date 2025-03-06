// backend/src/controllers/inventoryLogController.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getInventoryLogs = async (req: Request, res: Response) => {
    try {
        const { limit = 100, offset = 0 } = req.query;

        // Contar total para paginación
        const totalCount = await prisma.inventoryLog.count();

        // Obtener logs con límite y desplazamiento
        const logs = await prisma.inventoryLog.findMany({
            include: {
                user: {
                    select: { name: true }
                }
                // Ya no hay relación con 'product'
            },
            orderBy: { timestamp: 'desc' },
            take: Number(limit),
            skip: Number(offset)
        });

        // Formatear para el cliente
        const formattedLogs = logs.map(log => ({
            id: log.id,
            timestamp: log.timestamp,
            productId: log.productId,
            productName: log.productName, // Usar el campo directo, no la relación
            userId: log.userId,
            userName: log.user?.name || 'Usuario', // User sigue siendo una relación
            action: log.action,
            description: log.description
        }));

        res.json({
            logs: formattedLogs,
            totalCount,
            hasMore: totalCount > Number(offset) + logs.length
        });
    } catch (error) {
        console.error('Error fetching inventory logs:', error);
        res.status(500).json({ error: 'Error fetching inventory logs' });
    }
};