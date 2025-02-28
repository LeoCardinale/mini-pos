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
    type: string;    // Podríamos cambiar esto después
    deviceId: string;
    createdAt: Date;
    customerName?: string;
    userId: string;
    status: string;
    items: TransactionItem[];
    currency: Currency;
    wallet: Wallet;
}

export interface CashRegister {
    id: number;
    status: RegisterStatus;
    initialCashUSD: number;
    initialCashBs: number;
    initialTransferUSD: number;
    initialCuentaBs: number;
    finalCashUSD?: number;
    finalCashBs?: number;
    finalTransferUSD?: number;
    finalCuentaBs?: number;
    dollarRate: number;
    openedAt: Date;
    closedAt?: Date;
    deviceId: string;
    userId: string;
}
// Tipos para sincronización
export type SyncEntityType = 'product' | 'transaction' | 'cashRegister' | 'accountTransaction' | 'salesRecord' | 'report';
export type SyncOperationType = 'create' | 'update' | 'delete';
export type SyncStatus = 'pending' | 'completed' | 'failed';
export type Currency = "USD" | "BS";
export type Wallet = "CASH_USD" | "CASH_BS" | "TRANSFER_USD" | "CUENTA_BS";

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
    id: string;
    accountId: number;
    amount: number;
    type: 'debit' | 'credit';
    accountType: 'PREPAID' | 'ACCUMULATED';
    createdAt: Date;
    userId: string;
    items?: AccountTransactionItem[];
    method?: string;
    note?: string;
    discount?: number;
    currency: Currency;
    wallet: Wallet;
    status?: string;
}

export interface AccountTransactionItem {
    id: number;
    transactionId: string;
    productId: number;
    quantity: number;
    price: number;
    product?: Product;
}

export interface WalletAmounts {
    cashUSD: number;
    cashBs: number;
    transferUSD: number;
    cuentaBs: number;
}

export interface InventoryLog {
    id: string;
    timestamp: Date;
    productId: number;
    userId: string;
    userName?: string;
    action: 'create' | 'update' | 'delete' | 'addStock';
    description: any;
}