import React from 'react';
import { Transaction, PaymentMethod, CashRegister } from '../../types';
import { useTranslation } from 'react-i18next';

interface SalesSummaryProps {
    transactions: Transaction[];
    currentRegister: CashRegister;
    onCancelTransaction: (transactionId: number) => Promise<void>;
}

const SalesSummary: React.FC<SalesSummaryProps> = ({
    transactions,
    currentRegister,
    onCancelTransaction
}) => {
    const activeTransactions = transactions.filter(t => t.status === 'active');
    const { t } = useTranslation();

    // Totales por wallet
    const salesByWallet = activeTransactions.reduce((totals, trans) => ({
        cashUSD: totals.cashUSD + (trans.wallet === 'CASH_USD' ? trans.amount : 0),
        cashBs: totals.cashBs + (trans.wallet === 'CASH_BS' ? trans.amount : 0),
        transferUSD: totals.transferUSD + (trans.wallet === 'TRANSFER_USD' ? trans.amount : 0),
        cuentaBs: totals.cuentaBs + (trans.wallet === 'CUENTA_BS' ? trans.amount : 0)
    }), {
        cashUSD: 0,
        cashBs: 0,
        transferUSD: 0,
        cuentaBs: 0
    });

    const totalDiscounts = activeTransactions.reduce((sum, t) => sum + t.discount, 0);

    return (
        <div className="bg-white rounded-lg shadow p-6 space-y-6">
            {/* Initial Amounts Grid */}
            <h3 className="text-lg font-medium mb-3">Montos Iniciales</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-blue-800">Efectivo USD</h3>
                    <p className="text-sm font-bold text-blue-900">
                        ${currentRegister.initialCashUSD.toFixed(2)}
                    </p>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-blue-800">Zelle USD</h3>
                    <p className="text-sm font-bold text-blue-900">
                        ${currentRegister.initialTransferUSD.toFixed(2)}
                    </p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-purple-800">Efectivo Bs.</h3>
                    <p className="text-sm font-bold text-purple-900">
                        Bs. {currentRegister.initialCashBs.toFixed(2)}
                    </p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-purple-800">Cuenta Bs.</h3>
                    <p className="text-sm font-bold text-purple-900">
                        Bs. {currentRegister.initialCuentaBs.toFixed(2)}
                    </p>
                </div>
            </div>

            {/* Sales by Wallet */}
            <div>
                <h3 className="text-lg font-medium mb-3">Ingresos en Cuentas</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                        <h4 className="text-sm font-medium text-blue-800">Cash USD</h4>
                        <p className="text-xl font-bold text-blue-900">
                            ${salesByWallet.cashUSD.toFixed(2)}
                        </p>
                        <p className="text-xs font-bold italic text-right text-blue-700">
                            Total en cuenta: ${(currentRegister.initialCashUSD + salesByWallet.cashUSD).toFixed(2)}
                        </p>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg">
                        <h4 className="text-sm font-medium text-blue-800">Transfer USD</h4>
                        <p className="text-xl font-bold text-blue-900">
                            ${salesByWallet.transferUSD.toFixed(2)}
                        </p>
                        <p className="text-xs font-bold italic text-right text-blue-700">
                            Total en cuenta: ${(currentRegister.initialTransferUSD + salesByWallet.transferUSD).toFixed(2)}
                        </p>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg">
                        <h4 className="text-sm font-medium text-purple-800">Cash Bs.</h4>
                        <p className="text-xl font-bold text-purple-900">
                            Bs. {salesByWallet.cashBs.toFixed(2)}
                        </p>
                        <p className="text-xs font-bold italic text-right text-blue-700">
                            Total en cuenta: Bs.{(currentRegister.initialCashBs + salesByWallet.cashBs).toFixed(2)}
                        </p>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg">
                        <h4 className="text-sm font-medium text-purple-800">Cuenta Bs.</h4>
                        <p className="text-xl font-bold text-purple-900">
                            Bs. {salesByWallet.cuentaBs.toFixed(2)}
                        </p>
                        <p className="text-xs font-bold italic text-right text-blue-700">
                            Total en cuenta: Bs.{(currentRegister.initialCuentaBs + salesByWallet.cuentaBs).toFixed(2)}
                        </p>
                    </div>
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
                                    {t('common.wallet')}
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
                                        "{transaction.createdAt.toLocaleTimeString()}"
                                    </td>
                                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${transaction.status === 'cancelled' ? 'text-gray-400 line-through' : 'text-gray-900'
                                        }`}>
                                        {transaction.currency === 'USD' ? '$' : 'Bs.'} {transaction.amount.toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                                        {transaction.discount > 0 ?
                                            `${transaction.currency === 'USD' ? '$' : 'Bs.'} ${transaction.discount.toFixed(2)}`
                                            : '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {(() => {
                                            switch (transaction.wallet) {
                                                case 'CASH_USD': return 'Cash $';
                                                case 'CASH_BS': return 'Cash Bs.';
                                                case 'TRANSFER_USD': return 'Transfer $';
                                                case 'CUENTA_BS': return 'Cuenta Bs.';
                                                default: return transaction.wallet;
                                            }
                                        })()}
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