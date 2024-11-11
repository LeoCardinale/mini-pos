import { Router } from 'express';
import { sync } from '../controllers/syncController';

const router = Router();

router.post('/sync', sync);

export default router;