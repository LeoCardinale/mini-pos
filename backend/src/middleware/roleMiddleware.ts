// backend/src/middleware/roleMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

export const requireRole = (roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = (req as AuthRequest).user;

        if (!user || !roles.includes(user.role)) {
            return res.status(403).json({
                error: 'Access denied: insufficient permissions'
            });
        }

        next();
    };
};