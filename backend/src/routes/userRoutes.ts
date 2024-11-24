// backend/src/routes/userRoutes.ts
import { Router } from 'express';
import { getUsers, createUser, toggleUserStatus } from '../controllers/userController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, getUsers);
router.post('/', authenticate, createUser);
router.patch('/:id/toggle-status', authenticate, toggleUserStatus);

export default router;