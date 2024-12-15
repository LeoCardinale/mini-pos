// backend/src/routes/productRoutes.ts
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/roleMiddleware';
import {
    getProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    toggleProductStatus
} from '../controllers/productController';

const router = Router();

// Rutas públicas (solo obtener productos)
router.get('/', authenticate, getProducts);

// Rutas protegidas (solo admin)
router.post('/', authenticate, requireRole(['admin']), createProduct);
router.put('/:id', authenticate, requireRole(['admin', 'user']), updateProduct);
router.delete('/:id', authenticate, requireRole(['admin']), deleteProduct);

router.patch('/:id/toggle-status', authenticate, requireRole(['admin']), (req, res, next) => {
    console.log('Route hit: toggle-status');
    next();
}, toggleProductStatus);

export default router;