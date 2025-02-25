// backend/src/controllers/inventoryLogController.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();

export const getLogs = async (req: Request, res: Response) => {
    try {
        const logs = await prisma.auditLog.findMany({
            where: {
                entity: 'product'
            },
            include: {
                user: {
                    select: {
                        name: true
                    }
                },
                product: {
                    select: {
                        name: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            },
            take: 100 // Limitar la cantidad de logs
        });

        res.json(logs);
    } catch (error) {
        console.error('Error fetching audit logs:', error);
        res.status(500).json({ error: 'Error fetching audit logs' });
    }
};

export const createLog = async (req: Request, res: Response) => {
    try {
        const { id, action, productId, description } = req.body;
        const user = (req as AuthRequest).user;

        if (!user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        // No usar el ID proporcionado por el cliente
        const logData = {
            action,
            entity: 'product',
            entityId: productId.toString(),
            changes: typeof description === 'string'
                ? description
                : JSON.stringify(description),
            userId: user.userId,
            productId: productId
        };

        const log = await prisma.auditLog.create({
            data: logData
        });

        // Ahora agreguemos un campo que relacione el ID del cliente con el ID del servidor
        // en la respuesta para que el cliente pueda hacer la relación
        res.status(201).json({
            ...log,
            clientId: id // Devolvemos el ID del cliente para que pueda relacionarlos
        });
    } catch (error) {
        console.error('Error creating audit log:', error);
        res.status(500).json({ error: 'Error creating audit log' });
    }
};