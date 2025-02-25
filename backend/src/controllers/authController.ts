// backend/src/controllers/authController.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export const login = async (req: Request, res: Response) => {
    try {
        const { cedula, password } = req.body;

        if (!cedula || !password) {
            return res.status(400).json({ error: 'Cédula and password are required' });
        }

        const user = await prisma.$queryRaw`
            SELECT u.*, r.name as role_name, r.permissions 
            FROM "User" u 
            JOIN "Role" r ON u."roleId" = r.id 
            WHERE u.cedula = ${cedula}
        `;
        console.log('User found:', user); // Log del usuario encontrado

        if (!user || !Array.isArray(user) || user.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const userData = user[0];
        console.log('Comparing passwords...'); // Log antes de comparar contraseñas

        // Verificar contraseña
        const validPassword = await bcrypt.compare(password, userData.passwordHash);
        console.log('Password valid:', validPassword); // Log del resultado de la comparación

        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generar token
        const token = jwt.sign(
            {
                userId: userData.id,
                cedula: userData.cedula,
                role: userData.role_name
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Enviar respuesta
        res.json({
            token,
            user: {
                id: userData.id,
                cedula: userData.cedula,
                name: userData.name,
                role: userData.role_name
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

export const validateToken = async (req: Request, res: Response) => {
    try {
        const authHeader = req.header('Authorization');
        if (!authHeader) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.replace('Bearer ', '');
        const decoded = jwt.verify(token, JWT_SECRET);
        res.json({ valid: true, user: decoded });
    } catch (error) {
        res.status(401).json({ valid: false, error: 'Invalid token' });
    }
};

export const changePassword = async (req: Request, res: Response) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = (req as AuthRequest).user;

        if (!user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const dbUser = await prisma.user.findUnique({
            where: { id: user.userId }
        });

        if (!dbUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Verificar contraseña actual
        const validPassword = await bcrypt.compare(currentPassword, dbUser.passwordHash);
        if (!validPassword) {
            return res.status(400).json({ error: 'Current password is incorrect' });
        }

        // Actualizar contraseña
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
            where: { id: user.userId },
            data: { passwordHash: hashedPassword }
        });

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Error changing password' });
    }
};