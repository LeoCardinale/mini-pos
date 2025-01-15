import { Request, Response } from 'express';
import { PrismaClient, AccountType } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

interface TransactionItem {
    productId: number;
    quantity: number;
    price: number;
}

const prisma = new PrismaClient();

export const createAccount = async (req: Request, res: Response) => {
    try {
        const { customerName, type, creditLimit } = req.body;
        const user = (req as AuthRequest).user;

        if (!user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        // Validaciones
        if (!customerName?.trim()) {
            return res.status(400).json({ error: 'Customer name is required' });
        }

        if (!type || !['ACCUMULATED', 'PREPAID'].includes(type)) {
            return res.status(400).json({ error: 'Invalid account type' });
        }

        if (type === 'ACCUMULATED' && creditLimit && creditLimit <= 0) {
            return res.status(400).json({ error: 'Credit limit must be greater than 0' });
        }

        // Verificar l铆mite de cuentas activas
        const activeAccounts = await prisma.account.count({
            where: { status: 'open' }
        });

        if (activeAccounts >= 10) {
            return res.status(400).json({ error: 'Maximum number of active accounts reached' });
        }

        const account = await prisma.account.create({
            data: {
                customerName: customerName.trim(),
                type: type as AccountType,
                status: 'open',
                creditLimit: type === 'ACCUMULATED' ? creditLimit : null,
                createdBy: user.userId
            }
        });

        res.status(201).json(account);
    } catch (error) {
        console.error('Error creating account:', error);
        res.status(500).json({ error: 'Error creating account' });
    }
};

export const getAccounts = async (req: Request, res: Response) => {
    try {
        const accounts = await prisma.account.findMany({
            orderBy: { openedAt: 'desc' }
        });
        res.json(accounts);
    } catch (error) {
        console.error('Error fetching accounts:', error);
        res.status(500).json({ error: 'Error fetching accounts' });
    }
};

export const addPrepaidProducts = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { products, paymentMethod, discount, note } = req.body;
        const user = (req as AuthRequest).user;

        if (!user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const account = await prisma.account.findUnique({
            where: { id: Number(id) }
        });

        if (!account || account.type !== 'PREPAID' || account.status !== 'open') {
            return res.status(400).json({ error: 'Invalid account' });
        }

        await prisma.$transaction(async (prisma) => {
            let totalAmount = 0;
            for (const item of products) {
                // Buscar si el producto ya existe
                const existingProduct = await prisma.prepaidProduct.findFirst({
                    where: {
                        accountId: Number(id),
                        productId: item.productId
                    }
                });

                if (existingProduct) {
                    // Actualizar producto existente
                    await prisma.prepaidProduct.update({
                        where: { id: existingProduct.id },
                        data: {
                            paid: existingProduct.paid + item.quantity
                        }
                    });
                } else {
                    // Crear nuevo producto
                    await prisma.prepaidProduct.create({
                        data: {
                            accountId: Number(id),
                            productId: item.productId,
                            paid: item.quantity,
                            consumed: 0
                        }
                    });
                }

                // Actualizar stock
                await prisma.product.update({
                    where: { id: item.productId },
                    data: {
                        stock: {
                            decrement: item.quantity
                        }
                    }
                });

                const product = await prisma.product.findUnique({
                    where: { id: item.productId }
                });
                totalAmount += item.quantity * (product?.price || 0);
            }

            await prisma.accountTransaction.create({
                data: {
                    accountId: Number(id),
                    amount: totalAmount,
                    type: 'credit',
                    method: paymentMethod,
                    discount: discount || 0,
                    note: note,
                    userId: user.userId
                }
            });
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error adding prepaid products:', error);
        res.status(500).json({ error: 'Error adding prepaid products' });
    }
};

export const getPrepaidProducts = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const products = await prisma.prepaidProduct.findMany({
            where: { accountId: Number(id) },
            include: {
                product: {
                    select: {
                        name: true,
                        price: true
                    }
                }
            }
        });

        res.json(products);
    } catch (error) {
        console.error('Error fetching prepaid products:', error);
        res.status(500).json({ error: 'Error fetching prepaid products' });
    }
};

