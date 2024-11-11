// src/pages/register/RegisterControl.tsx
import React, { useState, useEffect } from 'react';
import { Transaction, CashRegister, PaymentMethod } from '../../types';
import { cashRegisterOperations, transactionOperations } from '../../lib/database';
import SalesSummary from '../../components/register/SalesSummary';
import { saveAs } from 'file-saver';

const RegisterControl = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentRegister, setCurrentRegister] = useState<CashRegister | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [initialAmount, setInitialAmount] = useState('');
    const [finalAmount, setFinalAmount] = useState('');

    useEffect(() => {
        checkRegisterStatus();
    }, []);

    const checkRegisterStatus = async () => {
        try {
            setIsLoading(true);
            const register = await cashRegisterOperations.getCurrent();
            setCurrentRegister(register || null);

            if (register) {
                // Obtener transacciones del registro actual
                const registerTransactions = await transactionOperations.getAll();
                setTransactions(registerTransactions);
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
                setError('Please enter a valid amount');
                return;
            }

            const register: Omit<CashRegister, 'id'> = {
                status: 'open',
                openedAt: new Date(),
                initialAmount: amount
            };

            await cashRegisterOperations.create(register);
            setInitialAmount('');
            checkRegisterStatus();
        } catch (err) {
            setError('Error opening register');
        }
    };

    const generateReport = async () => {
        if (!currentRegister) return;

        const totalSales = transactions.reduce((sum, t) => sum + t.amount, 0);
        const expectedAmount = currentRegister.initialAmount + totalSales;
        const difference = parseFloat(finalAmount) - expectedAmount;

        const rows = [
            ['Register Report'],
            ['Date', new Date().toLocaleDateString()],
            ['Open Time', currentRegister.openedAt.toLocaleString()],
            ['Close Time', new Date().toLocaleString()],
            ['Initial Amount', `$${currentRegister.initialAmount.toFixed(2)}`],
            ['Final Amount', `$${finalAmount}`],
            ['Total Sales', `$${totalSales.toFixed(2)}`],
            ['Expected Amount', `$${expectedAmount.toFixed(2)}`],
            ['Difference', `$${difference.toFixed(2)}`],
            [''],
            ['Transaction Details'],
            ['Time', 'Amount', 'Payment Method', 'Customer']
        ];

        transactions.forEach(t => {
            rows.push([
                t.createdAt.toLocaleString(),
                `$${t.amount.toFixed(2)}`,
                t.type,
                t.customerName || '-'
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

    const handleCloseRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentRegister) return;

        try {
            const amount = parseFloat(finalAmount);
            if (isNaN(amount) || amount < 0) {
                setError('Please enter a valid amount');
                return;
            }

            await generateReport();
            await cashRegisterOperations.update(currentRegister.id, {
                status: 'closed',
                closedAt: new Date(),
                finalAmount: amount
            });
            setFinalAmount('');
            setTransactions([]);
            checkRegisterStatus();
        } catch (err) {
            setError('Error closing register');
        }
    };

    if (isLoading) return <div>Loading...</div>;

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold">Register Control</h1>

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
                                <h2 className="text-lg font-medium">Current Register Session</h2>
                                <p className="text-sm text-gray-500">
                                    Opened: {currentRegister.openedAt.toLocaleString()}
                                </p>
                            </div>
                            <div>
                                <button
                                    onClick={() => generateReport()}
                                    className="mr-4 text-blue-600 hover:text-blue-800"
                                >
                                    Download Report
                                </button>
                            </div>
                        </div>

                        <SalesSummary
                            transactions={transactions}
                            initialAmount={currentRegister.initialAmount}
                        />

                        <form onSubmit={handleCloseRegister} className="mt-6">
                            <div className="max-w-xs">
                                <label className="block text-sm font-medium text-gray-700">
                                    Final Amount in Register
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
                                Close Register
                            </button>
                        </form>
                    </div>
                </div>
            ) : (
                <form onSubmit={handleOpenRegister} className="bg-white p-6 rounded-lg shadow max-w-md">
                    <h2 className="text-lg font-medium mb-4">Open Register</h2>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            Initial Amount in Register
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
                        Open Register
                    </button>
                </form>
            )}
        </div>
    );
};

export default RegisterControl;