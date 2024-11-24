// backend/src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Definir la interfaz para el payload del token
interface JWTPayload {
    userId: string;
    email: string;
    role: string;
}

// Extender Request para incluir el usuario
export interface AuthRequest extends Request {
    user?: JWTPayload;
}

export const authenticate = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const authHeader = req.header('Authorization');
        console.log('Auth header:', authHeader);

        if (!authHeader) {
            console.log('No authorization header present');
            return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.replace('Bearer ', '');
        console.log('Token extracted, attempting verification');

        const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
        console.log('Token verified successfully');

        (req as AuthRequest).user = decoded;
        next();
    } catch (error) {
        console.log('Authentication error:', error);
        res.status(401).json({ error: 'Invalid token' });
    }
};

// Middleware simple para verificar rol
export const requireAdmin = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const user = (req as AuthRequest).user;
    if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied' });
    }
    next();
};