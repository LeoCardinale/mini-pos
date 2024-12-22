import React from 'react';
import { Transaction, PaymentMethod, CashRegister } from '../../types';
import { useTranslation } from 'react-i18next';

interface SalesSummaryProps {
    transactions: Transaction[];
    initialAmount: number;
    currentRegister: CashRegister;
    onCancelTransaction: (transactionId: number) => Promise<void>;
}

const SalesSummary: React.FC<SalesSummaryProps> = ({
    transactions,
    initialAmount,
    currentRegister,
    onCancelTransaction
}) => {
    const activeTransactions = transactions.filter(t => t.status === 'active');

    const totalSales = activeTransactions.reduce((sum, t) => sum + t.amount, 0);
    const totalDiscounts = activeTransactions.reduce((sum, t) => sum + t.discount, 0);
    const salesByMethod = activeTransactions.reduce((acc, t) => ({
        ...acc,
        [t.type]: (acc[t.type] || 0) + t.amount
    }), {} as Record<PaymentMethod, number>);
    const { t } = useTranslation();

    return (
        <div className="bg-white rounded-lg shadow p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-blue-800">{t('register.initialAmount')}</h3>
                    <p className="text-2xl font-bold text-blue-900">
                        ${initialAmount.toFixed(2)}
                    </p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-green-800">{t('register.totalSales')}</h3>
                    <p className="text-2xl font-bold text-green-900">
                        ${totalSales.toFixed(2)}
                    </p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-red-800">{t('register.totalDiscounts')}</h3>
                    <p className="text-2xl font-bold text-red-900">
                        ${totalDiscounts.toFixed(2)}
                    </p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-purple-800">{t('register.expectedAmount')}</h3>
                    <p className="text-2xl font-bold text-purple-900">
                        ${(initialAmount + totalSales).toFixed(2)}
                    </p>
                </div>
            </div>

            <div>
                <h3 className="text-lg font-medium mb-3">{t('register.byPaymentMethod')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {(['cash', 'card', 'transfer'] as PaymentMethod[]).map(method => (
                        <div key={method} className="bg-gray-50 p-4 rounded-lg">
                            <h4 className="text-sm font-medium text-gray-600 capitalize">
                                {method}
                            </h4>
                            <p className="text-xl font-bold text-gray-900">
                                ${(salesByMethod[method] || 0).toFixed(2)}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            <div>
                <h3 className="text-lg font-medium mb-3">{t('register.recentTransactions')}</h3>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    {t('common.time')}
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    {t('common.amount')}
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    {t('common.discount')}
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    {t('common.payment')}
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    {t('common.customer')}
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    {t('common.status')}
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    {t('common.actions')}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {transactions.map((transaction) => (
                                <tr key={transaction.id}
                                    className={transaction.status === 'cancelled' ? 'bg-gray-50' : ''}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {transaction.createdAt.toLocaleTimeString()}
                                    </td>
                                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${transaction.status === 'cancelled' ? 'text-gray-400 line-through' : 'text-gray-900'
                                        }`}>
                                        ${transaction.amount.toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                                        {transaction.discount > 0 ? `-$${transaction.discount.toFixed(2)}` : '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                                        {transaction.type}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {transaction.customerName || '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        {transaction.status === 'active' ? (
                                            <span className="text-green-600">{t('common.active')}</span>
                                        ) : (
                                            <span className="text-red-600">{t('common.cancelled')}</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        {transaction.status === 'active' && currentRegister.status === 'open' && (
                                            <button
                                                onClick={() => {
                                                    if (window.confirm(t('confirmations.cancelTransaction'))) {
                                                        onCancelTransaction(transaction.id);
                                                    }
                                                }}
                                                className="text-red-600 hover:text-red-900"
                                            >
                                                {t('common.cancel')}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default SalesSummary;