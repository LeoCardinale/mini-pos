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
    supplierId?: number;
    cost: number;
    isActive: boolean;
}

export interface TransactionItem {
    id: number;
    transactionId: number;
    productId: number;
    quantity: number;
    price: number;
}

export interface Transaction {
    id: number;
    amount: number;
    discount: number;
    type: PaymentMethod;
    createdAt: Date;
    customerName?: string;
    userId: string;
    deviceId: string;
    status: 'active' | 'cancelled';
    items: TransactionItem[];
}

export interface CashRegister {
    id: number;
    status: RegisterStatus;
    initialAmount: number;
    finalAmount?: number;
    openedAt: Date;
    closedAt?: Date;
    deviceId: string;
    userId: string;
}

// Tipos para sincronización
export type SyncEntityType = 'product' | 'transaction' | 'cashRegister';
export type SyncOperationType = 'create' | 'update' | 'delete';
export type SyncStatus = 'pending' | 'completed' | 'failed';

export enum AccountType {
    PREPAID = 'PREPAID',
    ACCUMULATED = 'ACCUMULATED'
}

export interface Account {
    id: number;
    customerName: string;
    type: AccountType;
    status: string;
    openedAt: Date;
    closedAt?: Date;
    creditLimit?: number;
    createdBy: string;
    closedBy?: string;
}

export interface PrepaidProduct {
    id: number;
    accountId: number;
    productId: number;
    paid: number;
    consumed: number;
    product?: Product;
}

export interface AccountTransaction {
    id: number;
    accountId: number;
    amount: number;
    type: 'debit' | 'credit';
    createdAt: Date;
    userId: string;
    items?: AccountTransactionItem[];
    method?: string;
    note?: string;
    discount?: number;
}

export interface AccountTransactionItem {
    id: number;
    transactionId: number;
    productId: number;
    quantity: number;
    price: number;
    product?: Product;
}