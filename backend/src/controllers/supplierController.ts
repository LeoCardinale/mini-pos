// backend/src/controllers/supplierController.ts
import { Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
});

export const getSuppliers = async (req: Request, res: Response) => {
    try {
        const suppliers = await prisma.supplier.findMany({
            orderBy: {
                tradeName: 'asc'
            }
        });
        res.json(suppliers);
    } catch (error) {
        console.error('Error fetching suppliers:', error);
        res.status(500).json({ error: 'Error fetching suppliers' });
    }
};

export const createSupplier = async (req: Request, res: Response) => {
    try {
        const {
            fiscalName,
            tradeName,
            contact,
            phone,
            email,
            taxId,
            address,
            notes
        } = req.body;

        // Validaciones básicas
        if (!fiscalName || !tradeName) {
            return res.status(400).json({
                error: 'Fiscal name and trade name are required'
            });
        }

        // Verificar si ya existe un proveedor con el mismo RIF/NIF
        if (taxId) {
            const existing = await prisma.supplier.findFirst({
                where: { taxId }
            });

            if (existing) {
                return res.status(400).json({
                    error: 'A supplier with this tax ID already exists'
                });
            }
        }

        const supplier = await prisma.supplier.create({
            data: {
                fiscalName,
                tradeName,
                contact,
                phone,
                email,
                taxId,
                address,
                notes,
                active: true
            }
        });

        res.status(201).json(supplier);
    } catch (error) {
        console.error('Error creating supplier:', error);
        res.status(500).json({ error: 'Error creating supplier' });
    }
};

export const updateSupplier = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const {
            fiscalName,
            tradeName,
            contact,
            phone,
            email,
            taxId,
            address,
            notes,
            active
        } = req.body;

        // Verificar si el proveedor existe
        const existing = await prisma.supplier.findUnique({
            where: { id: Number(id) }
        });

        if (!existing) {
            return res.status(404).json({ error: 'Supplier not found' });
        }

        // Verificar si el nuevo RIF/NIF ya existe
        if (taxId && taxId !== existing.taxId) {
            const taxIdExists = await prisma.supplier.findFirst({
                where: {
                    taxId,
                    id: { not: Number(id) }
                }
            });

            if (taxIdExists) {
                return res.status(400).json({
                    error: 'A supplier with this tax ID already exists'
                });
            }
        }

        const supplier = await prisma.supplier.update({
            where: { id: Number(id) },
            data: {
                fiscalName,
                tradeName,
                contact,
                phone,
                email,
                taxId,
                address,
                notes,
                active
            }
        });

        res.json(supplier);
    } catch (error) {
        console.error('Error updating supplier:', error);
        res.status(500).json({ error: 'Error updating supplier' });
    }
};

export const getActiveSuppliers = async (req: Request, res: Response) => {
    try {
        const suppliers = await prisma.supplier.findMany({
            where: {
                active: true
            },
            orderBy: {
                tradeName: 'asc'
            },
            select: {
                id: true,
                fiscalName: true,
                tradeName: true
            }
        });
        res.json(suppliers);
    } catch (error) {
        console.error('Error fetching active suppliers:', error);
        res.status(500).json({ error: 'Error fetching suppliers' });
    }
};

export const deleteSupplier = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Verificar si el proveedor existe
        const existing = await prisma.supplier.findUnique({
            where: { id: Number(id) }
        });

        if (!existing) {
            return res.status(404).json({ error: 'Supplier not found' });
        }

        // Eliminar el proveedor
        await prisma.supplier.delete({
            where: { id: Number(id) }
        });

        res.json({ message: 'Supplier deleted successfully' });
    } catch (error) {
        console.error('Error deleting supplier:', error);
        res.status(500).json({ error: 'Error deleting supplier' });
    }
};