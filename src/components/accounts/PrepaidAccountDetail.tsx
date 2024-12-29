import React, { useState, useEffect } from 'react';
import { Account, PrepaidProduct, AccountTransaction, AccountTransactionItem } from '../../types';
import { useAuth } from '../../context/AuthContext';
import PrepaidProductSelector from './PrepaidProductSelector';
import CloseAccountConfirm from './CloseAccountConfirm';
import { initDatabase, accountOperations, cashRegisterOperations } from '../../lib/database';
import { useTranslation } from 'react-i18next';

interface PrepaidAccountDetailProps {
    account: Account;
    onUpdate: () => void;
}

const PrepaidAccountDetail: React.FC<PrepaidAccountDetailProps> = ({ account, onUpdate }) => {
    const { user } = useAuth();
    const [products, setProducts] = useState<PrepaidProduct[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showProductSelector, setShowProductSelector] = useState(false);
    const [showCloseConfirm, setShowCloseConfirm] = useState(false);
    const { t } = useTranslation();
    const [registerStatus, setRegisterStatus] = useState<'open' | 'closed' | null>(null);

    // Mantenemos este cálculo igual
    const totalPaid = products.reduce((sum, p) => {
        const price = p.product?.price ?? 0;
        return sum + (p.paid * price);
    }, 0);

    useEffect(() => {
        const checkRegister = async () => {
            if (!user) return;
            const register = await cashRegisterOperations.getCurrent(user.id);
            setRegisterStatus(register?.status || null);
        };
        checkRegister();
    }, [user]);

    useEffect(() => {
        loadTransactions();
    }, [account.id]);

    const loadTransactions = async () => {
        try {
            const db = await initDatabase();
            const tx = db.transaction(['accountTransactions', 'products'], 'readonly');
            const index = tx.objectStore('accountTransactions').index('by-account');
            const productsStore = tx.objectStore('products');

            const transactions = await index.getAll(account.id);

            // Filtramos solo las transacciones de tipo PREPAID
            const prepaidTransactions = transactions.filter(t => t.accountType === 'PREPAID');

            // Procesamos las transacciones para construir el estado de productos prepago
            const productMap = new Map<number, PrepaidProduct>();

            for (const transaction of prepaidTransactions) {
                if (transaction.items) {
                    for (const item of transaction.items) {
                        const product = await productsStore.get(item.productId);

                        if (!productMap.has(item.productId)) {
                            productMap.set(item.productId, {
                                id: item.productId,
                                accountId: account.id,
                                productId: item.productId,
                                paid: 0,
                                consumed: 0,
                                product
                            });
                        }

                        const prepaidProduct = productMap.get(item.productId)!;
                        if (transaction.type === 'credit') {
                            prepaidProduct.paid += item.quantity;
                        } else if (transaction.type === 'debit') {
                            prepaidProduct.consumed += item.quantity;
                        }
                    }
                }
            }

            // Convertir el Map a array y ordenar por nombre del producto
            const sortedProducts = Array.from(productMap.values())
                .sort((a, b) => (a.product?.name || '').localeCompare(b.product?.name || ''));

            setProducts(sortedProducts);
        } catch (err) {
            setError(t('errors.loadingTransactions'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleConsume = async (productId: number, quantity: number) => {
        try {
            if (!user) {
                throw new Error('User not authenticated');
            }

            await accountOperations.addItems(account.id, [{
                productId,
                quantity,
                price: 0 // El precio es 0 porque es un consumo
            }], user.id, 'PREPAID', 'debit'); // Especificamos que es una transacción de débito

            await loadTransactions();
            onUpdate();
        } catch (err) {
            setError(t('errors.consuming'));
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

            // Encolamos la operación de cierre de cuenta
            await accountOperations.closeAccount(account.id, user.id, 'PREPAID');
            await onUpdate();
            setShowCloseConfirm(false);
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Error closing account');
        }
    };

    if (isLoading) return <div>Loading...</div>;

    return (
        <div>
            <div className="mb-6">
                <h2 className="text-2xl font-bold">{account.customerName}</h2>
                <p className="text-gray-600">{t('accounts.prepaid')}</p>
                <p className="text-sm text-gray-500">{t('accounts.openedAt')}: {account.openedAt.toLocaleString()}</p>
                <span className={`inline-block px-2 py-1 rounded-full text-sm ${account.status === 'open' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                    {account.status}
                </span>
            </div>

            <div className="mb-4 text-lg">
                <span className="font-medium">{t('accounts.totalPaid')}:</span>
                <span className="ml-2">${totalPaid.toFixed(2)}</span>
            </div>

            <div className="mb-4 space-x-4">
                <button
                    onClick={() => {
                        if (registerStatus !== 'open') {
                            alert('Debe abrir caja para esta operación');
                            return;
                        }
                        setShowProductSelector(true);
                    }}
                    disabled={account.status !== 'open'}
                    className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {t('accounts.addItems')}
                </button>

                <button
                    onClick={() => {
                        if (registerStatus !== 'open') {
                            alert('Debe abrir caja para esta operación');
                            return;
                        }
                        handleCloseAccount;
                    }}
                    disabled={account.status !== 'open' || products.some(p => p.paid > p.consumed)}
                    className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {t('accounts.closeAccount')}
                </button>
            </div>

            {showCloseConfirm && (
                <CloseAccountConfirm
                    account={account}
                    onConfirm={confirmClose}
                    onCancel={() => setShowCloseConfirm(false)}
                />
            )}

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('common.product')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('accounts.paid')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('accounts.consumed')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('accounts.available')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('common.actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {products.map(product => {
                            const available = product.paid - product.consumed;
                            return (
                                <tr key={product.id}>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {product.product?.name}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {product.paid}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {product.consumed}
                                    </td>
                                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${available > 0
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-red-100 text-red-800'
                                        }`}>
                                        {available}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {available > 0 && account.status === 'open' && (
                                            <button
                                                onClick={() => handleConsume(product.productId, 1)}
                                                className="text-green-600 hover:text-green-900"
                                            >
                                                {t('accounts.consume')}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {showProductSelector && (
                <div className="fixed inset-0 bg-white z-50">
                    <div className="p-4">
                        <PrepaidProductSelector
                            accountId={account.id}
                            onSuccess={() => {
                                setShowProductSelector(false);
                                loadTransactions();
                            }}
                            onCancel={() => setShowProductSelector(false)}
                        />
                    </div>
                </div>
            )}

            {error && (
                <div className="mt-4 text-red-600">
                    {error}
                </div>
            )}
        </div>
    );
};

export default PrepaidAccountDetail;