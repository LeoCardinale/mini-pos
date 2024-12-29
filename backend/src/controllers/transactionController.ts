// controllers/transactionController.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();

export const cancelTransaction = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const user = (req as AuthRequest).user;

        if (!user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const transaction = await prisma.transaction.findUnique({
            where: { id: Number(id) },
            include: { items: true }
        });

        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        const updatedTransaction = await prisma.$transaction(async (prisma) => {
            // Actualizar stock de productos
            for (const item of transaction.items) {
                await prisma.product.update({
                    where: { id: item.productId },
                    data: {
                        stock: { increment: item.quantity }
                    }
                });
            }

            // Eliminar registro de ventas
            await prisma.salesRecord.deleteMany({
                where: {
                    sourceId: id.toString()
                }
            });

            // Marcar transacción como cancelada
            return await prisma.transaction.update({
                where: { id: Number(id) },
                data: { status: 'cancelled' },
                include: { items: true }
            });
        });

        res.json(updatedTransaction);
    } catch (error) {
        console.error('Error cancelling transaction:', error);
        res.status(500).json({ error: 'Error cancelling transaction' });
    }
};

export const createTransaction = async (req: Request, res: Response) => {
    try {
        const transactionData = req.body;
        const user = (req as AuthRequest).user;

        if (!user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const transaction = await prisma.transaction.create({
            data: {
                ...transactionData,
                userId: user.userId,
                items: {
                    create: transactionData.items
                }
            },
            include: {
                items: true
            }
        });

        res.status(201).json(transaction);
    } catch (error) {
        console.error('Error creating transaction:', error);
        res.status(500).json({ error: 'Error creating transaction' });
    }
};