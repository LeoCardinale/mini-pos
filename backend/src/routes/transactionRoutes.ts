import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { cancelTransaction } from '../controllers/transactionController';

const router = Router();

router.put('/:id/cancel', authenticate, cancelTransaction);

export default router;