// backend/src/utils/auth.ts
import jwt from 'jsonwebtoken';
import { JWTPayload } from '../types/auth';
import { config } from '../config';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = '24h';

export const generateToken = (payload: JWTPayload): string => {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

export const verifyToken = (token: string): JWTPayload => {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
};

export const extractTokenFromHeader = (header: string): string | null => {
    const match = header.match(/^Bearer (.+)$/);
    return match ? match[1] : null;
};

// Función auxiliar para verificar permisos
export const hasPermission = (userPermissions: string[], requiredPermission: string): boolean => {
    return userPermissions.includes(requiredPermission);
};