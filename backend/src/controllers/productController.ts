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
        const { name, price, cost, stock, category, barcode, minStock, supplierId, imageUrl } = req.body;
        console.log('Creating product with image:', imageUrl ? 'Image present' : 'No image');
        const user = (req as AuthRequest).user;

        if (!user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        // Validaciones básicas
        if (!name || price === undefined || cost === undefined || stock === undefined) {
            return res.status(400).json({ error: 'Name, price, cost and stock are required' });
        }

        // Verificar si ya existe un producto con el mismo nombre
        const existingName = await prisma.product.findFirst({
            where: { name: { equals: name, mode: 'insensitive' } }
        });

        if (existingName) {
            return res.status(400).json({ error: 'A product with this name already exists' });
        }

        // Verificar si existe un producto con el mismo código de barras (si se proporciona)
        if (barcode) {
            const existingBarcode = await prisma.product.findFirst({
                where: { barcode }
            });

            if (existingBarcode) {
                return res.status(400).json({ error: 'A product with this barcode already exists' });
            }
        }

        const productData = {
            name,
            price: Number(price),
            cost: Number(cost),
            stock: Number(stock),
            category,
            barcode,
            minStock: minStock ? Number(minStock) : null,
            imageUrl,
            isActive: req.body.isActive ?? true,
            createdBy: user.userId,
            updatedBy: user.userId
        };

        if (supplierId) {
            Object.assign(productData, { supplierId: Number(supplierId) });
        }

        const product = await prisma.product.create({
            data: productData
        });
        console.log('Product saved with imageUrl:', product.imageUrl ? 'Yes' : 'No');

        res.status(201).json(product);
    } catch (error) {
        console.error('Error creating product:', error);
        res.status(500).json({ error: 'Error creating product' });
    }
};

export const updateProduct = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, price, stock, category, barcode, minStock, isActive, imageUrl } = req.body;  // Agregar imageUrl
        const user = (req as AuthRequest).user;

        if (!user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const existingProduct = await prisma.product.findUnique({
            where: { id: Number(id) }
        });

        if (!existingProduct) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const updateData = {
            name,
            price: price !== undefined ? Number(price) : undefined,
            stock: stock !== undefined ? Number(stock) : undefined,
            category,
            barcode,
            minStock: minStock ? Number(minStock) : null,
            isActive: isActive ?? existingProduct.isActive,
            imageUrl: imageUrl || undefined,  // Agregar esta línea
            updatedBy: user.userId
        };

        const product = await prisma.product.update({
            where: { id: Number(id) },
            data: updateData
        });

        res.json(product);
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ error: 'Error updating product' });
    }
};

export const toggleProductStatus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        console.log('Backend: Attempting to toggle product status for ID:', id);

        // Primero obtener el estado actual
        const currentProduct = await prisma.product.findUnique({
            where: { id: Number(id) }
        });
        console.log('Backend: Current product state:', currentProduct);

        if (!currentProduct) {
            return res.status(404).json({ error: 'Product not found' });
        }

        // Luego actualizar al estado opuesto
        const product = await prisma.product.update({
            where: { id: Number(id) },
            data: {
                isActive: !currentProduct.isActive,
                updatedBy: (req as AuthRequest).user!.userId
            }
        });
        console.log('Backend: Updated product state:', product);

        res.json(product);
    } catch (error) {
        console.error('Backend: Error toggling product status:', error);
        res.status(500).json({ error: 'Error toggling product status' });
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