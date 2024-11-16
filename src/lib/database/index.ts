import { openDB, IDBPDatabase } from 'idb';

// Interfaces
interface Product {
    id: number;
    name: string;
    price: number;
    stock: number;
    category?: string;
}

interface Transaction {
    id: number;
    amount: number;
    type: string;
    createdAt: Date;
}

interface CashRegister {
    id: number;
    status: 'open' | 'closed';
    initialAmount: number;
    finalAmount?: number;
    openedAt: Date;
    closedAt?: Date;
}

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
}

let db: IDBPDatabase<DBSchema>;

export const initDatabase = async () => {
    if (db) return db;

    db = await openDB<DBSchema>('pos-db', 2, {  // Incrementar versión a 2
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
        },
    });

    return db;
};

// Función auxiliar para encolar operaciones de sincronización
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
    async create(product: Omit<Product, 'id'>) {
        const db = await initDatabase();
        const id = await db.add('products', product);

        // Encolar para sincronización
        await enqueueSyncOperation({
            type: 'create',
            entity: 'product',
            data: JSON.stringify({ ...product, id }),
            deviceId: localStorage.getItem('deviceId') || 'unknown',
            status: 'pending'
        });

        return id;
    },

    async update(id: number, product: Partial<Product>) {
        const db = await initDatabase();
        const existingProduct = await db.get('products', id);
        if (!existingProduct) throw new Error('Product not found');

        const updatedProduct = { ...existingProduct, ...product };
        await db.put('products', updatedProduct);

        // Encolar para sincronización
        await enqueueSyncOperation({
            type: 'update',
            entity: 'product',
            data: JSON.stringify(updatedProduct),
            deviceId: localStorage.getItem('deviceId') || 'unknown',
            status: 'pending'
        });

        return updatedProduct;
    },

    async delete(id: number) {
        const db = await initDatabase();
        const product = await db.get('products', id);
        if (!product) throw new Error('Product not found');

        await db.delete('products', id);

        // Encolar para sincronización
        await enqueueSyncOperation({
            type: 'delete',
            entity: 'product',
            data: JSON.stringify({ id }),
            deviceId: localStorage.getItem('deviceId') || 'unknown',
            status: 'pending'
        });
    },

    async getAll() {
        const db = await initDatabase();
        return db.getAll('products');
    },

    async getById(id: number) {
        const db = await initDatabase();
        return db.get('products', id);
    }
};

export const transactionOperations = {
    async create(transaction: Omit<Transaction, 'id'>) {
        const db = await initDatabase();
        const id = await db.add('transactions', transaction);

        // Encolar para sincronización
        await enqueueSyncOperation({
            type: 'create',
            entity: 'transaction',
            data: JSON.stringify({ ...transaction, id }),
            deviceId: localStorage.getItem('deviceId') || 'unknown',
            status: 'pending'
        });

        return id;
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

// Operaciones de caja registradora
export const cashRegisterOperations = {
    async create(register: Omit<CashRegister, 'id'>) {
        const db = await initDatabase();
        const id = await db.add('cashRegister', register);

        // Encolar para sincronización
        await enqueueSyncOperation({
            type: 'create',
            entity: 'cashRegister',
            data: JSON.stringify({ ...register, id }),
            deviceId: localStorage.getItem('deviceId') || 'unknown',
            status: 'pending'
        });

        return id;
    },

    async update(id: number, data: Partial<CashRegister>) {
        const db = await initDatabase();
        const existing = await db.get('cashRegister', id);
        if (!existing) throw new Error('Register not found');

        const updated = { ...existing, ...data };
        await db.put('cashRegister', updated);
        return updated;
    },

    async getById(id: number) {
        const db = await initDatabase();
        return await db.get('cashRegister', id);
    },

    async getCurrent() {
        const db = await initDatabase();
        const registers = await db.getAll('cashRegister');
        return registers[registers.length - 1];
    }
};

// Operaciones de la cola de sincronización
export const syncQueueOperations = {
    async getPendingOperations() {
        const db = await initDatabase();
        return db.getAllFromIndex('syncQueue', 'by-status', 'pending');
    },

    async markAsCompleted(id: string) {
        const db = await initDatabase();
        const operation = await db.get('syncQueue', id);
        if (operation) {
            operation.status = 'completed';
            await db.put('syncQueue', operation);
        }
    },

    async markAsFailed(id: string) {
        const db = await initDatabase();
        const operation = await db.get('syncQueue', id);
        if (operation) {
            operation.status = 'failed';
            await db.put('syncQueue', operation);
        }
    },

    async clearCompleted() {
        const db = await initDatabase();
        const tx = db.transaction('syncQueue', 'readwrite');
        const completed = await tx.store.index('by-status').getAllKeys('completed');
        await Promise.all(completed.map(key => tx.store.delete(key)));
        await tx.done;
    },

    async clearAll() {
        const db = await initDatabase();
        const tx = db.transaction('syncQueue', 'readwrite');
        await tx.store.clear();
        await tx.done;
    }
};