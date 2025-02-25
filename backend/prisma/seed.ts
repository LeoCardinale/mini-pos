// prisma/seed.ts
import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

declare global {
    var prisma: PrismaClient | undefined;
}

const prisma = global.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
    global.prisma = prisma;
}

const adminPermissions = [
    'manage_users',
    'manage_roles',
    'manage_products',
    'manage_inventory',
    'manage_transactions',
    'manage_cash_register',
    'view_reports',
    'export_data'
] as const;

const userPermissions = [
    'manage_products',
    'manage_inventory',
    'manage_transactions',
    'manage_cash_register',
    'view_reports'
] as const;

async function main() {
    try {
        // Crear rol de admin
        const adminRole = await prisma.$queryRaw`
            INSERT INTO "Role" (name, permissions, "createdAt", "updatedAt")
            VALUES ('admin', ${adminPermissions}::text[], NOW(), NOW())
            ON CONFLICT (name) DO UPDATE
            SET permissions = ${adminPermissions}::text[]
            RETURNING id, name;
        `;

        // Crear rol de usuario
        const userRole = await prisma.$queryRaw`
            INSERT INTO "Role" (name, permissions, "createdAt", "updatedAt")
            VALUES ('user', ${userPermissions}::text[], NOW(), NOW())
            ON CONFLICT (name) DO UPDATE
            SET permissions = ${userPermissions}::text[]
            RETURNING id, name;
        `;

        // Crear usuario admin
        const adminPassword = 'admin123';
        const hashedPassword = await bcrypt.hash(adminPassword, 10);

        await prisma.$executeRaw`
            INSERT INTO "User" (id, cedula, name, "passwordHash", "roleId", active, "createdAt", "updatedAt")
            VALUES (
                gen_random_uuid(),
                '12345678',
                'Admin User',
                ${hashedPassword},
                (SELECT id FROM "Role" WHERE name = 'admin'),
                true,
                NOW(),
                NOW()
            )
            ON CONFLICT (cedula) DO NOTHING;
        `;

        console.log('Seed completed successfully');
    } catch (error) {
        console.error('Error in seed:', error);
        throw error;
    }
}

main()
    .catch((error) => {
        console.error(error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });