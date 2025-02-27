import { openDB, IDBPDatabase } from 'idb';
import { config } from '../../config';
import { Product, Transaction, AccountTransaction, CashRegister, Currency, Wallet, Account, AccountTransactionItem, PrepaidProduct, InventoryLog, SyncEntityType } from '../../types';
import { SyncOperation } from '../../types/sync';

type CreateProductData = Omit<Product, 'id' | 'createdAt' | 'updatedAt'>;
type UpdateProductData = Partial<CreateProductData>;

// Interfaces
interface SyncQueueItem {
    id: string;
    timestamp: number;
    type: 'create' | 'update' | 'delete';
    entity: 'product' | 'transaction' | 'cashRegister' | 'inventoryLog';
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
            const tokenData = JSON.parse(atob(token!.split('.')[1]));
            const userName = tokenData.name;

            const productToStore = {
                ...product,
                id: Date.now(),
                createdAt: new Date(),
                updatedAt: new Date(),
                createdBy: userName,
                updatedBy: userName
            };

            // Guardamos primero localmente
            await db.add('products', productToStore);

            // Crear log de la operación
            await inventoryLogOperations.create({
                userName,
                action: 'CREATED',
                productId: productToStore.id,
                description: {
                    product: productToStore.name,
                    changes: Object.entries(productToStore)
                        .filter(([key]) => !['id', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy', 'imageUrl'].includes(key))
                        .map(([field, value]) => ({
                            field,
                            newValue: value
                        }))
                }
            });

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

            return productToStore.id;
        } catch (error) {
            console.error('Error creating product:', error);
            throw error;
        }
    },

