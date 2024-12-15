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

        if (transaction.userId !== user.userId) {
            return res.status(403).json({ error: 'Not authorized' });
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

            // Marcar transacción como cancelada y retornar la transacción actualizada
            return await prisma.transaction.update({
                where: { id: Number(id) },
                data: { status: 'cancelled' }
            });
        });

        res.json(updatedTransaction);
    } catch (error) {
        console.error('Error cancelling transaction:', error);
        res.status(500).json({ error: 'Error cancelling transaction' });
    }
};