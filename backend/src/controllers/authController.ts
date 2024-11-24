// backend/src/controllers/authController.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;
        console.log('Login attempt:', { email }); // Log de intento

        // Validación básica
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Buscar usuario y su rol
        const user = await prisma.$queryRaw`
            SELECT u.*, r.name as role_name, r.permissions 
            FROM "User" u 
            JOIN "Role" r ON u."roleId" = r.id 
            WHERE u.email = ${email}
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
                email: userData.email,
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
                email: userData.email,
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