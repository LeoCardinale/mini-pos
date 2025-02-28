import { openDB, IDBPDatabase } from 'idb';
import { config } from '../../config';
import { Product, Transaction, AccountTransaction, CashRegister, Currency, Wallet, Account, AccountType, AccountTransactionItem, PrepaidProduct, InventoryLog, SyncEntityType } from '../../types';
import { SyncOperation } from '../../types/sync';

type CreateProductData = Omit<Product, 'id' | 'createdAt' | 'updatedAt'>;
type UpdateProductData = Partial<CreateProductData>;

// Interfaces
interface SyncQueueItem {
    id: string;
    timestamp: number;
    type: 'create' | 'update' | 'delete';
    entity: 'product' | 'transaction' | 'cashRegister';
    data: string;
    deviceId: string;
    status: 'pending' | 'completed' | 'failed';
}

interface DBSchema {
    products: {
        key: number;
        value: Product;
        indexes: { 'by-category': string };
    };
    transactions: {
        key: number;
        value: Transaction;
    };
    cashRegister: {
        key: number;
        value: CashRegister;
    };
    syncQueue: {
        key: string;
        value: SyncQueueItem;
        indexes: { 'by-status': string };
    };
    accountTransactions: {
        key: number;
        value: AccountTransaction;
        indexes: { 'by-account': number };
    };
    accounts: {
        key: number;
        value: Account;
    };
    inventoryLogs: {
        key: string;
        value: InventoryLog;
        indexes: { 'by-timestamp': number };
    };
}

interface AccountItemsMetadata {
    amount?: number;
    method?: string;
    discount?: number;
    note?: string;
    currency?: Currency;
}

let db: IDBPDatabase<DBSchema>;

export const initDatabase = async () => {
    if (db) return db;

    db = await openDB<DBSchema>('pos-db', 3, {
        upgrade(db, oldVersion, newVersion) {
            // Stores existentes
            if (!db.objectStoreNames.contains('products')) {
                const productStore = db.createObjectStore('products', { keyPath: 'id', autoIncrement: true });
                productStore.createIndex('by-category', 'category');
            }

            if (!db.objectStoreNames.contains('transactions')) {
                // Si existe la store antigua, la eliminamos
                if (oldVersion < 2 && db.objectStoreNames.contains('transactions')) {
                    db.deleteObjectStore('transactions');
                }
                // Crear nueva store con la estructura actualizada
                db.createObjectStore('transactions', { keyPath: 'id', autoIncrement: true });
            }

            if (!db.objectStoreNames.contains('cashRegister')) {
                db.createObjectStore('cashRegister', { keyPath: 'id', autoIncrement: true });
            }

            if (!db.objectStoreNames.contains('syncQueue')) {
                const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
                syncStore.createIndex('by-status', 'status');
            }

            if (!db.objectStoreNames.contains('accountTransactions')) {
                const accountTransactionsStore = db.createObjectStore('accountTransactions', {
                    keyPath: 'id',
                    autoIncrement: true
                });
                accountTransactionsStore.createIndex('by-account', 'accountId');
            }

            if (!db.objectStoreNames.contains('salesRecords')) {
                db.createObjectStore('salesRecords', {
                    keyPath: 'id',
                    autoIncrement: true
                });
            }

            if (!db.objectStoreNames.contains('accounts')) {
                db.createObjectStore('accounts', { keyPath: 'id' });
            }

            if (!db.objectStoreNames.contains('inventoryLogs')) {
                const logsStore = db.createObjectStore('inventoryLogs', { keyPath: 'id' });
                logsStore.createIndex('by-timestamp', 'timestamp');
            }
        },
    });

    return db;
};

// Funcion auxiliar para encolar operaciones de sincronizacion
const enqueueSyncOperation = async (operation: Omit<SyncQueueItem, 'id' | 'timestamp'>) => {
    const db = await initDatabase();
    const syncOp: SyncQueueItem = {
        ...operation,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
    };

    await db.add('syncQueue', syncOp);
    return syncOp;
};

