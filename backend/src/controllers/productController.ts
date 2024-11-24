// backend/src/controllers/productController.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();

export const getProducts = async (req: Request, res: Response) => {
    try {
        const products = await prisma.product.findMany({
            orderBy: {
                name: 'asc'
            }
        });
        res.json(products);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: 'Error fetching products' });
    }
};

export const createProduct = async (req: Request, res: Response) => {
    try {
        const { name, price, stock, category, barcode, minStock } = req.body;
        const user = (req as AuthRequest).user;

        if (!user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        // Validaciones básicas
        if (!name || price === undefined || stock === undefined) {
            return res.status(400).json({ error: 'Name, price and stock are required' });
        }

        // Verificar si el código de barras ya existe
        if (barcode) {
            const existingProduct = await prisma.product.findFirst({
                where: { barcode }
            });

            if (existingProduct) {
                return res.status(400).json({ error: 'Barcode already exists' });
            }
        }

        const product = await prisma.product.create({
            data: {
                name,
                price: Number(price),
                stock: Number(stock),
                category,
                barcode,
                minStock: minStock ? Number(minStock) : null,
                creator: {
                    connect: { id: user.userId }
                },
                updater: {
                    connect: { id: user.userId }
                }
            }
        });

        res.status(201).json(product);
    } catch (error) {
        console.error('Error creating product:', error);
        res.status(500).json({ error: 'Error creating product' });
    }
};

export const updateProduct = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, price, stock, category, barcode, minStock } = req.body;
        const user = (req as AuthRequest).user;

        if (!user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        // Verificar si el producto existe
        const existingProduct = await prisma.product.findUnique({
            where: { id: Number(id) }
        });

        if (!existingProduct) {
            return res.status(404).json({ error: 'Product not found' });
        }

        // Verificar si el nuevo código de barras ya existe en otro producto
        if (barcode && barcode !== existingProduct.barcode) {
            const barcodeExists = await prisma.product.findFirst({
                where: {
                    barcode,
                    id: { not: Number(id) }
                }
            });

            if (barcodeExists) {
                return res.status(400).json({ error: 'Barcode already exists' });
            }
        }

        const product = await prisma.product.update({
            where: { id: Number(id) },
            data: {
                name,
                price: price !== undefined ? Number(price) : undefined,
                stock: stock !== undefined ? Number(stock) : undefined,
                category,
                barcode,
                minStock: minStock ? Number(minStock) : null,
                updater: {
                    connect: { id: user.userId }
                }
            }
        });

        res.json(product);
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ error: 'Error updating product' });
    }
};

export const deleteProduct = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Verificar si el producto existe
        const existingProduct = await prisma.product.findUnique({
            where: { id: Number(id) }
        });

        if (!existingProduct) {
            return res.status(404).json({ error: 'Product not found' });
        }

        await prisma.product.delete({
            where: { id: Number(id) }
        });

        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ error: 'Error deleting product' });
    }
};