// backend/src/routes/authRoutes.ts
import { Router } from 'express';
import { login, validateToken, changePassword } from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/login', login);
router.get('/validate', authenticate, validateToken);
router.post('/change-password', authenticate, changePassword);

export default router;