// backend/src/routes/productRoutes.ts
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/roleMiddleware';
import {
    getProducts,
    createProduct,
    updateProduct,
    deleteProduct,
} from '../controllers/productController';

const router = Router();

// Rutas públicas (solo obtener productos)
router.get('/', authenticate, getProducts);

// Rutas protegidas (solo admin)
router.post('/', authenticate, requireRole(['admin']), createProduct);
router.put('/:id', authenticate, requireRole(['admin']), updateProduct);
router.delete('/:id', authenticate, requireRole(['admin']), deleteProduct);

export default router;