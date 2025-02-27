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
                cedula: true,
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
            cedula: user.cedula,
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
        const { cedula, name, password, roleId } = req.body;

        if (!cedula || !name || !password || !roleId) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Verificar si la cédula ya existe
        const existingUser = await prisma.user.findUnique({
            where: { cedula }
        });

        if (existingUser) {
            return res.status(400).json({ error: 'Cédula already exists' });
        }

        // Hash de la contraseña
        const hashedPassword = await bcrypt.hash(password, 10);

        // Crear usuario
        const user = await prisma.user.create({
            data: {
                cedula,
                name,
                passwordHash: hashedPassword,
                roleId: parseInt(roleId),
                active: true
            },
            select: {
                id: true,
                cedula: true,
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
            cedula: user.cedula,
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
        if (userToToggle.cedula === '20393453') {
            return res.status(403).json({ error: 'Cannot modify admin master account' });
        }

        const updatedUser = await prisma.user.update({
            where: { id },
            data: { active: !userToToggle.active },
            select: {
                id: true,
                cedula: true,
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
            cedula: updatedUser.cedula,
            name: updatedUser.name,
            active: updatedUser.active,
            role: updatedUser.role.name
        });
    } catch (error) {
        console.error('Error toggling user status:', error);
        res.status(500).json({ error: 'Error updating user status' });
    }
};