export type PaymentMethod = 'cash' | 'card' | 'transfer';
export type RegisterStatus = 'open' | 'closed';

export interface Product {
    id: number;
    name: string;
    price: number;
    stock: number;
    category?: string;
    imageUrl?: string;
    barcode?: string;
    minStock?: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface Transaction {
    id: number;
    amount: number;
    type: PaymentMethod;  // Cambiado de string a PaymentMethod
    createdAt: Date;
    customerName?: string;  // Añadido para soportar el nombre del cliente
}

export interface CashRegister {
    id: number;
    status: RegisterStatus;
    initialAmount: number;
    finalAmount?: number;
    openedAt: Date;       // Renombrado de openTime a openedAt para consistencia
    closedAt?: Date;
}

// Tipos para sincronización
export type SyncEntityType = 'product' | 'transaction' | 'cashRegister';
export type SyncOperationType = 'create' | 'update' | 'delete';
export type SyncStatus = 'pending' | 'completed' | 'failed';