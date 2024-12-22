import { Router } from 'express';
import { getSalesReport } from '../controllers/salesController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, getSalesReport);  // Quitamos requireRole

export default router;