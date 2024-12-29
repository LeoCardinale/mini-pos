import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { cancelTransaction, createTransaction } from '../controllers/transactionController';

const router = Router();

router.post('/', authenticate, createTransaction);
router.put('/:id/cancel', authenticate, cancelTransaction);

export default router;