// Operaciones de productos
export const productOperations = {
    async create(product: CreateProductData) {
        try {
            const db = await initDatabase();

            const token = localStorage.getItem('token');
            const tokenData = token ? JSON.parse(atob(token.split('.')[1])) : null;
            const userId = tokenData?.userId || 'unknown';

            const productToStore = {
                ...product,
                id: Date.now(),
                createdAt: new Date(),
                updatedAt: new Date(),
                createdBy: userId,
                updatedBy: userId
            };

            // Siempre guardamos primero localmente
            await db.add('products', productToStore);

            // Crear entrada en la cola de sincronización
            await syncQueueOperations.addOperation({
                type: 'create',
                entity: 'product',
                data: JSON.stringify(productToStore),
                deviceId: localStorage.getItem('deviceId') || 'unknown',
                status: 'pending'
            });

            if (navigator.onLine) {
                // Si estamos online, intentamos sincronizar inmediatamente
                try {
                    const response = await fetch(`${config.apiUrl}/products`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${localStorage.getItem('token')}`
                        },
                        body: JSON.stringify(product)
                    });

                    if (response.ok) {
                        const serverProduct = await response.json();
                        // Actualizar el producto local con el ID del servidor
                        await db.put('products', {
                            ...serverProduct,
                            createdAt: new Date(serverProduct.createdAt),
                            updatedAt: new Date(serverProduct.updatedAt)
                        });
                    }
                } catch (error) {
                    console.error('Error syncing with server:', error);
                    // No hacer nada más, la operación ya está en la cola de sync
                }
            }

            // Obtener info del usuario

            const userName = tokenData?.name || 'Unknown User';

            // Crear log
            await inventoryLogOperations.create({
                productId: productToStore.id,
                userId,
                userName,
                action: 'create',
                description: {
                    product: productToStore.name,
                    // No incluimos la imagen para mantener los logs ligeros
                    changes: Object.entries(productToStore)
                        .filter(([key]) => key !== 'imageUrl' && key !== 'id' && key !== 'createdAt' && key !== 'updatedAt')
                        .map(([field, value]) => ({
                            field,
                            newValue: value
                        }))
                }
            });

            return productToStore.id;
        } catch (error) {
            console.error('Error creating product:', error);
            throw error;
        }
    },

    async update(id: number, productData: UpdateProductData) {
        try {
            const db = await initDatabase();
            const existingProduct = await db.get('products', id);

            if (!existingProduct) {
                throw new Error('Product not found');
            }

            // Actualizar localmente primero
            const updatedProduct = {
                ...existingProduct,
                ...productData,
                updatedAt: new Date()
            };

            await db.put('products', updatedProduct);

            // Crear entrada en la cola de sincronización
            await syncQueueOperations.addOperation({
                type: 'update',
                entity: 'product',
                data: JSON.stringify(updatedProduct),
                deviceId: localStorage.getItem('deviceId') || 'unknown',
                status: 'pending'
            });

            if (navigator.onLine) {
                // Si estamos online, intentamos sincronizar inmediatamente
                try {
                    const response = await fetch(`${config.apiUrl}/products/${id}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${localStorage.getItem('token')}`
                        },
                        body: JSON.stringify(productData)
                    });

                    if (response.ok) {
                        const serverProduct = await response.json();
                        // Actualizar el producto local con la respuesta del servidor
                        await db.put('products', {
                            ...serverProduct,
                            createdAt: new Date(serverProduct.createdAt),
                            updatedAt: new Date(serverProduct.updatedAt)
                        });
                    }
                } catch (error) {
                    console.error('Error syncing with server:', error);
                    // No hacer nada más, la operación ya está en la cola de sync
                }
            }

            // Obtener info del usuario
            const token = localStorage.getItem('token');
            const tokenData = token ? JSON.parse(atob(token.split('.')[1])) : null;
            const userId = tokenData?.userId || 'unknown';
            const userName = tokenData?.name || 'Unknown User';

            // Crear log solo si hay cambios
            const changes = [];
            for (const key in productData) {
                if (Object.prototype.hasOwnProperty.call(productData, key) &&
                    key !== 'updatedAt' &&
                    productData[key as keyof typeof productData] !== existingProduct[key as keyof typeof existingProduct]) {
                    // Caso especial para el campo imageUrl
                    if (key === 'imageUrl') {
                        changes.push({
                            field: key,
                            oldValue: existingProduct[key as keyof typeof existingProduct] ? 'Imagen anterior' : 'Sin imagen',
                            newValue: productData[key as keyof typeof productData] ? 'Nueva imagen' : 'Sin imagen'
                        });
                    } else {
                        changes.push({
                            field: key,
                            oldValue: existingProduct[key as keyof typeof existingProduct],
                            newValue: productData[key as keyof typeof productData]
                        });
                    }
                }
            }

            if (changes.length > 0) {
                await inventoryLogOperations.create({
                    productId: id,
                    userId,
                    userName,
                    action: 'update',
                    description: {
                        product: existingProduct.name,
                        changes
                    }
                });
            }

            return updatedProduct;
        } catch (error) {
            console.error('Error updating product:', error);
            throw error;
        }
    },

    async delete(id: number) {
        try {
            const db = await initDatabase();
            const existingProduct = await db.get('products', id);

            if (!existingProduct) {
                throw new Error('Product not found');
            }

            // Marcar como inactivo localmente primero
            const deletedProduct = { ...existingProduct, isActive: false };
            await db.put('products', deletedProduct);

            // Crear entrada en la cola de sincronización
            await syncQueueOperations.addOperation({
                type: 'delete',
                entity: 'product',
                data: JSON.stringify({ id }),
                deviceId: localStorage.getItem('deviceId') || 'unknown',
                status: 'pending'
            });

            if (navigator.onLine) {
                // Si estamos online, intentamos sincronizar inmediatamente
                try {
                    const response = await fetch(`${config.apiUrl}/products/${id}`, {
                        method: 'DELETE',
                        headers: {
                            'Authorization': `Bearer ${localStorage.getItem('token')}`
                        }
                    });

                    if (response.ok) {
                        // No eliminamos el producto localmente, solo lo mantenemos inactivo
                        // esto ayuda con la consistencia de datos y referencias
                    }
                } catch (error) {
                    console.error('Error syncing with server:', error);
                    // No hacer nada más, la operación ya está en la cola de sync
                }
            }
            // Obtener info del usuario
            const token = localStorage.getItem('token');
            const tokenData = token ? JSON.parse(atob(token.split('.')[1])) : null;
            const userId = tokenData?.userId || 'unknown';
            const userName = tokenData?.name || 'Unknown User';

            // Crear log
            await inventoryLogOperations.create({
                productId: id,
                userId,
                userName,
                action: 'delete',
                description: {
                    product: existingProduct.name
                }
            });
        } catch (error) {
            console.error('Error deleting product:', error);
            throw error;
        }
    },

    async getAll() {
        try {
            const response = await fetch(`${config.apiUrl}/products`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) {
                throw new Error('Error fetching products');
            }

            const products = await response.json();

            // Actualizar IndexedDB con los productos del servidor
            const db = await initDatabase();
            await Promise.all(products.map(async (product: any) => {
                await db.put('products', {
                    ...product,
                    createdAt: new Date(product.createdAt),
                    updatedAt: new Date(product.updatedAt)
                });
            }));

            return products;
        } catch (error) {
            // Si no hay conexión, devolver datos locales
            if (!navigator.onLine) {
                const db = await initDatabase();
                return await db.getAll('products');
            }
            throw error;
        }
    },

    async getById(id: number) {
        const db = await initDatabase();
        return db.get('products', id);
    },

    async addStock(id: number, quantity: number, cost?: number, price?: number, notes?: string) {
        try {
            const existingProduct = await this.getById(id);

            if (!existingProduct) {
                throw new Error('Product not found');
            }

            // Preparar los datos para la actualización
            const updateData: UpdateProductData = {
                stock: existingProduct.stock + quantity
            };

            if (cost !== undefined) {
                updateData.cost = cost;
            }

            if (price !== undefined) {
                updateData.price = price;
            }

            // Usar el método update existente
            const updatedProduct = await this.update(id, updateData);

            // Obtener info del usuario
            const token = localStorage.getItem('token');
            const tokenData = token ? JSON.parse(atob(token.split('.')[1])) : null;
            const userId = tokenData?.userId || 'unknown';
            const userName = tokenData?.name || 'Unknown User';

            // Crear log
            await inventoryLogOperations.create({
                productId: id,
                userId,
                userName,
                action: 'addStock',
                description: {
                    product: existingProduct.name,
                    quantity,
                    newTotal: existingProduct.stock + quantity,
                    notes: notes || undefined
                }
            });

            return updatedProduct;
        } catch (error) {
            console.error('Error adding stock:', error);
            throw error;
        }
    }
};

export const transactionOperations = {
    async create(transaction: Omit<Transaction, 'id'>) {
        const db = await initDatabase();
        const id = await db.add('transactions', transaction);

        // Encolar para sincronizaci贸n
        await enqueueSyncOperation({
            type: 'create',
            entity: 'transaction',
            data: JSON.stringify({ ...transaction, id }),
            deviceId: localStorage.getItem('deviceId') || 'unknown',
            status: 'pending'
        });

        return id;
    },

    async cancelTransaction(id: number) {
        try {
            const response = await fetch(`${config.apiUrl}/transactions/${id}/cancel`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Error cancelling transaction');
            }

            const updatedTransaction = await response.json();

            // Actualizar en IndexedDB
            const db = await initDatabase();
            const tx = db.transaction('transactions', 'readwrite');
            await tx.store.put({
                ...updatedTransaction,
                createdAt: new Date(updatedTransaction.createdAt)
            });
            await tx.done;

            // Actualizar stock
            for (const item of updatedTransaction.items) {
                const productTx = db.transaction('products', 'readwrite');
                const product = await productTx.store.get(item.productId);
                if (product) {
                    product.stock += item.quantity;
                    await productTx.store.put(product);
                }
                await productTx.done;
            }

            return updatedTransaction;
        } catch (error) {
            console.error('Error cancelling transaction:', error);
            throw error;
        }
    },

    async getAll() {
        const db = await initDatabase();
        return await db.getAll('transactions');
    },

    async getById(id: number) {
        const db = await initDatabase();
        return await db.get('transactions', id);
    }
};

export const accountOperations = {
    async addItems(
        accountId: number,
        items: Array<{ productId: number; quantity: number; price: number }>,
        userId: string,
        accountType: 'PREPAID' | 'ACCUMULATED',
        transactionType: 'debit' | 'credit',
        metadata?: AccountItemsMetadata
    ) {
        console.log('Starting accountOperations.addItems', { accountId, items, accountType, transactionType });
        const db = await initDatabase();
        try {
            // Actualizar stock localmente
            if (transactionType === 'credit') {
                const tx = db.transaction('products', 'readwrite');
                const productStore = tx.objectStore('products');
                for (const item of items) {
                    const product = await productStore.get(item.productId);
                    if (product) {
                        product.stock -= item.quantity;
                        await productStore.put(product);
                    }
                }
                await tx.done;
            }

            // Crear transacción local
            const accountTx = db.transaction('accountTransactions', 'readwrite');
            const amount = metadata?.amount || items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
            const accountTransaction: AccountTransaction = {
                id: crypto.randomUUID(),
                accountId,
                amount,
                type: transactionType,
                accountType,
                createdAt: new Date(),
                userId,
                method: metadata?.method,
                discount: metadata?.discount,
                note: metadata?.note,
                currency: metadata?.currency || 'USD',
                wallet: (metadata?.method as Wallet) || 'CASH_USD',
                items: items.map(item => ({
                    id: 0,
                    transactionId: '',
                    productId: item.productId,
                    quantity: item.quantity,
                    price: item.price
                })),
                status: 'active'
            };
            await accountTx.store.add(accountTransaction);
            await accountTx.done;

            // Encolar para sincronización
            await syncQueueOperations.addOperation({
                type: 'create',
                entity: 'accountTransaction',
                data: JSON.stringify(accountTransaction),
                deviceId: localStorage.getItem('deviceId') || 'unknown',
                status: 'pending'
            });

            // Añadir registro de venta si es necesario
            if (transactionType === 'credit' || (accountType === 'ACCUMULATED' && transactionType === 'debit')) {
                console.log('Creating salesRecord for account transaction:', {
                    accountId,
                    transactionType,
                    accountType,
                    items
                });
            }

            console.log('Account transaction operation enqueued');
        } catch (error) {
            console.error('Error in addItems:', error);
            throw error;
        }
    },

    async closeAccount(accountId: number, userId: string, accountType: 'PREPAID' | 'ACCUMULATED') {
        console.log('Starting accountOperations.closeAccount', { accountId, accountType });

        try {
            // Encolar operación de cierre
            await enqueueSyncOperation({
                type: 'update',
                entity: 'transaction',
                data: JSON.stringify({
                    accountId,
                    operation: 'close',
                    accountType,
                    userId,
                    timestamp: Date.now()
                }),
                deviceId: localStorage.getItem('deviceId') || 'unknown',
                status: 'pending'
            });

            // Actualizar estado local
            const db = await initDatabase();
            const tx = db.transaction('accountTransactions', 'readwrite');
            const index = tx.store.index('by-account');

            // Marcar todas las transacciones de la cuenta como cerradas
            const transactions = await index.getAll(accountId);
            for (const transaction of transactions) {
                transaction.status = 'closed';
                await tx.store.put(transaction);
            }

            await tx.done;

            console.log('Account close operation enqueued');
        } catch (error) {
            console.error('Error in closeAccount:', error);
            throw error;
        }
    },

    async cancelTransaction(
        accountId: number,
        transactionId: string,
        userId: string,
        accountType: 'PREPAID' | 'ACCUMULATED',
        items: AccountTransactionItem[]
    ): Promise<void> {
        const db = await initDatabase();

        try {
            // 1. Marcar la transacción original como cancelada
            const tx = db.transaction(['accountTransactions'], 'readwrite');
            const accountTxStore = tx.objectStore('accountTransactions');
            const originalTx = await accountTxStore.get(transactionId);
            if (originalTx) {
                originalTx.status = 'cancelled';
                await accountTxStore.put(originalTx);
            }

            // 2. Crear la transacción de cancelación
            const cancelTransaction: AccountTransaction = {
                id: crypto.randomUUID(),
                accountId,
                amount: originalTx ? originalTx.amount : 0,
                type: 'debit',
                accountType,
                createdAt: new Date(),
                userId,
                status: 'active',
                note: `Cancelled transaction ${transactionId}`,
                items,
                currency: originalTx ? originalTx.currency : 'USD',
                wallet: originalTx ? originalTx.wallet : 'CASH_USD'
            };

            await accountTxStore.add(cancelTransaction);
            await tx.done;

            // 3. Encolar para sincronización
            await syncQueueOperations.addOperation({
                type: 'create',
                entity: 'accountTransaction',
                data: JSON.stringify(cancelTransaction),
                deviceId: localStorage.getItem('deviceId') || 'unknown',
                status: 'pending'
            });

            // 4. Para cuentas PREPAID, necesitamos recalcular el estado de los productos
            if (accountType === 'PREPAID') {
                const allTxTx = db.transaction(['accountTransactions', 'products'], 'readonly');
                const index = allTxTx.objectStore('accountTransactions').index('by-account');
                const productsStore = allTxTx.objectStore('products');

                // Obtener todas las transacciones de la cuenta
                const transactions = await index.getAll(accountId);
                const prepaidTransactions = transactions.filter(t =>
                    t.accountType === 'PREPAID' &&
                    t.status !== 'cancelled' // Ignorar transacciones canceladas
                );

                // Recalcular el estado de los productos
                const productMap = new Map<number, PrepaidProduct>();

                for (const tx of prepaidTransactions) {
                    if (tx.items) {
                        for (const item of tx.items) {
                            const product = await productsStore.get(item.productId);

                            if (!productMap.has(item.productId)) {
                                productMap.set(item.productId, {
                                    id: item.productId,
                                    accountId,
                                    productId: item.productId,
                                    paid: 0,
                                    consumed: 0,
                                    product
                                });
                            }

                            const prepaidProduct = productMap.get(item.productId)!;
                            if (tx.type === 'credit') {
                                prepaidProduct.paid += item.quantity;
                            } else if (tx.type === 'debit') {
                                prepaidProduct.consumed += item.quantity;
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error in cancelTransaction:', error);
            throw error;
        }
    }
};

// Operaciones de caja registradora
export const cashRegisterOperations = {
    async create(register: Omit<CashRegister, 'id'>) {
        const db = await initDatabase();
        const data = {
            ...register,
            deviceId: localStorage.getItem('deviceId') || 'unknown'
        };
        const id = await db.add('cashRegister', data);

        await enqueueSyncOperation({
            type: 'create',
            entity: 'cashRegister',
            data: JSON.stringify({ ...data, id }),
            deviceId: data.deviceId,
            status: 'pending'
        });

        return id;
    },

    async update(id: number, data: Partial<CashRegister>) {
        const db = await initDatabase();
        console.log('Updating register:', id, 'with data:', data);
        const existing = await db.get('cashRegister', id);
        console.log('Existing register:', existing);
        if (!existing) throw new Error('Register not found');

        const updated = { ...existing, ...data };
        console.log('Updated register data:', updated);

        try {
            await db.put('cashRegister', updated);
            console.log('Register updated in IndexedDB');

            // Resto del codigo...
        } catch (error) {
            console.error('Error updating register:', error);
            throw error;
        }

        return updated;
    },

    async getById(id: number) {
        const db = await initDatabase();
        return await db.get('cashRegister', id);
    },

    async getCurrent(userId?: string) {
        if (!userId) return null;

        const db = await initDatabase();
        try {
            const tx = db.transaction('cashRegister', 'readonly');
            const registers = await tx.store.getAll();
            await tx.done;

            const currentRegister = registers
                .filter(reg => reg.userId === userId && reg.status === 'open')
                .pop();

            return currentRegister || null;
        } catch (error) {
            console.error('Error getting current register:', error);
            return null;
        }
    }
};

// Operaciones de la cola de sincronizacion
export const syncQueueOperations = {
    async getPendingOperations(): Promise<SyncOperation[]> {
        const db = await initDatabase();
        const tx = db.transaction('syncQueue', 'readonly');
        const index = tx.store.index('by-status');
        return await index.getAll('pending');
    },

    async addOperation(operation: {
        type: 'create' | 'update' | 'delete';
        entity: 'product' | 'transaction' | 'cashRegister' | 'accountTransaction' | 'salesRecord' | 'report';
        data: string;
        deviceId: string;
        status: 'pending' | 'completed' | 'failed';
        timestamp?: number;
    }): Promise<void> {
        const db = await initDatabase();
        const tx = db.transaction('syncQueue', 'readwrite');
        await tx.store.add({
            ...operation,
            id: crypto.randomUUID(),
            timestamp: operation.timestamp || Date.now(),
            createdAt: new Date()
        });
        await tx.done;
    },

    async markAsCompleted(id: string): Promise<void> {
        const db = await initDatabase();
        const tx = db.transaction('syncQueue', 'readwrite');
        const operation = await tx.store.get(id);
        if (operation) {
            operation.status = 'completed';
            await tx.store.put(operation);
        }
        await tx.done;
    },

    async clearCompleted(): Promise<void> {
        const db = await initDatabase();
        const tx = db.transaction('syncQueue', 'readwrite');
        const index = tx.store.index('by-status');
        const keys = await index.getAllKeys('completed');
        await Promise.all(keys.map(key => tx.store.delete(key)));
        await tx.done;
    },

    async markAsFailed(id: string) {
        const db = await initDatabase();
        const operation = await db.get('syncQueue', id);
        if (operation) {
            operation.status = 'failed';
            await db.put('syncQueue', operation);
        }
    },

    async clearAll() {
        const db = await initDatabase();
        const tx = db.transaction('syncQueue', 'readwrite');
        await tx.store.clear();
        await tx.done;
    }
};

export const clearDatabase = async () => {
    const db = await initDatabase();
    await db.clear('products');
    await db.clear('transactions');
    await db.clear('cashRegister');
    await db.clear('syncQueue');
    console.log('Local database cleared');
};

export const salesOperations = {
    async create(saleData: any) {
        const db = await initDatabase();
        await db.add('salesRecords', {
            ...saleData,
            createdAt: new Date(saleData.createdAt)
        });
    }
};

export const inventoryLogOperations = {
    async create(logData: Partial<InventoryLog>) {
        const db = await initDatabase();
        const id = crypto.randomUUID();
        const fullLog = {
            ...logData,
            id,
            timestamp: new Date()
        };

        await db.add('inventoryLogs', fullLog);

        // Encolar para sincronización usando aserción de tipo
        await syncQueueOperations.addOperation({
            type: 'create',
            entity: 'inventoryLog' as SyncEntityType,
            data: JSON.stringify(fullLog),
            deviceId: localStorage.getItem('deviceId') || 'unknown',
            status: 'pending'
        });

        return id;
    },

    async getAll(limit = 100) {
        const db = await initDatabase();
        let logs = await db.getAll('inventoryLogs');
        logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        return logs.slice(0, limit); // Limitar a los últimos 'limit' logs
    },

    async getPaginated(page = 1, pageSize = 20) {
        try {
            if (navigator.onLine) {
                const offset = (page - 1) * pageSize;
                const response = await fetch(`${config.apiUrl}/inventory-logs?limit=${pageSize}&offset=${offset}`, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });

                if (!response.ok) {
                    throw new Error('Error fetching inventory logs');
                }

                const result = await response.json();

                // Actualizar IndexedDB con los nuevos logs
                const db = await initDatabase();
                await Promise.all(result.logs.map(async (log: any) => {
                    await db.put('inventoryLogs', {
                        ...log,
                        timestamp: new Date(log.timestamp)
                    });
                }));

                return result;
            }
        } catch (error) {
            console.error('Error fetching logs from server:', error);
        }

        // Fallback a datos locales si estamos offline o hay un error
        const db = await initDatabase();
        let logs = await db.getAll('inventoryLogs');
        logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        const offset = (page - 1) * pageSize;
        const paginatedLogs = logs.slice(offset, offset + pageSize);

        return {
            logs: paginatedLogs,
            totalCount: logs.length,
            hasMore: logs.length > offset + pageSize
        };
    },

    // Limpiar logs antiguos para mantener solo los últimos 100
    async cleanupOldLogs() {
        try {
            const db = await initDatabase();
            let logs = await db.getAll('inventoryLogs');

            if (logs.length <= 100) return; // No hay necesidad de limpiar

            // Ordenar por fecha descendente
            logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

            // Obtener IDs de logs a eliminar (más allá de 100)
            const logsToDelete = logs.slice(100);

            // Eliminar logs antiguos
            const tx = db.transaction('inventoryLogs', 'readwrite');
            for (const log of logsToDelete) {
                await tx.store.delete(log.id);
            }
            await tx.done;

            console.log(`Cleaned up ${logsToDelete.length} old inventory logs`);
        } catch (error) {
            console.error('Error cleaning up old logs:', error);
        }
    }
};

window.addEventListener('unload', () => {
    if (db) {
        db.close();
    }
});