export const consumePrepaidProduct = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { productId, quantity } = req.body;
        const user = (req as AuthRequest).user;

        if (!user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const prepaidProduct = await prisma.prepaidProduct.findFirst({
            where: {
                accountId: Number(id),
                productId: productId
            }
        });

        if (!prepaidProduct) {
            return res.status(404).json({ error: 'Prepaid product not found' });
        }

        const availableQuantity = prepaidProduct.paid - prepaidProduct.consumed;
        if (quantity > availableQuantity) {
            return res.status(400).json({ error: 'Insufficient prepaid quantity' });
        }

        const updated = await prisma.prepaidProduct.update({
            where: { id: prepaidProduct.id },
            data: {
                consumed: prepaidProduct.consumed + quantity
            }
        });

        res.json(updated);
    } catch (error) {
        console.error('Error consuming prepaid product:', error);
        res.status(500).json({ error: 'Error consuming prepaid product' });
    }
};

export const addAccumulatedItems = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { items }: { items: TransactionItem[] } = req.body;
        const user = (req as AuthRequest).user;

        if (!user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        await prisma.$transaction(async (prisma) => {
            const transaction = await prisma.accountTransaction.create({
                data: {
                    accountId: Number(id),
                    amount: items.reduce((sum, item) => sum + (item.quantity * item.price), 0),
                    type: 'debit',
                    userId: user.userId,
                    items: {
                        create: items.map(item => ({
                            productId: item.productId,
                            quantity: item.quantity,
                            price: item.price
                        }))
                    }
                }
            });

            // Actualizar stock
            for (const item of items) {
                await prisma.product.update({
                    where: { id: item.productId },
                    data: {
                        stock: {
                            decrement: item.quantity
                        }
                    }
                });
            }

            res.json(transaction);
        });
    } catch (error) {
        console.error('Error adding accumulated items:', error);
        res.status(500).json({ error: 'Error adding accumulated items' });
    }
};

export const makePayment = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { amount, method, discount, note } = req.body;
        const user = (req as AuthRequest).user;

        if (!user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const account = await prisma.account.findUnique({
            where: { id: Number(id) },
            include: {
                transactions: true
            }
        });

        if (!account || account.type !== 'ACCUMULATED' || account.status !== 'open') {
            return res.status(400).json({ error: 'Invalid account' });
        }

        // Calcular balance pendiente
        const totalDebit = account.transactions
            .filter(t => t.type === 'debit')
            .reduce((sum: number, t) => sum + t.amount, 0);
        const totalCredit = account.transactions
            .filter(t => t.type === 'credit')
            .reduce((sum: number, t) => sum + t.amount, 0);
        const pendingAmount = parseFloat((totalDebit - totalCredit).toFixed(2));

        if (amount <= 0) {
            return res.status(400).json({ error: 'Payment amount must be greater than 0' });
        }

        if (amount > (pendingAmount - discount)) {
            return res.status(400).json({ error: 'Payment amount exceeds pending balance' });
        }

        const payment = await prisma.accountTransaction.create({
            data: {
                accountId: Number(id),
                amount: amount,
                type: 'credit',
                userId: user.userId,
                method: method || 'cash',
                discount: discount || 0,
                note: note
            }
        });

        res.json(payment);
    } catch (error) {
        console.error('Error processing payment:', error);
        res.status(500).json({ error: 'Error processing payment' });
    }
};

export const closeAccount = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const user = (req as AuthRequest).user;

        if (!user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const account = await prisma.account.findUnique({
            where: { id: Number(id) },
            include: {
                transactions: true,
                products: true
            }
        });

        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }

        if (account.status !== 'open') {
            return res.status(400).json({ error: 'Account already closed' });
        }

        if (account.type === 'ACCUMULATED') {
            const totalDebit = account.transactions
                .filter(t => t.type === 'debit')
                .reduce((sum: number, t) => sum + t.amount, 0);

            const totalCredit = account.transactions
                .filter(t => t.type === 'credit')
                .reduce((sum: number, t) => sum + t.amount + (t.discount || 0), 0);

            const balance = parseFloat((totalDebit - totalCredit).toFixed(2));

            if (Math.abs(balance) > 0.01) {
                return res.status(400).json({ error: 'Account has pending balance' });
            }
        }

        if (account.type === 'PREPAID') {
            const hasUnconsumedProducts = account.products.some(p => p.paid > p.consumed);
            if (hasUnconsumedProducts) {
                return res.status(400).json({ error: 'Account has unconsumed products' });
            }
        }

        const updated = await prisma.account.update({
            where: { id: Number(id) },
            data: {
                status: 'closed',
                closedAt: new Date(),
                closedBy: user.userId
            }
        });

        res.json(updated);
    } catch (error) {
        console.error('Error closing account:', error);
        res.status(500).json({ error: 'Error closing account' });
    }
};

