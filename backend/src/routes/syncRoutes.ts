import { Router } from 'express';
import cors from 'cors';
import { sync } from '../controllers/syncController';
import { config } from '../config';

const router = Router();

// Configurar CORS específicamente para la ruta de sync
const corsOptions = {
    origin: config.corsOrigin,
    credentials: true
};

router.post('/', cors(corsOptions), sync);

export default router;