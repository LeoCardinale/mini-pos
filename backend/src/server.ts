// backend/src/server.ts
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/authRoutes';
import syncRoutes from './routes/syncRoutes';
import { authenticate } from './middleware/auth';
import userRoutes from './routes/userRoutes';
import productRoutes from './routes/productRoutes';

const app = express();

app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
});

// Middlewares globales
app.use(express.json());
app.use(cookieParser());
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true
}));

// Rutas de autenticación (públicas)
app.use('/api/auth', authRoutes);

// Rutas protegidas
app.use('/api/sync', authenticate, syncRoutes);

app.use('/api/admin/users', authenticate, userRoutes);

app.use('/api/products', productRoutes);

// Manejo de errores global
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Error interno del servidor' });
});

// Iniciar el servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

export default app;