import React from 'react';
import { Transaction, PaymentMethod } from '../../types';

interface SalesSummaryProps {
    transactions: Transaction[];
    initialAmount: number;
}

const SalesSummary: React.FC<SalesSummaryProps> = ({
    transactions,
    initialAmount
}) => {
    const totalSales = transactions.reduce((sum, t) => sum + t.amount, 0);
    const salesByMethod = transactions.reduce((acc, t) => ({
        ...acc,
        [t.type]: (acc[t.type] || 0) + t.amount
    }), {} as Record<PaymentMethod, number>);

    return (
        <div className="bg-white rounded-lg shadow p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-blue-800">Initial Amount</h3>
                    <p className="text-2xl font-bold text-blue-900">
                        ${initialAmount.toFixed(2)}
                    </p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-green-800">Total Sales</h3>
                    <p className="text-2xl font-bold text-green-900">
                        ${totalSales.toFixed(2)}
                    </p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-purple-800">Expected in Register</h3>
                    <p className="text-2xl font-bold text-purple-900">
                        ${(initialAmount + totalSales).toFixed(2)}
                    </p>
                </div>
            </div>

            <div>
                <h3 className="text-lg font-medium mb-3">Sales by Payment Method</h3>
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
                <h3 className="text-lg font-medium mb-3">Recent Transactions</h3>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Time
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Amount
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Payment
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Customer
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {transactions.map((transaction) => (
                                <tr key={transaction.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {transaction.createdAt.toLocaleTimeString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        ${transaction.amount.toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                                        {transaction.type}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {transaction.customerName || '-'}
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