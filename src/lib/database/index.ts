import { openDB, IDBPDatabase } from 'idb';
import { config } from '../../config';
import { Product, Transaction } from '../../types';

type CreateProductData = Omit<Product, 'id' | 'createdAt' | 'updatedAt'>;
type UpdateProductData = Partial<CreateProductData>;

// Interfaces
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
    async create(product: CreateProductData) {
        console.log('Starting product creation with data:', {
            ...product,
            imageUrl: product.imageUrl ? 'Base64 image exists' : 'No image'
        });

        try {
            const response = await fetch(`${config.apiUrl}/products`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(product)
            });

            console.log('Server response status:', response.status);
            if (!response.ok) {
                const error = await response.json();
                console.error('Server error:', error);
                throw new Error(error.error || 'Error creating product');
            }

            const serverProduct = await response.json();

            // Si el backend acepta, entonces guardar en IndexedDB
            const db = await initDatabase();
            const productToStore = {
                ...serverProduct,
                createdAt: new Date(serverProduct.createdAt),
                updatedAt: new Date(serverProduct.updatedAt)
            };

            await db.put('products', productToStore);
            console.log('Product created successfully:', JSON.stringify(productToStore, null, 2));

            return serverProduct.id;
        } catch (error) {
            console.error('Error creating product:', error);
            throw error;
        }
    },

    async update(id: number, productData: UpdateProductData) {
        console.log('Starting product update:', { id, updates: productData });

        try {
            // Primero actualizar en el backend
            const response = await fetch(`${config.apiUrl}/products/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(productData)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Error updating product');
            }

            const serverProduct = await response.json();

            // Si el backend acepta, actualizar en IndexedDB
            const db = await initDatabase();
            const productToStore = {
                ...serverProduct,
                createdAt: new Date(serverProduct.createdAt),
                updatedAt: new Date(serverProduct.updatedAt)
            };

            await db.put('products', productToStore);
            console.log('Product updated successfully:', productToStore);

            return productToStore;
        } catch (error) {
            console.error('Error updating product:', error);
            throw error;
        }
    },

    async delete(id: number) {
        console.log('Starting product deletion:', id);

        try {
            // Primero eliminar en el backend
            const response = await fetch(`${config.apiUrl}/products/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Error deleting product');
            }

            // Si el backend acepta, eliminar de IndexedDB
            const db = await initDatabase();
            await db.delete('products', id);
            console.log('Product deleted successfully');

        } catch (error) {
            console.error('Error deleting product:', error);
            throw error;
        }
    },

    async getAll() {
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
        for (const product of products) {
            await db.put('products', {
                ...product,
                createdAt: new Date(product.createdAt),
                updatedAt: new Date(product.updatedAt)
            });
        }

        return products;
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

    async cancelTransaction(id: number) {
        try {
            const response = await fetch(`${config.apiUrl}/transactions/${id}/cancel`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Error cancelling transaction');
            }

            const updatedTransaction = await response.json();

            // Si el backend acepta, actualizar en IndexedDB
            const db = await initDatabase();
            await db.put('transactions', {
                ...updatedTransaction,
                createdAt: new Date(updatedTransaction.createdAt)
            });

            // Forzar actualización de productos
            await productOperations.getAll();

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

            // Resto del código...
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
        console.log('getCurrent called with userId:', userId);
        const db = await initDatabase();
        const registers = await db.getAll('cashRegister');
        console.log('Found registers:', registers);

        if (!userId) return null;

        const filtered = registers.filter(reg => reg.userId === userId && reg.status === 'open');
        console.log('Filtered registers:', filtered);
        return filtered.pop();
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

export const clearDatabase = async () => {
    const db = await initDatabase();
    await db.clear('products');
    await db.clear('transactions');
    await db.clear('cashRegister');
    await db.clear('syncQueue');
    console.log('Local database cleared');
};