    async update(id: number, productData: UpdateProductData) {
        try {
            const db = await initDatabase();
            const token = localStorage.getItem('token');
            const tokenData = JSON.parse(atob(token!.split('.')[1]));
            const userName = tokenData.name;

            const existingProduct = await db.get('products', id);
            if (!existingProduct) {
                throw new Error('Product not found');
            }

            // Preparar datos de cambios para el log
            const changes = Object.entries(productData)
                .filter(([key, value]) => {
                    if (key === 'imageUrl') return true;
                    return existingProduct[key as keyof Product] !== value;
                })
                .map(([field, newValue]) => ({
                    field,
                    ...(field === 'imageUrl' ? {} : { oldValue: existingProduct[field as keyof Product] }),
                    newValue
                }));

            // Actualizar producto
            const updatedProduct = {
                ...existingProduct,
                ...productData,
                updatedAt: new Date(),
                updatedBy: userName
            };

            await db.put('products', updatedProduct);

            // Crear log si hay cambios
            if (changes.length > 0) {
                await inventoryLogOperations.create({
                    userName,
                    action: 'EDITED',
                    productId: id,
                    description: {
                        product: existingProduct.name,
                        changes
                    }
                });
            }

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

        // Encolar para sincronizacion
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
        metadata?: AccountItemsMetadata
    ) {
        try {
            // Validar los productos
            const db = await initDatabase();
            for (const item of items) {
                const product = await db.get('products', item.productId);
                if (!product) {
                    throw new Error(`Product ${item.productId} not found`);
                }

                if (product.stock < item.quantity) {
                    throw new Error(`Not enough stock for product ${product.name}`);
                }
            }

            // Calcular el monto total
            const total = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
            const amount = metadata?.amount ?? total;
            const discount = metadata?.discount ?? 0;
            const currency = metadata?.currency ?? 'USD';
            let wallet: Wallet = 'CASH_USD';
            if (currency === 'USD') {
                wallet = metadata?.method === 'transfer' ? 'TRANSFER_USD' : 'CASH_USD';
            } else {
                wallet = metadata?.method === 'transfer' ? 'CUENTA_BS' : 'CASH_BS';
            }

            // Obtener la cuenta
            const account = await db.get('accounts', accountId);
            if (!account) {
                throw new Error('Account not found');
            }

            // Crear la transacción
            const newTransaction: Omit<AccountTransaction, 'id'> = {
                accountId,
                amount,
                type: 'debit',
                accountType: account.type,
                createdAt: new Date(),
                userId,
                items: items.map((item, index) => ({
                    id: index + 1,
                    transactionId: `temp-${Date.now()}`, // Será reemplazado al guardarse
                    productId: item.productId,
                    quantity: item.quantity,
                    price: item.price
                })),
                method: metadata?.method,
                note: metadata?.note,
                discount,
                currency,
                wallet
            };

            const transactionId = crypto.randomUUID();
            const transaction = {
                ...newTransaction,
                id: transactionId,
                items: newTransaction.items?.map(item => ({
                    ...item,
                    transactionId
                }))
            };

            // Guardar la transacción
            await db.add('accountTransactions', transaction);

            // Actualizar stock de productos
            for (const item of items) {
                const product = await db.get('products', item.productId);
                if (product) {
                    product.stock -= item.quantity;
                    await db.put('products', product);
                }
            }

            return transactionId;
        } catch (error) {
            console.error('Error adding items to account:', error);
            throw error;
        }
    },

    async getAll() {
        const db = await initDatabase();
        return await db.getAll('accounts');
    },

    async getById(id: number) {
        const db = await initDatabase();
        return await db.get('accounts', id);
    },

    async getTransactions(accountId: number) {
        const db = await initDatabase();
        const tx = db.transaction('accountTransactions', 'readonly');
        const index = tx.store.index('by-account');
        return await index.getAll(accountId);
    }
};

export const cashRegisterOperations = {
    async create(register: Omit<CashRegister, 'id'>): Promise<number> {
        const db = await initDatabase();
        const id = await db.add('cashRegister', {
            ...register,
            openedAt: new Date(register.openedAt)
        });

        await syncQueueOperations.addOperation({
            type: 'create',
            entity: 'cashRegister',
            data: JSON.stringify({ ...register, id }),
            deviceId: localStorage.getItem('deviceId') || 'unknown',
            status: 'pending'
        });

        return Number(id);
    },

    async getById(id: number): Promise<CashRegister | undefined> {
        const db = await initDatabase();
        return await db.get('cashRegister', id);
    },

    async update(id: number, data: Partial<CashRegister>): Promise<CashRegister> {
        const db = await initDatabase();
        const existingRegister = await db.get('cashRegister', id);
        if (!existingRegister) {
            throw new Error('Cash register not found');
        }

        const updatedRegister = { ...existingRegister, ...data };
        await db.put('cashRegister', updatedRegister);

        await syncQueueOperations.addOperation({
            type: 'update',
            entity: 'cashRegister',
            data: JSON.stringify(updatedRegister),
            deviceId: localStorage.getItem('deviceId') || 'unknown',
            status: 'pending'
        });

        return updatedRegister;
    },

    async getLatest(): Promise<CashRegister | undefined> {
        const db = await initDatabase();
        const registers = await db.getAll('cashRegister');
        if (registers.length === 0) {
            return undefined;
        }

        // Ordenamos por ID (que es incremental) para obtener el último
        registers.sort((a, b) => b.id - a.id);
        return registers[0];
    },
    async getCurrent(userId?: string): Promise<CashRegister | null> {
        if (!userId) return null;

        const db = await initDatabase();
        const registers = await db.getAll('cashRegister');

        // Filtrar por userId y ordenar por fecha de apertura (más reciente primero)
        const userRegisters = registers
            .filter(reg => reg.userId === userId)
            .sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime());

        // Obtener el registro más reciente que no esté cerrado
        const openRegister = userRegisters.find(reg => reg.status === 'open');

        // Si hay un registro abierto, devolver ese, de lo contrario, devolver el más reciente
        return openRegister || (userRegisters.length > 0 ? userRegisters[0] : null);
    }
};