export const getAccountReport = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const account = await prisma.account.findUnique({
            where: { id: Number(id) },
            include: {
                transactions: {
                    include: {
                        items: {
                            include: {
                                product: true
                            }
                        },
                        user: {
                            select: {
                                name: true
                            }
                        }
                    }
                },
                creator: {
                    select: {
                        name: true
                    }
                },
                closer: {
                    select: {
                        name: true
                    }
                }
            }
        });

        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }

        if (account.type !== 'ACCUMULATED') {
            return res.status(400).json({ error: 'Report only available for accumulated accounts' });
        }

        const csvRows = [
            ['Account Report'],
            ['Customer', account.customerName],
            ['Open Date', account.openedAt.toLocaleString()],
            ['Close Date', account.closedAt?.toLocaleString() || 'Open'],
            ['Created By', account.creator.name],
            ['Closed By', account.closer?.name || 'N/A'],
            ['Credit Limit', account.creditLimit?.toString() || 'N/A'],
            [''],
            ['Transaction Details'],
            ['Date', 'Type', 'Product', 'Quantity', 'Price', 'Subtotal', 'User']
        ];

        // Agregar transacciones
        account.transactions.forEach(t => {
            if (t.type === 'debit') {
                t.items.forEach(item => {
                    csvRows.push([
                        t.createdAt.toLocaleString(),
                        'Consumption',
                        item.product.name,
                        item.quantity.toString(),
                        item.price.toFixed(2),
                        (item.quantity * item.price).toFixed(2),
                        t.user.name
                    ]);
                });
            } else {
                csvRows.push([
                    t.createdAt.toLocaleString(),
                    'Payment',
                    '-',
                    '-',
                    '-',
                    t.amount.toFixed(2),
                    t.user.name
                ]);
            }
        });

        // Agregar resumen
        const totalConsumed = account.transactions
            .filter(t => t.type === 'debit')
            .reduce((sum, t) => sum + t.amount, 0);

        const totalPaid = account.transactions
            .filter(t => t.type === 'credit')
            .reduce((sum, t) => sum + t.amount, 0);

        csvRows.push(
            [''],
            ['Summary'],
            ['Total Consumed', totalConsumed.toFixed(2)],
            ['Total Payments', totalPaid.toFixed(2)],
            ['Balance', (totalConsumed - totalPaid).toFixed(2)]
        );

        const csvContent = csvRows
            .map(row => row.map(cell => `"${cell}"`).join(','))
            .join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=account-${id}-report.csv`);
        res.send(csvContent);

    } catch (error) {
        console.error('Error generating report:', error);
        res.status(500).json({ error: 'Error generating report' });
    }
};

export const getAccount = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const account = await prisma.account.findUnique({
            where: { id: Number(id) },
            include: {
                creator: {
                    select: { name: true }
                },
                closer: {
                    select: { name: true }
                }
            }
        });

        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }

        res.json(account);
    } catch (error) {
        console.error('Error fetching account:', error);
        res.status(500).json({ error: 'Error fetching account' });
    }
};

export const getAccountTransactions = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Primero crear la nueva columna si no existe
        await prisma.$executeRaw`ALTER TABLE "AccountTransaction" 
            ADD COLUMN IF NOT EXISTS "method" TEXT,
            ADD COLUMN IF NOT EXISTS "discount" FLOAT DEFAULT 0,
            ADD COLUMN IF NOT EXISTS "note" TEXT`;

        const transactions = await prisma.accountTransaction.findMany({
            where: { accountId: Number(id) },
            include: {
                items: {
                    include: {
                        product: {
                            select: {
                                name: true,
                                price: true
                            }
                        }
                    }
                },
                user: {
                    select: {
                        name: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        res.json(transactions);
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ error: 'Error fetching transactions' });
    }
};

export const addAccountTransaction = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { items } = req.body; // Array de {productId, quantity, price}
        const user = (req as AuthRequest).user;

        if (!user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const transaction = await prisma.accountTransaction.create({
            data: {
                accountId: Number(id),
                amount: items.reduce((sum: number, item: any) => sum + (item.quantity * item.price), 0),
                type: 'debit',
                userId: user.userId,
                items: {
                    create: items.map((item: any) => ({
                        productId: item.productId,
                        quantity: item.quantity,
                        price: item.price
                    }))
                }
            },
            include: {
                items: true
            }
        });

        res.json(transaction);
    } catch (error) {
        console.error('Error adding transaction:', error);
        res.status(500).json({ error: 'Error adding transaction' });
    }
};