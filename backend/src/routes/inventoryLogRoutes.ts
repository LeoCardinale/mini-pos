// backend/src/routes/inventoryLogRoutes.ts
import { Router } from 'express';
import { getInventoryLogs } from '../controllers/inventoryLogController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, getInventoryLogs);

export default router;