export const syncQueueOperations = {
    async getPendingOperations(): Promise<SyncOperation[]> {
        const db = await initDatabase();
        const tx = db.transaction('syncQueue', 'readonly');
        const index = tx.store.index('by-status');
        const operations = await index.getAll('pending');
        return operations.map((op: SyncQueueItem) => ({
            id: op.id,
            timestamp: op.timestamp,
            type: op.type,
            entity: op.entity as SyncEntityType,
            data: op.data,
            deviceId: op.deviceId,
            status: op.status,
            createdAt: new Date()
        }));
    },

    async addOperation(operation: Omit<SyncOperation, 'id' | 'timestamp' | 'createdAt'>) {
        const db = await initDatabase();
        const tx = db.transaction('syncQueue', 'readwrite');
        await tx.store.add({
            ...operation,
            id: crypto.randomUUID(),
            timestamp: Date.now(),
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
    async create(log: Omit<InventoryLog, 'id' | 'timestamp'>) {
        const db = await initDatabase();
        const id = crypto.randomUUID();
        const timestamp = Date.now();

        // Guardar localmente primero
        const newLog = {
            ...log,
            id,
            timestamp
        };

        await db.add('inventoryLogs', newLog);

        // Encolar para sincronización
        await syncQueueOperations.addOperation({
            type: 'create',
            entity: 'inventoryLog',
            data: JSON.stringify(newLog),
            deviceId: localStorage.getItem('deviceId') || 'unknown',
            status: 'pending'
        });

        // No sincronizamos inmediatamente para evitar duplicados
        // El proceso de sincronización normal se encargará de esto

        return id;
    },

    async getAll() {
        const db = await initDatabase();
        return db.getAll('inventoryLogs');
    },

    async syncWithServer() {
        // Si estamos offline, no intentamos sincronizar
        if (!navigator.onLine) return;

        try {
            const token = localStorage.getItem('token');
            if (!token) return;

            // Obtener logs locales para enviar al servidor
            const localLogs = await this.getAll();
            const pendingLogs = localLogs.filter(log => !log.synced);

            // Si hay logs pendientes, los enviamos al servidor
            if (pendingLogs.length > 0) {
                for (const log of pendingLogs) {
                    // Convertir al formato que espera el servidor
                    const serverLog = {
                        id: log.id,
                        action: log.action,
                        productId: log.productId,
                        description: log.description
                    };

                    // Enviar al servidor
                    const response = await fetch(`${config.apiUrl}/inventory/logs`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify(serverLog)
                    });

                    if (response.ok) {
                        const responseData = await response.json();

                        // Marcar como sincronizado y guardar el ID del servidor
                        const db = await initDatabase();
                        await db.put('inventoryLogs', {
                            ...log,
                            synced: true,
                            serverId: responseData.id // Guarda el ID del servidor
                        });
                    }
                }
            }

            // Obtener logs del servidor
            const response = await fetch(`${config.apiUrl}/inventory/logs`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const serverLogs = await response.json();
                const db = await initDatabase();

                // Actualizar IndexedDB con los logs del servidor
                const tx = db.transaction('inventoryLogs', 'readwrite');

                for (const serverLog of serverLogs) {
                    // Convertir del formato del servidor al formato local
                    const localLog = {
                        id: serverLog.id,
                        timestamp: new Date(serverLog.createdAt).getTime(),
                        userId: serverLog.userId,
                        userName: serverLog.user?.name || 'Unknown',
                        action: serverLog.action.toUpperCase(),
                        productId: serverLog.productId || 0,
                        description: typeof serverLog.changes === 'string'
                            ? JSON.parse(serverLog.changes)
                            : serverLog.changes,
                        synced: true
                    };

                    // Solo agregar si no existe localmente
                    const existingLog = await tx.store.get(localLog.id);
                    if (!existingLog) {
                        await tx.store.add(localLog);
                    }
                }

                await tx.done;
            }
        } catch (error) {
            console.error('Error synchronizing inventory logs:', error);
        }
    }
};

window.addEventListener('unload', () => {
    if (db) {
        db.close();
    }
});