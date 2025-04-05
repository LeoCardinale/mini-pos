import React, { useState, useEffect } from 'react';
import { Account, AccountTransaction, AccountTransactionItem, Currency, Wallet, CashRegister, Transaction } from '../../types';
import { config } from '../../config';
import AccountItemsSelector from './AccountItemsSelector';
import CloseAccountConfirm from './CloseAccountConfirm';
import { accountOperations } from '../../lib/database';
import { initDatabase, cashRegisterOperations, transactionOperations } from '../../lib/database';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import CheckoutModal from '../pos/CheckoutModal';
import { useNavigate } from 'react-router-dom';

interface AccumulatedAccountDetailProps {
    account: Account;
    onUpdate: () => void;
}

const AccumulatedAccountDetail: React.FC<AccumulatedAccountDetailProps> = ({ account, onUpdate }) => {
    const [transactions, setTransactions] = useState<AccountTransaction[]>([]);
    const [balance, setBalance] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    //const [paymentAmount, setPaymentAmount] = useState('');
    const [showItemSelector, setShowItemSelector] = useState(false);
    //const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
    //const [paymentNote, setPaymentNote] = useState('');
    //const [discount, setDiscount] = useState(0);
    const [showCloseConfirm, setShowCloseConfirm] = useState(false);
    const { user } = useAuth();
    const { t } = useTranslation();
    const [currentRegister, setCurrentRegister] = useState<CashRegister | null>(null);

    const [showCheckoutModal, setShowCheckoutModal] = useState(false);
    const navigate = useNavigate();


    useEffect(() => {
        loadTransactions();
    }, [account.id]);

    const checkCurrentRegister = async () => {
        try {
            if (!user) return;
            const register = await cashRegisterOperations.getCurrent(user.id);
            setCurrentRegister(register);
        } catch (err) {
            setError('Error checking register status');
        }
    };

    useEffect(() => {
        checkCurrentRegister();
    }, [user]);

    const handleAddItems = async (items: Array<{ productId: number; quantity: number; price: number }>) => {
        if (!window.confirm('¿Está seguro que desea agregar estos productos a la cuenta?')) {
            return;
        }
        try {
            if (!user) {
                throw new Error('User not authenticated');
            }
            await accountOperations.addItems(account.id, items, user.id, 'ACCUMULATED', 'debit');
            setShowItemSelector(false);
            await loadTransactions();
        } catch (error) {
            setError('Error adding items');
            console.error('Error adding items:', error);
        }
    };

    const loadTransactions = async () => {
        try {
            const register = await cashRegisterOperations.getCurrent(user?.id);
            setCurrentRegister(register);

            const db = await initDatabase();

            // Obtener transacciones
            const tx = db.transaction(['accountTransactions', 'products'], 'readonly');
            const index = tx.objectStore('accountTransactions').index('by-account');
            const productsStore = tx.objectStore('products');

            const transactions = await index.getAll(account.id);

            // Enriquecer las transacciones con la información de los productos
            const formattedTransactions = await Promise.all(
                transactions.map(async t => {
                    if (t.items) {
                        const itemsWithProducts = await Promise.all(
                            t.items.map(async (item: AccountTransactionItem) => {
                                const product = await productsStore.get(item.productId);
                                return {
                                    ...item,
                                    product: product
                                };
                            })
                        );
                        return {
                            ...t,
                            items: itemsWithProducts,
                            createdAt: new Date(t.createdAt)
                        };
                    }
                    return {
                        ...t,
                        createdAt: new Date(t.createdAt)
                    };
                })
            );

            formattedTransactions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

            setTransactions(formattedTransactions);

            // Calcular balance
            const totalDebit = formattedTransactions
                .filter(taux => taux.type === 'debit')
                .reduce((sum: number, taux) => {
                    if (!register) {
                        return sum + (taux.currency === 'USD' ? taux.amount : 0);
                    }

                    const amountInUSD = taux.currency === 'BS'
                        ? taux.amount / register.dollarRate
                        : taux.amount;
                    return sum + amountInUSD;
                }, 0);

            const totalCredits = formattedTransactions
                .filter(t => t.type === 'credit')
                .reduce((sum: number, t) => {
                    if (!register) {
                        return sum + (t.currency === 'USD' ? t.amount : 0);
                    }

                    const amountInUSD = t.currency === 'BS'
                        ? t.amount / register.dollarRate
                        : t.amount;
                    return sum + amountInUSD;
                }, 0);

            setBalance(parseFloat((totalDebit - totalCredits).toFixed(2)));
        } catch (err) {
            setError('Error loading transactions');
            console.error('Error loading transactions:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handlePaymentClick = () => {
        if (!currentRegister) {
            setError("Debe abrir caja para esta operación");
            return;
        }
        setShowCheckoutModal(true);
    };

    const handlePaymentComplete = async (data: {
        paymentMethod: Wallet;
        customerName: string;
        discount: number;
        currency: Currency;
        paymentAmount?: number;
        paymentNote?: string;
    }) => {
        try {
            if (!user || !currentRegister) throw new Error('Invalid state');

            // Utilizamos el monto del pago (si se especificó en CheckoutModal), o el balance total
            const paymentAmountUSD = data.paymentAmount !== undefined ? data.paymentAmount : balance;

            // Validación adicional (el frontend ya debería haberlo validado, pero por seguridad)
            if (paymentAmountUSD <= 0) {
                throw new Error('El monto de pago debe ser mayor que cero');
            }

            if (paymentAmountUSD > balance) {
                throw new Error('El monto de pago no puede superar el balance pendiente');
            }

            // El monto en la moneda seleccionada
            const transactionAmount = data.currency === 'BS'
                ? paymentAmountUSD * currentRegister.dollarRate
                : paymentAmountUSD;

            // Formato para el nombre del cliente en la transacción POS
            const posCustomerName = `Accumulated: ${account.customerName}`;

            // Crear transacción POS para la caja
            const transaction: Omit<Transaction, 'id'> = {
                amount: transactionAmount,
                discount: data.discount,
                type: data.paymentMethod,
                currency: data.currency,
                wallet: data.paymentMethod,
                createdAt: new Date(),
                userId: user.id,
                deviceId: localStorage.getItem('deviceId') || 'unknown',
                customerName: posCustomerName,
                status: 'active',
                items: [] // Pagos no tienen items
            };

            // Crear transacción POS
            await transactionOperations.create(transaction);

            // Si es pago parcial y no hay nota específica, indicamos que es un pago parcial
            let paymentNote = data.paymentNote || '';
            if (data.paymentAmount !== undefined && data.paymentAmount < balance && !paymentNote) {
                paymentNote = t('accounts.partialPayment', 'Pago parcial');
            }

            // Crear transacción de cuenta
            await accountOperations.addItems(
                account.id,
                [],
                user.id,
                'ACCUMULATED',
                'credit',
                {
                    amount: transactionAmount,
                    method: data.paymentMethod,
                    discount: data.discount,
                    currency: data.currency,
                    note: paymentNote
                }
            );

            setShowCheckoutModal(false);
            await loadTransactions();
            onUpdate();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error processing payment');
        }
    };

    const handleDownloadReport = async () => {
        try {
            const response = await fetch(`${config.apiUrl}/accounts/${account.id}/report`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) throw new Error('Failed to download report');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `account-${account.id}-report.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            setError('Error downloading report');
        }
    };

    const handleCloseAccount = () => {
        setShowCloseConfirm(true);
    };

    const confirmClose = async () => {
        try {
            if (!user) {
                throw new Error('User not authenticated');
            }

            await accountOperations.closeAccount(account.id, user.id, 'ACCUMULATED');
            await onUpdate();
            setShowCloseConfirm(false);
            navigate('/accounts');
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Error closing account');
        }
    };

    const handleCancelConsumption = async (transaction: AccountTransaction) => {
        try {
            if (!user) {
                throw new Error('User not authenticated');
            }

            // Solo permitir cancelar transacciones de tipo 'debit' (consumos)
            if (transaction.type !== 'debit') {
                setError(t('errors.canOnlyCancelConsumptions'));
                return;
            }

            // Calcular el balance actual
            const totalDebit = transactions
                .filter(t => t.type === 'debit' && t.status === 'active')
                .reduce((sum, t) => sum + t.amount, 0);

            const totalCredit = transactions
                .filter(t => t.type === 'credit' && t.status === 'active')
                .reduce((sum, t) => sum + t.amount, 0);

            const currentBalance = totalDebit - totalCredit;

            // Verificar que la cancelación no resultará en un balance positivo
            if (currentBalance - transaction.amount < 0) {
                setError(t('errors.cancellationWouldResultInPositiveBalance'));
                return;
            }

            if (!window.confirm(t('confirmations.cancelConsumption'))) {
                return;
            }

            // Marcar la transacción como cancelada
            // await fetch(`${config.apiUrl}/accounts/${account.id}/transactions/${transaction.id}/cancel`, {
            //     method: 'PUT',
            //     headers: {
            //         'Content-Type': 'application/json',
            //         'Authorization': `Bearer ${localStorage.getItem('token')}`
            //     }
            // });
            await accountOperations.cancelTransaction(
                account.id,
                transaction.id,
                user.id,
                account.type,
                transaction.items || []
            );

            // Actualizar datos
            await loadTransactions();
            onUpdate();
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Error cancelling consumption');
        }
    };

    if (isLoading) return <div>{t('common.loading')}</div>;

    return (
        <div>
            <div className="mb-6 flex justify-between items-start">
                <div>
                    <h2 className="text-2xl font-bold">{account.customerName}</h2>
                    <p className="text-gray-600">{t('accounts.accumulated')}</p>
                    <p className="text-sm text-gray-500">{t('accounts.openedAt')}: {account.openedAt.toLocaleString()}</p>
                    {account.creditLimit && (
                        <p className="text-sm text-gray-500">{t('accounts.creditLimit')}: ${account.creditLimit}</p>
                    )}
                </div>
                <div className="space-y-2">
                    <span className={`block px-3 py-1 rounded-full text-sm text-center ${account.status === 'open' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                        {account.status === 'open' ? t('accounts.open') : t('accounts.closed')}
                    </span>
                    <p className={`text-lg font-bold ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {t('accounts.balance')}: ${Math.abs(balance).toFixed(2)}
                    </p>
                </div>
            </div>

            <div className="mb-4 space-x-4">
                <button
                    onClick={() => {
                        if (!currentRegister || currentRegister.status !== 'open') {
                            alert('Debe abrir caja para esta operación');
                            return;
                        }
                        handlePaymentClick();
                    }}
                    disabled={account.status !== 'open' || balance <= 0}
                    className={`bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    {t('accounts.makePayment')}
                </button>

                <button
                    onClick={() => {
                        if (!currentRegister || currentRegister.status !== 'open') {
                            alert('Debe abrir caja para esta operación');
                            return;
                        }
                        setShowItemSelector(true);
                    }}
                    disabled={account.status !== 'open'}
                    className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {t('accounts.addItems')}
                </button>

                <button
                    onClick={() => {
                        if (!currentRegister || currentRegister.status !== 'open') {
                            alert('Debe abrir caja para esta operación');
                            return;
                        }
                        handleCloseAccount();
                    }}
                    disabled={account.status !== 'open' || Math.abs(balance) >= 0.01}
                    className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {t('accounts.closeAccount')}
                </button>

                <button
                    onClick={handleDownloadReport}
                    className="bg-gray-100 text-gray-700 px-4 py-2 rounded hover:bg-gray-200"
                >
                    {t('register.downloadReport')}
                </button>
            </div>

            {showCloseConfirm && (
                <CloseAccountConfirm
                    account={account}
                    onConfirm={confirmClose}
                    onCancel={() => setShowCloseConfirm(false)}
                />
            )}

            {/* Lista de transacciones */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('common.date')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('common.type')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('common.details')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('common.amount')}</th>
                            {/* <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('common.actions')}</th> */}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {transactions.map(transaction => (
                            <tr key={transaction.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    {transaction.createdAt.toLocaleString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 py-1 rounded-full text-xs ${transaction.type === 'debit'
                                        ? 'bg-red-100 text-red-800'
                                        : 'bg-green-100 text-green-800'
                                        }`}>
                                        {t(`accounts.${transaction.type === 'debit' ? 'consumption' : 'payment'}`)}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    {transaction.type === 'credit' ? (
                                        <>
                                            {transaction.method && `${transaction.method}`}
                                            {transaction.note && ` | ${transaction.note}`}
                                        </>
                                    ) : (
                                        transaction.items?.map(item => (
                                            <div key={`${transaction.id}-${item.productId}-${item.quantity}`}>
                                                {item.product?.name} x {item.quantity} @ ${item.price}
                                            </div>
                                        ))
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    <span className={transaction.type === 'debit' ? 'text-red-600' : 'text-green-600'}>
                                        {transaction.currency === 'USD' ? '$' : 'Bs.'} {transaction.amount.toFixed(2)}
                                    </span>
                                </td>
                                {/* <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    {transaction.type === 'debit' &&
                                        transaction.status === 'active' &&
                                        account.status === 'open' && (
                                            <button
                                                onClick={() => handleCancelConsumption(transaction)}
                                                className="text-red-600 hover:text-red-900"
                                            >
                                                {t('common.cancel')}
                                            </button>
                                        )}
                                </td> */}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Selector de items */}
            {showItemSelector && (
                <div className="fixed inset-0 bg-white z-50">
                    <div className="p-4">
                        <AccountItemsSelector
                            accountId={account.id}
                            onConfirm={handleAddItems}
                            onCancel={() => setShowItemSelector(false)}
                        />
                    </div>
                </div>
            )}

            {/* Modal de Pago */}
            {showCheckoutModal && currentRegister && (
                <CheckoutModal
                    total={balance}
                    discount={0}
                    dollarRate={currentRegister.dollarRate}
                    onComplete={handlePaymentComplete}
                    onCancel={() => setShowCheckoutModal(false)}
                    context="account"
                    allowPartialPayment={true} // Habilitamos el pago parcial
                />
            )}
        </div>
    );
};

export default AccumulatedAccountDetail;