import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAdmin() {
    try {
        const admin = await prisma.user.findUnique({
            where: {
                cedula: '20393453'
            },
            select: {
                cedula: true,
                passwordHash: true,
                name: true,
                role: true
            }
        });

        console.log('Admin user details:');
        console.log(JSON.stringify(admin, null, 2));
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkAdmin();