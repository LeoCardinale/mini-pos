import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import syncRoutes from './routes/syncRoutes';

const app = express();
const prisma = new PrismaClient();

// Middleware para logging
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

// Middleware
app.use(cors());
// Aumentar límite del payload
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Rutas
app.use('/api', syncRoutes);

// Ruta de salud
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Available routes:');
    console.log('- POST /api/sync');
    console.log('- GET /health');
});