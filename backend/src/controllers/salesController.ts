import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getSalesReport = async (req: Request, res: Response) => {
    const { startDate, endDate, source } = req.query;
    console.log('Fetching sales report with params:', { startDate, endDate, source });

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

        console.log('Found sales records:', sales.map(s => ({
            id: s.id,
            sourceId: s.sourceId,
            source: s.source,
            createdAt: s.createdAt
        })));

        res.json(sales);
    } catch (error) {
        console.error('Error fetching sales report:', error);
        res.status(500).json({ error: 'Error fetching sales report' });
    }
};