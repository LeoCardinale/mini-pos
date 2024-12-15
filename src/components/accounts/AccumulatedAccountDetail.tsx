import React, { useState, useEffect } from 'react';
import { Account, AccountTransaction, Product } from '../../types';
import { config } from '../../config';
import AccountItemsSelector from './AccountItemsSelector';

type PaymentMethod = 'cash' | 'card' | 'transfer';

interface PaymentData {
    amount: number;
    method: PaymentMethod;
    discount: number;
    note?: string;
}

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
    const [paymentAmount, setPaymentAmount] = useState('');
    const [showAddItemsModal, setShowAddItemsModal] = useState(false);
    const [newItems, setNewItems] = useState<Array<{ productId: number; quantity: number; price: number }>>([]);
    const [products, setProducts] = useState<Array<Product>>([]);
    const [showItemSelector, setShowItemSelector] = useState(false);

    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
    const [paymentNote, setPaymentNote] = useState('');
    const [discount, setDiscount] = useState(0);

    useEffect(() => {
        loadTransactions();
    }, [account.id]);

    useEffect(() => {
        const loadProducts = async () => {
            try {
                const response = await fetch(`${config.apiUrl}/products`, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });
                if (response.ok) {
                    const data = await response.json();
                    setProducts(data);
                }
            } catch (error) {
                console.error('Error loading products:', error);
            }
        };
        loadProducts();
    }, []);

    const handleAddItems = async (items: Array<{ productId: number; quantity: number; price: number }>) => {
        try {
            const response = await fetch(`${config.apiUrl}/accounts/${account.id}/transactions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ items })
            });

            if (!response.ok) {
                throw new Error('Failed to add items');
            }

            setShowItemSelector(false);
            await loadTransactions();
        } catch (error) {
            setError('Error adding items');
        }
    };

    const loadTransactions = async () => {
        try {
            const response = await fetch(`${config.apiUrl}/accounts/${account.id}/transactions`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) throw new Error('Failed to load transactions');

            const data = await response.json();
            const formattedTransactions = data.map((t: any) => ({
                ...t,
                createdAt: new Date(t.createdAt)
            }));

            setTransactions(formattedTransactions);

            // Calcular balance
            const totalDebit = formattedTransactions
                .filter((t: AccountTransaction) => t.type === 'debit')
                .reduce((sum: number, t: AccountTransaction) => sum + t.amount, 0);

            const totalCredits = formattedTransactions
                .filter((t: AccountTransaction) => t.type === 'credit')
                .reduce((sum: number, t: AccountTransaction) => sum + t.amount + (t.discount || 0), 0);

            setBalance(parseFloat((totalDebit - totalCredits).toFixed(2)));
        } catch (err) {
            setError('Error loading transactions');
        } finally {
            setIsLoading(false);
        }
    };

    const handleMakePayment = async () => {
        setError(null);
        try {
            const amount = parseFloat(paymentAmount);
            if (isNaN(amount) || amount <= 0) {
                setError('Please enter a valid amount');
                return;
            }

            if (amount > (balance - discount)) {
                setError('Payment amount cannot exceed pending balance');
                return;
            }

            const response = await fetch(`${config.apiUrl}/accounts/${account.id}/payment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    amount,
                    method: paymentMethod,
                    discount,
                    note: paymentNote || undefined
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Payment failed');
            }

            setShowPaymentModal(false);
            setPaymentAmount('');
            setPaymentMethod('cash');
            setPaymentNote('');
            setDiscount(0);
            setError(null);
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

    const handleCloseAccount = async () => {
        try {
            const response = await fetch(`${config.apiUrl}/accounts/${account.id}/close`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to close account');
            }

            await onUpdate();
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Error closing account');
        }
    };

    if (isLoading) return <div>Loading...</div>;

    return (
        <div>
            <div className="mb-6 flex justify-between items-start">
                <div>
                    <h2 className="text-2xl font-bold">{account.customerName}</h2>
                    <p className="text-gray-600">Accumulated Account</p>
                    <p className="text-sm text-gray-500">Opened: {account.openedAt.toLocaleString()}</p>
                    {account.creditLimit && (
                        <p className="text-sm text-gray-500">Credit Limit: ${account.creditLimit}</p>
                    )}
                </div>
                <div className="space-y-2">
                    <span className={`block px-3 py-1 rounded-full text-sm text-center ${account.status === 'open' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                        {account.status}
                    </span>
                    <p className={`text-lg font-bold ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        Balance: ${Math.abs(balance).toFixed(2)}
                    </p>
                </div>
            </div>

            <div className="mb-4 space-x-4">
                {account.status === 'open' && balance > 0 && (
                    <button
                        onClick={() => setShowPaymentModal(true)}
                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                    >
                        Make Payment
                    </button>
                )}
                {account.status === 'open' && (
                    <button
                        onClick={() => setShowItemSelector(true)}
                        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                    >
                        Add Items
                    </button>
                )}
                {account.status === 'open' && Math.abs(balance) < 0.01 && (
                    <button
                        onClick={handleCloseAccount}
                        className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                    >
                        Close Account
                    </button>
                )}
                <button
                    onClick={handleDownloadReport}
                    className="bg-gray-100 text-gray-700 px-4 py-2 rounded hover:bg-gray-200"
                >
                    Download Report
                </button>
            </div>

            {/* Lista de transacciones */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
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
                                        {transaction.type === 'debit' ? 'Consumption' : 'Payment'}
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
                                            <div key={item.id}>
                                                {item.product?.name} x {item.quantity} @ ${item.price}
                                            </div>
                                        ))
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    <span className={transaction.type === 'debit' ? 'text-red-600' : 'text-green-600'}>
                                        ${transaction.amount.toFixed(2)}
                                    </span>
                                </td>
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
                            onConfirm={handleAddItems}
                            onCancel={() => setShowItemSelector(false)}
                        />
                    </div>
                </div>
            )}

            {/* Modal de Pago */}
            {showPaymentModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full">
                        <h3 className="text-lg font-bold mb-4">Make Payment</h3>

                        {/* Montos */}
                        <div className="space-y-4 mb-6">
                            <div className="flex justify-between">
                                <span className="font-medium">Pending:</span>
                                <span>${balance.toFixed(2)}</span>
                            </div>

                            {/* Descuento */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Discount
                                </label>
                                <input
                                    type="number"
                                    value={discount}
                                    onChange={(e) => {
                                        const value = Math.min(balance, Math.max(0, parseFloat(e.target.value) || 0));
                                        setDiscount(value);
                                    }}
                                    className="w-full px-3 py-2 border rounded-md"
                                    min="0"
                                    max={balance}
                                />
                            </div>

                            <div className="flex justify-between text-lg font-bold">
                                <span>Total:</span>
                                <span>${(balance - discount).toFixed(2)}</span>
                            </div>

                            {/* Monto a pagar */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Monto a pagar:
                                </label>
                                <input
                                    type="number"
                                    value={paymentAmount}
                                    onChange={(e) => setPaymentAmount(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-md"
                                    min="0"
                                    max={balance - discount}
                                />
                            </div>

                            {/* Método de pago */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Payment Method
                                </label>
                                <div className="space-y-2">
                                    <label className="flex items-center">
                                        <input
                                            type="radio"
                                            name="paymentMethod"
                                            value="cash"
                                            checked={paymentMethod === 'cash'}
                                            onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                                            className="mr-2"
                                        />
                                        Cash
                                    </label>
                                    <label className="flex items-center">
                                        <input
                                            type="radio"
                                            name="paymentMethod"
                                            value="card"
                                            checked={paymentMethod === 'card'}
                                            onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                                            className="mr-2"
                                        />
                                        Card
                                    </label>
                                    <label className="flex items-center">
                                        <input
                                            type="radio"
                                            name="paymentMethod"
                                            value="transfer"
                                            checked={paymentMethod === 'transfer'}
                                            onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                                            className="mr-2"
                                        />
                                        Transfer
                                    </label>
                                </div>
                            </div>

                            {/* Nota de pago */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Payment note
                                </label>
                                <input
                                    type="text"
                                    value={paymentNote}
                                    onChange={(e) => setPaymentNote(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-md"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="text-red-600 text-sm mb-4">{error}</div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={handleMakePayment}
                                className="flex-1 bg-green-600 text-white py-2 rounded-md hover:bg-green-700"
                            >
                                Complete
                            </button>
                            <button
                                onClick={() => {
                                    setShowPaymentModal(false);
                                    setPaymentAmount('');
                                    setPaymentMethod('cash');
                                    setPaymentNote('');
                                    setDiscount(0);
                                    setError(null);
                                }}
                                className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-md hover:bg-gray-200"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AccumulatedAccountDetail;