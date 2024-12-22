// src/pages/register/RegisterControl.tsx
import React, { useState, useEffect } from 'react';
import { Transaction, CashRegister, PaymentMethod } from '../../types';
import { cashRegisterOperations, transactionOperations } from '../../lib/database';
import SalesSummary from '../../components/register/SalesSummary';
import { saveAs } from 'file-saver';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';


const RegisterControl = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentRegister, setCurrentRegister] = useState<CashRegister | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [initialAmount, setInitialAmount] = useState('');
    const [finalAmount, setFinalAmount] = useState('');
    const { user } = useAuth();
    const { t } = useTranslation();

    useEffect(() => {
        checkRegisterStatus();
    }, []);

    const checkRegisterStatus = async () => {
        try {
            setIsLoading(true);
            const registers = await cashRegisterOperations.getCurrent(user?.id);
            console.log('Current register:', registers);
            setCurrentRegister(registers || null);

            if (registers) {
                const registerTransactions = await transactionOperations.getAll();
                console.log('All transactions:', registerTransactions);
                const filteredTransactions = registerTransactions.filter(transaction =>
                    transaction.userId === user?.id &&
                    transaction.createdAt >= registers.openedAt &&
                    (!registers.closedAt || transaction.createdAt <= registers.closedAt)
                );
                console.log('Filtered transactions:', filteredTransactions);
                setTransactions(filteredTransactions);
            } else {
                setTransactions([]);
            }
        } catch (err) {
            setError('Error checking register status');
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const amount = parseFloat(initialAmount);
            if (isNaN(amount) || amount < 0) {
                setError(t('validation.invalidAmount'));
                return;
            }

            if (!user) {
                setError('User not authenticated');
                return;
            }

            const register: Omit<CashRegister, 'id'> = {
                status: 'open',
                openedAt: new Date(),
                initialAmount: amount,
                userId: user.id,
                deviceId: localStorage.getItem('deviceId') || 'unknown'
            };

            await cashRegisterOperations.create(register);
            setInitialAmount('');
            checkRegisterStatus();
        } catch (err) {
            setError('Error opening register');
        }
    };

    const handleCloseRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentRegister) return;

        try {
            const amount = parseFloat(finalAmount);
            if (isNaN(amount) || amount < 0) {
                setError(t('validation.invalidAmount'));
                return;
            }

            console.log('Cerrando caja...', currentRegister.id);

            // Actualizar estado de la caja
            await cashRegisterOperations.update(currentRegister.id, {
                status: 'closed',
                closedAt: new Date(),
                finalAmount: amount
            });

            console.log('Caja cerrada, generando reporte...');
            await generateReport();

            console.log('Limpiando estado...');
            setFinalAmount('');
            setTransactions([]);
            await checkRegisterStatus();

            console.log('Proceso completado');
        } catch (err) {
            console.error('Error al cerrar caja:', err);
            setError('Error closing register');
        }
    };

    const generateReport = async () => {
        if (!currentRegister || !user) return;

        const activeTransactions = transactions.filter(t => t.status === 'active');
        const totalSales = activeTransactions.reduce((sum, t) => sum + t.amount, 0);
        const totalDiscounts = activeTransactions.reduce((sum, t) => sum + t.discount, 0);
        const expectedAmount = currentRegister.initialAmount + totalSales;
        const difference = parseFloat(finalAmount) - expectedAmount;

        const rows = [
            ['Reporte de Caja'],
            ['Usuario', user.name],
            ['Fecha', new Date().toLocaleDateString()],
            ['Hora de Apertura', currentRegister.openedAt.toLocaleString()],
            ['Hora de Cierre', new Date().toLocaleString()],
            ['Monto Inicial', `$${currentRegister.initialAmount.toFixed(2)}`],
            ['Ventas Totales', `$${totalSales.toFixed(2)}`],
            ['Descuentos Totales', `$${totalDiscounts.toFixed(2)}`],
            ['Monto Final', `$${finalAmount}`],
            ['Monto Esperado', `$${expectedAmount.toFixed(2)}`],
            ['Diferencia', `$${difference.toFixed(2)}`],
            [''],
            ['Detalles de Transacciones'],
            ['Hora', 'Monto', 'Descuento', 'Forma de Pago', 'Cliente', 'Estado']
        ];

        transactions.forEach(t => {
            rows.push([
                `"${t.createdAt.toLocaleString()}"`,
                `$${t.amount.toFixed(2)}`,
                `$${t.discount.toFixed(2)}`,
                t.type,
                t.customerName || '-',
                t.status
            ]);
        });

        const csvContent = rows.map(row =>
            row.map(cell =>
                typeof cell === 'string' && cell.includes(',')
                    ? `"${cell}"`
                    : cell
            ).join(',')
        ).join('\n');

        const blob = new Blob(['\ufeff' + csvContent], {
            type: 'text/csv;charset=utf-8'
        });

        saveAs(blob, `register-report-${new Date().toISOString().split('T')[0]}.csv`);
    };

    const handleCancelTransaction = async (transactionId: number) => {
        try {
            await transactionOperations.cancelTransaction(transactionId);
            await checkRegisterStatus();
        } catch (err) {
            setError('Error cancelling transaction');
            console.error('Error:', err);
        }
    };

    if (isLoading) return <div>Loading...</div>;

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold">{t('register.title')}</h1>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-md">
                    {error}
                </div>
            )}

            {currentRegister ? (
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-lg shadow">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-lg font-medium">{t('register.currentSession')}</h2>
                                <p className="text-sm text-gray-500">
                                    {t('register.opened')}: {currentRegister.openedAt.toLocaleString()}
                                </p>
                            </div>
                            <div>
                                <button
                                    onClick={() => generateReport()}
                                    className="mr-4 text-blue-600 hover:text-blue-800"
                                >
                                    {t('register.downloadReport')}
                                </button>
                            </div>
                        </div>

                        <SalesSummary
                            transactions={transactions}
                            initialAmount={currentRegister.initialAmount}
                            currentRegister={currentRegister}
                            onCancelTransaction={handleCancelTransaction}
                        />

                        <form onSubmit={handleCloseRegister} className="mt-6">
                            <div className="max-w-xs">
                                <label className="block text-sm font-medium text-gray-700">
                                    {t('register.finalAmount')}
                                </label>
                                <input
                                    type="number"
                                    value={finalAmount}
                                    onChange={(e) => setFinalAmount(e.target.value)}
                                    step="0.01"
                                    min="0"
                                    required
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                />
                            </div>
                            <button
                                type="submit"
                                className="mt-4 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
                            >
                                {t('register.closeRegister')}
                            </button>
                        </form>
                    </div>
                </div>
            ) : (
                <form onSubmit={handleOpenRegister} className="bg-white p-6 rounded-lg shadow max-w-md">
                    <h2 className="text-lg font-medium mb-4">Open Register</h2>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            {t('register.initialAmount')}
                        </label>
                        <input
                            type="number"
                            value={initialAmount}
                            onChange={(e) => setInitialAmount(e.target.value)}
                            step="0.01"
                            min="0"
                            required
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                    </div>
                    <button
                        type="submit"
                        className="mt-4 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
                    >
                        {t('register.openRegister')}
                    </button>
                </form>
            )}
        </div>
    );
};

export default RegisterControl;