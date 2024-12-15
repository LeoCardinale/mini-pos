// backend/src/routes/supplierRoutes.ts
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/roleMiddleware';
import {
    getSuppliers,
    createSupplier,
    updateSupplier,
    getActiveSuppliers
} from '../controllers/supplierController';
import { deleteSupplier } from '../controllers/supplierController';

const router = Router();

// Ruta para obtener lista simple de proveedores activos (para dropdowns)
router.get('/active', authenticate, getActiveSuppliers);

// Rutas protegidas (solo admin)
router.get('/', authenticate, requireRole(['admin']), getSuppliers);
router.post('/', authenticate, requireRole(['admin']), createSupplier);
router.put('/:id', authenticate, requireRole(['admin']), updateSupplier);
router.delete('/:id', authenticate, requireRole(['admin']), deleteSupplier);


export default router;