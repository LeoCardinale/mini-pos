import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import syncRoutes from './routes/syncRoutes';
import { config } from './config';

const app = express();
const prisma = new PrismaClient();

// Middleware para logging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Middleware
app.use(cors({
    origin: config.corsOrigin,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

// Aumentar límite del payload
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Rutas
app.use('/api', syncRoutes);

// Ruta de salud
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        env: config.nodeEnv
    });
});

app.listen(config.port, () => {
    console.log(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
    console.log(`CORS enabled for origin: ${config.corsOrigin}`);
    console.log('Available routes:');
    console.log('- POST /api/sync');
    console.log('- GET /health');
});

// Manejo de señales de terminación
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    prisma.$disconnect();
    process.exit(0);
});