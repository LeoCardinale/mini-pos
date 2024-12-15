import React, { useState, useEffect } from 'react';
import { Account, PrepaidProduct } from '../../types';
import { config } from '../../config';
import PrepaidProductSelector from './PrepaidProductSelector';

interface PrepaidAccountDetailProps {
    account: Account;
    onUpdate: () => void;
}

const PrepaidAccountDetail: React.FC<PrepaidAccountDetailProps> = ({ account, onUpdate }) => {
    const [products, setProducts] = useState<PrepaidProduct[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showProductSelector, setShowProductSelector] = useState(false);
    const totalPaid = products.reduce((sum, p) => {
        const price = p.product?.price ?? 0;
        return sum + (p.paid * price);
    }, 0);



    useEffect(() => {
        loadPrepaidProducts();
    }, [account.id]);

    const loadPrepaidProducts = async () => {
        try {
            const response = await fetch(`${config.apiUrl}/accounts/${account.id}/prepaid-products`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) throw new Error('Failed to load products');

            const data = await response.json();
            setProducts(data);
        } catch (err) {
            setError('Error loading prepaid products');
        } finally {
            setIsLoading(false);
        }
    };

    const handleConsume = async (productId: number, quantity: number) => {
        try {
            const response = await fetch(`${config.apiUrl}/accounts/${account.id}/consume`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ productId, quantity })
            });

            if (!response.ok) throw new Error('Failed to consume product');

            await loadPrepaidProducts();
            onUpdate();
        } catch (err) {
            setError('Error consuming product');
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
            <div className="mb-6">
                <h2 className="text-2xl font-bold">{account.customerName}</h2>
                <p className="text-gray-600">Prepaid Account</p>
                <p className="text-sm text-gray-500">Opened: {account.openedAt.toLocaleString()}</p>
                <span className={`inline-block px-2 py-1 rounded-full text-sm ${account.status === 'open' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                    {account.status}
                </span>
            </div>

            <div className="mb-4 text-lg">
                <span className="font-medium">Total Paid:</span>
                <span className="ml-2">${totalPaid.toFixed(2)}</span>
            </div>

            <div className="mb-4 space-x-4">
                {account.status === 'open' && (
                    <button
                        onClick={() => setShowProductSelector(true)}
                        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                    >
                        Add Products
                    </button>
                )}
                {account.status === 'open' && !products.some(p => p.paid > p.consumed) && (
                    <button
                        onClick={handleCloseAccount}
                        className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                    >
                        Close Account
                    </button>
                )}
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paid</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Consumed</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Available</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
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
                                                Consume
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
                                loadPrepaidProducts();
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