// backend/src/controllers/userController.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();

// Listar usuarios
export const getUsers = async (req: Request, res: Response) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                name: true,
                active: true,
                role: {
                    select: {
                        name: true
                    }
                }
            }
        });

        const formattedUsers = users.map(user => ({
            id: user.id,
            email: user.email,
            name: user.name,
            active: user.active,
            role: user.role.name
        }));

        res.json(formattedUsers);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Error fetching users' });
    }
};

// Crear usuario
export const createUser = async (req: Request, res: Response) => {
    try {
        const { email, name, password, roleId } = req.body;

        // Validaciones básicas
        if (!email || !name || !password || !roleId) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Verificar si el email ya existe
        const existingUser = await prisma.user.findUnique({
            where: { email }
        });

        if (existingUser) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        // Hash de la contraseña
        const hashedPassword = await bcrypt.hash(password, 10);

        // Crear usuario
        const user = await prisma.user.create({
            data: {
                email,
                name,
                passwordHash: hashedPassword,
                roleId: parseInt(roleId),
                active: true
            },
            select: {
                id: true,
                email: true,
                name: true,
                active: true,
                role: {
                    select: {
                        name: true
                    }
                }
            }
        });

        res.status(201).json({
            id: user.id,
            email: user.email,
            name: user.name,
            active: user.active,
            role: user.role.name
        });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: 'Error creating user' });
    }
};

// Actualizar estado del usuario
export const toggleUserStatus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const currentUser = (req as AuthRequest).user;

        // Verificar que no sea el admin principal
        const userToToggle = await prisma.user.findUnique({
            where: { id },
            include: { role: true }
        });

        if (!userToToggle) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Prevenir la desactivación del admin master
        if (userToToggle.email === 'admin@example.com') {
            return res.status(403).json({ error: 'Cannot modify admin master account' });
        }

        const updatedUser = await prisma.user.update({
            where: { id },
            data: { active: !userToToggle.active },
            select: {
                id: true,
                email: true,
                name: true,
                active: true,
                role: {
                    select: {
                        name: true
                    }
                }
            }
        });

        res.json({
            id: updatedUser.id,
            email: updatedUser.email,
            name: updatedUser.name,
            active: updatedUser.active,
            role: updatedUser.role.name
        });
    } catch (error) {
        console.error('Error toggling user status:', error);
        res.status(500).json({ error: 'Error updating user status' });
    }
};