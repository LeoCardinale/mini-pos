// src/pages/register/RegisterControl.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Transaction, CashRegister, PaymentMethod } from '../../types';
import { cashRegisterOperations, transactionOperations } from '../../lib/database';
import SalesSummary from '../../components/register/SalesSummary';
import { saveAs } from 'file-saver';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { WalletAmounts } from '../../types';

interface RegisterFormData extends WalletAmounts {
    dollarRate: number;
}


const RegisterControl = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentRegister, setCurrentRegister] = useState<CashRegister | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [finalAmounts, setFinalAmounts] = useState<WalletAmounts>({
        cashUSD: 0,
        cashBs: 0,
        transferUSD: 0,
        cuentaBs: 0
    });
    const { user } = useAuth();
    const { t } = useTranslation();
    const [formData, setFormData] = useState<RegisterFormData>({
        cashUSD: 0,
        cashBs: 0,
        transferUSD: 0,
        cuentaBs: 0,
        dollarRate: 0
    });

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
            if (!user) {
                setError('User not authenticated');
                return;
            }

            const register: Omit<CashRegister, 'id'> = {
                status: 'open',
                openedAt: new Date(),
                initialCashUSD: formData.cashUSD,
                initialCashBs: formData.cashBs,
                initialTransferUSD: formData.transferUSD,
                initialCuentaBs: formData.cuentaBs,
                dollarRate: formData.dollarRate,
                userId: user.id,
                deviceId: localStorage.getItem('deviceId') || 'unknown'
            };

            await cashRegisterOperations.create(register);
            // Reiniciar formulario
            setFormData({
                cashUSD: 0,
                cashBs: 0,
                transferUSD: 0,
                cuentaBs: 0,
                dollarRate: 0
            });
            checkRegisterStatus();
        } catch (err) {
            setError('Error opening register');
        }
    };

    const handleCloseRegister = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!window.confirm('¿Está seguro que desea cerrar la caja? Esta acción no se puede deshacer.')) {
            return;
        }
        if (!currentRegister) return;

        try {
            // Validar que todos los montos sean válidos
            if (Object.values(finalAmounts).some(amount => amount < 0)) {
                setError('Please enter valid amounts');
                return;
            }

            await cashRegisterOperations.update(currentRegister.id, {
                status: 'closed',
                closedAt: new Date(),
                finalCashUSD: finalAmounts.cashUSD,
                finalCashBs: finalAmounts.cashBs,
                finalTransferUSD: finalAmounts.transferUSD,
                finalCuentaBs: finalAmounts.cuentaBs
            });

            console.log('Caja cerrada, generando reporte...');
            await generateReport();

            console.log('Limpiando estado...');
            setFinalAmounts({
                cashUSD: 0,
                cashBs: 0,
                transferUSD: 0,
                cuentaBs: 0
            });
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

        // Calcular totales por wallet
        const totalsByWallet = activeTransactions.reduce((acc, t) => ({
            cashUSD: acc.cashUSD + (t.wallet === 'CASH_USD' ? t.amount : 0),
            cashBs: acc.cashBs + (t.wallet === 'CASH_BS' ? t.amount : 0),
            transferUSD: acc.transferUSD + (t.wallet === 'TRANSFER_USD' ? t.amount : 0),
            cuentaBs: acc.cuentaBs + (t.wallet === 'CUENTA_BS' ? t.amount : 0)
        }), {
            cashUSD: 0,
            cashBs: 0,
            transferUSD: 0,
            cuentaBs: 0
        });

        const totalDiscounts = activeTransactions.reduce((sum, t) => sum + t.discount, 0);

        const rows = [
            ['Reporte de Caja'],
            ['Usuario', user.name],
            ['Fecha', new Date().toLocaleDateString()],
            ['Hora Apertura', currentRegister.openedAt.toLocaleString()],
            ['Hora Cierre', currentRegister.closedAt?.toLocaleString() || '-'],
            ['Tasa Dólar', currentRegister.dollarRate.toString()],
            [''],
            ['Montos Iniciales'],
            ['Efectivo USD', `$${currentRegister.initialCashUSD.toFixed(2)}`],
            ['Efectivo Bs', `Bs.${currentRegister.initialCashBs.toFixed(2)}`],
            ['Transferencia USD', `$${currentRegister.initialTransferUSD.toFixed(2)}`],
            ['Cuenta Bs', `Bs.${currentRegister.initialCuentaBs.toFixed(2)}`],
            [''],
            ['Montos Finales'],
            ['Efectivo USD', `$${currentRegister.finalCashUSD?.toFixed(2) || '-'}`],
            ['Efectivo Bs', `Bs.${currentRegister.finalCashBs?.toFixed(2) || '-'}`],
            ['Transferencia USD', `$${currentRegister.finalTransferUSD?.toFixed(2) || '-'}`],
            ['Cuenta Bs', `Bs.${currentRegister.finalCuentaBs?.toFixed(2) || '-'}`],
            [''],
            ['Ventas por Método de Pago'],
            ['Efectivo USD', `$${totalsByWallet.cashUSD.toFixed(2)}`],
            ['Efectivo Bs', `Bs.${totalsByWallet.cashBs.toFixed(2)}`],
            ['Transferencia USD', `$${totalsByWallet.transferUSD.toFixed(2)}`],
            ['Cuenta Bs', `Bs.${totalsByWallet.cuentaBs.toFixed(2)}`],
            ['Total Descuentos', `$${totalDiscounts.toFixed(2)}`],
            [''],
            ['Detalle de Transacciones'],
            ['Hora', 'Monto', 'Moneda', 'Método de Pago', 'Descuento', 'Cliente', 'Estado']
        ];

        // Agregar transacciones al reporte
        transactions.forEach(t => {
            rows.push([
                t.createdAt.toLocaleString(),
                t.amount.toFixed(2),
                t.currency,
                t.wallet,
                t.discount.toFixed(2),
                t.customerName || '-',
                t.status
            ]);
        });

        const csvContent = rows
            .map(row => row.map(cell => `"${cell}"`).join(','))
            .join('\n');

        const blob = new Blob(['\ufeff' + csvContent], {
            type: 'text/csv;charset=utf-8'
        });

        saveAs(blob, `reporte_caja_${new Date().toISOString().split('T')[0]}.csv`);
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


    const DollarRateInput: React.FC = () => {
        const [isEditing, setIsEditing] = useState(false);
        const [tempRate, setTempRate] = useState(currentRegister?.dollarRate || 0);
        const inputRef = useRef<HTMLInputElement>(null);

        useEffect(() => {
            if (isEditing && inputRef.current) {
                inputRef.current.focus();
            }
        }, [isEditing]);

        const handleUpdateRate = async () => {
            try {
                if (!currentRegister) return;
                await cashRegisterOperations.update(currentRegister.id, {
                    dollarRate: tempRate
                });
                setIsEditing(false);
                checkRegisterStatus();
            } catch (err) {
                setError('Error updating dollar rate');
            }
        };

        return (
            <div className="flex items-center gap-2 bg-white p-2 rounded-lg shadow">
                <label className="text-sm font-medium text-gray-700">
                    Tasa Dólar:
                </label>
                <input
                    ref={inputRef}
                    type="number"
                    value={tempRate}
                    onChange={(e) => setTempRate(parseFloat(e.target.value) || 0)}
                    disabled={!isEditing}
                    step="0.01"
                    min="0"
                    className="w-24 rounded-md border-gray-300"
                />
                <button
                    onClick={() => isEditing ? handleUpdateRate() : setIsEditing(true)}
                    className={`px-3 py-1 rounded-md ${isEditing
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                    type="button"
                >
                    {isEditing ? 'Aceptar' : 'Editar'}
                </button>
            </div>
        );
    };

    if (isLoading) return <div>Loading...</div>;

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Control de Caja</h1>
                {currentRegister && <DollarRateInput />}
            </div>

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
                            currentRegister={currentRegister}
                            onCancelTransaction={handleCancelTransaction}
                        />

                        <form onSubmit={handleCloseRegister} className="mt-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">
                                        Monto Final Cash USD
                                    </label>
                                    <input
                                        type="number"
                                        value={finalAmounts.cashUSD}
                                        onChange={(e) => setFinalAmounts(prev => ({
                                            ...prev,
                                            cashUSD: parseFloat(e.target.value) || 0
                                        }))}
                                        step="0.01"
                                        min="0"
                                        required
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">
                                        Monto Final Transfer USD
                                    </label>
                                    <input
                                        type="number"
                                        value={finalAmounts.transferUSD}
                                        onChange={(e) => setFinalAmounts(prev => ({
                                            ...prev,
                                            transferUSD: parseFloat(e.target.value) || 0
                                        }))}
                                        step="0.01"
                                        min="0"
                                        required
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">
                                        Monto Final Cash Bs
                                    </label>
                                    <input
                                        type="number"
                                        value={finalAmounts.cashBs}
                                        onChange={(e) => setFinalAmounts(prev => ({
                                            ...prev,
                                            cashBs: parseFloat(e.target.value) || 0
                                        }))}
                                        step="0.01"
                                        min="0"
                                        required
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">
                                        Monto Final Cuenta Bs
                                    </label>
                                    <input
                                        type="number"
                                        value={finalAmounts.cuentaBs}
                                        onChange={(e) => setFinalAmounts(prev => ({
                                            ...prev,
                                            cuentaBs: parseFloat(e.target.value) || 0
                                        }))}
                                        step="0.01"
                                        min="0"
                                        required
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                            <button
                                type="submit"
                                className="mt-4 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
                            >
                                Cerrar Caja
                            </button>
                        </form>
                    </div>
                </div>
            ) : (
                <form onSubmit={handleOpenRegister} className="bg-white p-6 rounded-lg shadow max-w-md">
                    <h2 className="text-lg font-medium mb-4">{t('register.openRegister')}</h2>

                    <div className="space-y-4">


                        {/* USD Wallets */}
                        <div className="border-t pt-4">
                            <h3 className="font-medium mb-2">Cuentas USD</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">
                                        Efectivo USD
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.cashUSD}
                                        onChange={(e) => setFormData(prev => ({
                                            ...prev,
                                            cashUSD: parseFloat(e.target.value) || 0
                                        }))}
                                        step="0.01"
                                        min="0"
                                        required
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">
                                        Cuenta Zelle USD
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.transferUSD}
                                        onChange={(e) => setFormData(prev => ({
                                            ...prev,
                                            transferUSD: parseFloat(e.target.value) || 0
                                        }))}
                                        step="0.01"
                                        min="0"
                                        required
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* BS Wallets */}
                        <div className="border-t pt-4">
                            <h3 className="font-medium mb-2">Cuentas Bs.</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">
                                        Efectivo Bs
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.cashBs}
                                        onChange={(e) => setFormData(prev => ({
                                            ...prev,
                                            cashBs: parseFloat(e.target.value) || 0
                                        }))}
                                        step="0.01"
                                        min="0"
                                        required
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">
                                        Cuenta Bancaria Bs
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.cuentaBs}
                                        onChange={(e) => setFormData(prev => ({
                                            ...prev,
                                            cuentaBs: parseFloat(e.target.value) || 0
                                        }))}
                                        step="0.01"
                                        min="0"
                                        required
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                        </div>
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