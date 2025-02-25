import React, { useState, useEffect } from 'react';
import { Account, PrepaidProduct, AccountTransaction, AccountTransactionItem } from '../../types';
import { useAuth } from '../../context/AuthContext';
import PrepaidProductSelector from './PrepaidProductSelector';
import CloseAccountConfirm from './CloseAccountConfirm';
import { initDatabase, accountOperations, cashRegisterOperations } from '../../lib/database';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';


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
    const navigate = useNavigate();

    // Estado para el consumo
    const [isConsumeMode, setIsConsumeMode] = useState(false);
    const [consumeQuantities, setConsumeQuantities] = useState<Record<number, number>>({});
    const [transactions, setTransactions] = useState<AccountTransaction[]>([]);

    // Función para actualizar cantidad de consumo
    const updateConsumeQuantity = (productId: number, quantity: number) => {
        const product = products.find(p => p.productId === productId);
        if (!product) return;

        const available = product.paid - product.consumed;
        // Limitar cantidad al disponible
        const newQuantity = Math.max(0, Math.min(quantity, available));

        setConsumeQuantities(prev => ({
            ...prev,
            [productId]: newQuantity
        }));
    };

    // Función para confirmar consumo
    const confirmConsumption = async () => {
        try {
            // Validar que hay algo seleccionado
            const itemsToConsume = Object.entries(consumeQuantities)
                .filter(([_, qty]) => qty > 0)
                .map(([productId, quantity]) => ({
                    productId: parseInt(productId),
                    quantity,
                    product: products.find(p => p.productId === parseInt(productId))?.product?.name || `Item ${productId}`
                }));

            if (itemsToConsume.length === 0) {
                setError('No items selected for consumption');
                return;
            }

            // Mostrar confirmación
            const itemsList = itemsToConsume
                .map(item => `${item.product} x ${item.quantity}`)
                .join('\n');

            const confirmMessage = `${t('accounts.confirmConsumptionPrompt')}:\n\n${itemsList}`;

            if (!window.confirm(confirmMessage)) {
                return; // Usuario canceló
            }

            // Continuar con el consumo
            if (!user) throw new Error('User not authenticated');

            await accountOperations.addItems(
                account.id,
                itemsToConsume.map(({ productId, quantity }) => ({
                    productId,
                    quantity,
                    price: 0
                })),
                user.id,
                'PREPAID',
                'debit'
            );

            // Reiniciar estado
            setIsConsumeMode(false);
            setConsumeQuantities({});
            await loadTransactions();
            await loadTransactionHistory();
            onUpdate();
        } catch (error) {
            setError(error instanceof Error ? error.message : t('errors.consuming'));
        }
    };

    useEffect(() => {
        const checkRegister = async () => {
            if (!user) return;
            const register = await cashRegisterOperations.getCurrent(user.id);
            setRegisterStatus(register?.status || null);
        };
        checkRegister();
    }, [user]);

    useEffect(() => {
        //loadProducts();
        loadTransactions();
        loadTransactionHistory();
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

    const loadTransactionHistory = async () => {
        try {
            const db = await initDatabase();
            const tx = db.transaction(['accountTransactions', 'products'], 'readonly');
            const index = tx.objectStore('accountTransactions').index('by-account');
            const productsStore = tx.objectStore('products');

            const allTransactions = await index.getAll(account.id);

            // Enriquecer con información de productos
            const enrichedTransactions = await Promise.all(
                allTransactions.map(async t => {
                    if (t.items) {
                        const enrichedItems = await Promise.all(
                            t.items.map(async (item: AccountTransactionItem) => {
                                const product = await productsStore.get(item.productId);
                                return {
                                    ...item,
                                    product
                                };
                            })
                        );
                        return {
                            ...t,
                            items: enrichedItems,
                            createdAt: new Date(t.createdAt)
                        };
                    }
                    return {
                        ...t,
                        createdAt: new Date(t.createdAt)
                    };
                })
            );

            // Ordenar por fecha descendente
            enrichedTransactions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

            setTransactions(enrichedTransactions);
        } catch (err) {
            setError(t('errors.loadingTransactions'));
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

            if (!window.confirm(t('confirmations.cancelConsumption'))) {
                return;
            }

            await accountOperations.cancelTransaction(
                account.id,
                transaction.id,
                user.id,
                account.type,
                transaction.items || []
            );

            // Actualizar datos
            await loadTransactions();
            await loadTransactionHistory();
            onUpdate();
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Error cancelling consumption');
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
                    {account.status === 'open' ? t('accounts.open') : t('accounts.closed')}
                </span>
            </div>

            {/* <div className="mb-4 text-lg">
                <span className="font-medium">{t('accounts.totalPaid')}:</span>
                <span className="ml-2">${totalPaid.toFixed(2)}</span>
            </div> */}
            <div className="mb-4 text-lg">
                <span className="font-medium">{t('accounts.totalPaid')}:</span>
                <span className="ml-2">${
                    products.reduce((sum, p) => sum + (p.paid * (p.product?.price ?? 0)), 0).toFixed(2)
                }</span>
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
                        setIsConsumeMode(!isConsumeMode);
                        if (!isConsumeMode) {
                            // Inicializar cantidades a 0
                            const initialQuantities = products.reduce((acc, product) => {
                                acc[product.productId] = 0;
                                return acc;
                            }, {} as Record<number, number>);
                            setConsumeQuantities(initialQuantities);
                        }
                    }}
                    disabled={account.status !== 'open' || products.length === 0}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isConsumeMode ? t('common.cancel') : t('accounts.consume')}
                </button>

                <button
                    onClick={() => {
                        if (registerStatus !== 'open') {
                            alert('Debe abrir caja para esta operación');
                            return;
                        }
                        handleCloseAccount();
                    }}
                    disabled={account.status !== 'open' || products.some(p => p.paid > p.consumed)}
                    className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
                                        {available > 0 && account.status === 'open' && isConsumeMode && (
                                            <div className="flex items-center space-x-2">
                                                <button
                                                    onClick={() => updateConsumeQuantity(
                                                        product.productId,
                                                        (consumeQuantities[product.productId] || 0) - 1
                                                    )}
                                                    className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-300"
                                                >
                                                    -
                                                </button>
                                                <input
                                                    type="number"
                                                    value={consumeQuantities[product.productId] || 0}
                                                    onChange={(e) => {
                                                        const value = parseInt(e.target.value) || 0;
                                                        updateConsumeQuantity(product.productId, value);
                                                    }}
                                                    className="w-16 text-center border rounded-md"
                                                    min="0"
                                                    max={available}
                                                />
                                                <button
                                                    onClick={() => updateConsumeQuantity(
                                                        product.productId,
                                                        (consumeQuantities[product.productId] || 0) + 1
                                                    )}
                                                    className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-300"
                                                >
                                                    +
                                                </button>
                                            </div>
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
                            account={account}
                            onSuccess={() => {
                                setShowProductSelector(false);
                                loadTransactions();
                                loadTransactionHistory();
                            }}
                            onCancel={() => setShowProductSelector(false)}
                        />
                    </div>
                </div>
            )}

            {isConsumeMode && (
                <div className="mb-8">
                    <button
                        onClick={confirmConsumption}
                        disabled={Object.values(consumeQuantities).every(qty => qty === 0)}
                        className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {t('accounts.confirmConsumption')}
                    </button>
                </div>
            )}

            {/* Historial de transacciones */}
            <div className="mt-8">
                <h3 className="text-lg font-medium mb-4">{t('accounts.transactionHistory')}</h3>
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('common.date')}</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('common.type')}</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('common.details')}</th>
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
                                            {transaction.type === 'debit' ? t('accounts.consumption') : t('accounts.payment')}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        {transaction.items?.map(item => (
                                            <div key={`${transaction.id}-${item.productId}`}>
                                                {item.product?.name || `Item ${item.productId}`} x {item.quantity}
                                            </div>
                                        )) || '-'}
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
            </div>

            {error && (
                <div className="mt-4 text-red-600">
                    {error}
                </div>
            )}
        </div>
    );
};

export default PrepaidAccountDetail;