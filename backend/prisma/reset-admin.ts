import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function resetAdmin() {
    try {
        const adminPassword = 'admin123';
        const hashedPassword = await bcrypt.hash(adminPassword, 10);

        const updatedAdmin = await prisma.user.update({
            where: {
                cedula: '20393453'
            },
            data: {
                passwordHash: hashedPassword
            }
        });

        console.log('Admin password reset successfully');
        console.log('Admin cedula:', updatedAdmin.cedula);
    } catch (error) {
        console.error('Error resetting admin password:', error);
    } finally {
        await prisma.$disconnect();
    }
}

resetAdmin();