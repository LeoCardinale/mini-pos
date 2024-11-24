// backend/src/types/auth.ts
import { z } from 'zod';

export const loginSchema = z.object({
    email: z.string().email('Email inválido'),
    password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres')
});

export type LoginRequest = z.infer<typeof loginSchema>;

export interface JWTPayload {
    userId: string;
    email: string;
    role: string;
    permissions: string[];
}

export interface AuthenticatedRequest extends Express.Request {
    user?: JWTPayload;
}