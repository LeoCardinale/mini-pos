import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();

export const getSalesReport = async (req: Request, res: Response) => {
    const { startDate, endDate, source } = req.query;

    try {
        const sales = await prisma.salesRecord.findMany({
            where: {
                createdAt: {
                    gte: startDate ? new Date(startDate as string) : undefined,
                    lte: endDate ? new Date(endDate as string) : undefined
                },
                source: source as string || undefined
            },
            include: {
                product: {
                    select: {
                        name: true,
                        price: true
                    }
                },
                user: {
                    select: { name: true }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        res.json(sales);
    } catch (error) {
        console.error('Error fetching sales report:', error);
        res.status(500).json({ error: 'Error fetching sales report' });
    }
};