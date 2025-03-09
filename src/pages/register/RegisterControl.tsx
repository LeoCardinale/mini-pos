// src/pages/register/RegisterControl.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Transaction, CashRegister, PaymentMethod, Product } from '../../types';
import { cashRegisterOperations, transactionOperations, syncQueueOperations, productOperations, initDatabase } from '../../lib/database';
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
    const initRef = useRef(false);
    const [products, setProducts] = useState<Record<number, Product>>({});


    const checkRegisterStatus = async () => {
        try {
            setIsLoading(true);
            const registers = await cashRegisterOperations.getCurrent(user?.id);
            console.log('Current register:', registers);
            setCurrentRegister(registers || null);

            if (registers) {
                const registerTransactions = await transactionOperations.getAll();
                const filteredTransactions = registerTransactions.filter(transaction =>
                    transaction.userId === user?.id &&
                    transaction.createdAt >= registers.openedAt &&
                    (!registers.closedAt || transaction.createdAt <= registers.closedAt)
                );
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

    useEffect(() => {
        // Evitar doble ejecución
        if (initRef.current) return;
        initRef.current = true;

        const initialize = async () => {
            await checkRegisterStatus();

            try {
                // Cargar productos y convertirlos en un mapa para acceso rápido por ID
                const allProducts = await productOperations.getAll();
                const productsMap = allProducts.reduce((map: Record<number, Product>, product: Product) => {
                    map[product.id] = product;
                    return map;
                }, {} as Record<number, Product>);

                setProducts(productsMap);
            } catch (err) {
                console.error('Error loading products:', err);
            }
        };

        initialize();

        // Cleanup function
        return () => {
            initRef.current = false;
        };
    }, [user?.id]);

    const getTransactionWithItems = async (transactionId: number) => {
        try {
            const transaction = await transactionOperations.getById(transactionId);
            return transaction;
        } catch (error) {
            console.error(`Error getting items for transaction ${transactionId}:`, error);
            return null;
        }
    };

    const handleOpenRegister = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!window.confirm('¿Está seguro que desea abrir la caja con estos montos?')) {
            return;
        }

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
        if (!currentRegister || !user) return '';

        try {
            // Validar que todos los montos sean válidos
            if (Object.values(finalAmounts).some(amount => amount < 0)) {
                setError('Please enter valid amounts');
                return;
            }

            // Generar el contenido del reporte
            console.log('Caja cerrada, generando reporte...');
            const csvContent = await generateReportContent(); // Ahora es asíncrono

            // Encolar el reporte para sincronización
            await syncQueueOperations.addOperation({
                type: 'create',
                entity: 'report',
                data: JSON.stringify({
                    content: csvContent,
                    fileName: `register-report-${user.name}-${new Date().toISOString().split('T')[0]}.csv`,
                    type: 'register_report'
                }),
                deviceId: localStorage.getItem('deviceId') || 'unknown',
                status: 'pending'
            });

            await cashRegisterOperations.update(currentRegister.id, {
                status: 'closed',
                closedAt: new Date(),
                finalCashUSD: finalAmounts.cashUSD,
                finalCashBs: finalAmounts.cashBs,
                finalTransferUSD: finalAmounts.transferUSD,
                finalCuentaBs: finalAmounts.cuentaBs
            });

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

    const generateReportContent = async () => {
        if (!currentRegister || !user) return '';

        const activeTransactions = transactions.filter(t => t.status === 'active');

        // Cargar los items para todas las transacciones activas
        const transactionsWithItems = await Promise.all(
            activeTransactions.map(async (tx) => {
                // Si ya tiene items, lo usamos directamente
                if (tx.items && tx.items.length > 0) {
                    return tx;
                }
                // Si no tiene items, los cargamos
                const fullTx = await getTransactionWithItems(tx.id);
                return fullTx || tx;
            })
        );

        const db = await initDatabase();
        const accountTxStore = db.transaction('accountTransactions', 'readonly').objectStore('accountTransactions');
        let accumulatedTransactions = await accountTxStore.getAll();

        // Filtrar por período de la caja, usuario, tipo y estado
        accumulatedTransactions = accumulatedTransactions.filter(tx =>
            tx.userId === user.id &&
            tx.createdAt >= currentRegister.openedAt &&
            (!currentRegister.closedAt || tx.createdAt <= currentRegister.closedAt) &&
            tx.type === 'debit' &&  // Consumos (no pagos)
            tx.accountType === 'ACCUMULATED' &&
            (!tx.status || tx.status === 'active')  // No canceladas
        );

        console.log(`Encontradas ${accumulatedTransactions.length} transacciones de cuentas Accumulated`);

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

        // Calcular montos esperados
        const expectedAmounts = {
            cashUSD: currentRegister.initialCashUSD + totalsByWallet.cashUSD,
            cashBs: currentRegister.initialCashBs + totalsByWallet.cashBs,
            transferUSD: currentRegister.initialTransferUSD + totalsByWallet.transferUSD,
            cuentaBs: currentRegister.initialCuentaBs + totalsByWallet.cuentaBs
        };

        // Calcular diferencias
        const differences = {
            cashUSD: finalAmounts.cashUSD - expectedAmounts.cashUSD,
            cashBs: finalAmounts.cashBs - expectedAmounts.cashBs,
            transferUSD: finalAmounts.transferUSD - expectedAmounts.transferUSD,
            cuentaBs: finalAmounts.cuentaBs - expectedAmounts.cuentaBs
        };

        const totalDiscounts = activeTransactions.reduce((sum, t) => sum + t.discount, 0);

        const rows = [
            ['Reporte de Caja'],
            ['Usuario', user.name],
            ['Hora Apertura', currentRegister.openedAt.toLocaleString()],
            ['Hora Cierre', new Date().toLocaleString()],
            ['Tasa Dólar', currentRegister.dollarRate.toString()],
            [''],
            ['Montos Iniciales'],
            ['Efectivo USD', `$${currentRegister.initialCashUSD.toFixed(2)}`],
            ['Efectivo Bs', `${currentRegister.initialCashBs.toFixed(2)}`],
            ['Transferencia USD', `$${currentRegister.initialTransferUSD.toFixed(2)}`],
            ['Cuenta Bs', `${currentRegister.initialCuentaBs.toFixed(2)}`],
            [''],
            ['Montos Finales'],
            ['Efectivo USD', `$${finalAmounts.cashUSD.toFixed(2)}`],
            ['Efectivo Bs', `${finalAmounts.cashBs.toFixed(2)}`],
            ['Transferencia USD', `$${finalAmounts.transferUSD.toFixed(2)}`],
            ['Cuenta Bs', `${finalAmounts.cuentaBs.toFixed(2)}`],
            [''],
            ['Ventas por Método de Pago'],
            ['Efectivo USD', `$${totalsByWallet.cashUSD.toFixed(2)}`],
            ['Efectivo Bs', `${totalsByWallet.cashBs.toFixed(2)}`],
            ['Transferencia USD', `$${totalsByWallet.transferUSD.toFixed(2)}`],
            ['Cuenta Bs', `${totalsByWallet.cuentaBs.toFixed(2)}`],
            ['Total Descuentos', `$${totalDiscounts.toFixed(2)}`],
            [''],
            ['Diferencias en Cuentas'],
            ['Efectivo USD', `$${differences.cashUSD.toFixed(2)}`],
            ['Efectivo Bs', `${differences.cashBs.toFixed(2)}`],
            ['Transferencia USD', `$${differences.transferUSD.toFixed(2)}`],
            ['Cuenta Bs', `${differences.cuentaBs.toFixed(2)}`],
            [''],
            ['Detalle de Transacciones'],
            ['Hora', 'Monto', 'Moneda', 'Método de Pago', 'Descuento', 'Cliente', 'Estado']
        ];

        // Agregar transacciones
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

        // NUEVA SECCIÓN: Productos Vendidos
        rows.push(['']);
        rows.push(['Detalle de Productos Vendidos']);
        rows.push([
            'Descripción',
            'Costo Unitario',
            'PVP Unitario',
            'Ganancia Unitaria',
            'Cantidad',
            'Costo Total',
            'PVP Total',
            'Ganancia Total'
        ]);

        // Agrupar los productos vendidos de todas las transacciones activas
        const productSales: Record<number, {
            name: string;
            cost: number;
            price: number;
            quantity: number;
        }> = {};

        // 1. Procesar transacciones POS
        for (const transaction of transactionsWithItems) {
            // Verificamos que la transacción tenga items
            if (transaction.items && transaction.items.length > 0) {
                for (const item of transaction.items) {
                    const productId = item.productId;
                    // Obtenemos el producto desde nuestro mapa
                    const product = products[productId];

                    if (product) {
                        if (!productSales[productId]) {
                            productSales[productId] = {
                                name: product.name,
                                cost: product.cost || 0, // Usar valor predeterminado si no hay costo
                                price: item.price, // Usamos el precio en la transacción
                                quantity: item.quantity
                            };
                        } else {
                            // Sumamos la cantidad al producto existente
                            productSales[productId].quantity += item.quantity;
                        }
                    }
                }
            }
        }

        // 2. NUEVO: Procesar transacciones de cuentas Accumulated
        for (const transaction of accumulatedTransactions) {
            // Verificamos que la transacción tenga items
            if (transaction.items && transaction.items.length > 0) {
                for (const item of transaction.items) {
                    const productId = item.productId;
                    // Obtenemos el producto desde nuestro mapa
                    const product = products[productId];

                    if (product) {
                        if (!productSales[productId]) {
                            productSales[productId] = {
                                name: product.name,
                                cost: product.cost || 0,
                                price: item.price,
                                quantity: item.quantity
                            };
                        } else {
                            // Sumamos la cantidad al producto existente
                            productSales[productId].quantity += item.quantity;
                        }
                    }
                }
            }
        }

        // Si no hay productos en el reporte, agregamos una fila indicándolo
        if (Object.keys(productSales).length === 0) {
            rows.push(['No hay productos vendidos en este periodo', '', '', '', '', '', '', '']);
        } else {
            // Añadir cada producto vendido al reporte
            Object.values(productSales).forEach(product => {
                const costoUnitario = product.cost;
                const pvpUnitario = product.price;
                const gananciaUnitaria = pvpUnitario - costoUnitario;
                const cantidad = product.quantity;
                const costoTotal = costoUnitario * cantidad;
                const pvpTotal = pvpUnitario * cantidad;
                const gananciaTotal = pvpTotal - costoTotal;

                rows.push([
                    product.name,
                    `$${costoUnitario.toFixed(2)}`,
                    `$${pvpUnitario.toFixed(2)}`,
                    `$${gananciaUnitaria.toFixed(2)}`,
                    cantidad.toString(),
                    `$${costoTotal.toFixed(2)}`,
                    `$${pvpTotal.toFixed(2)}`,
                    `$${gananciaTotal.toFixed(2)}`
                ]);
            });

            // Añadir el resumen final de ganancias
            const totalCosto = Object.values(productSales).reduce((sum, product) =>
                sum + (product.cost * product.quantity), 0);
            const totalVenta = Object.values(productSales).reduce((sum, product) =>
                sum + (product.price * product.quantity), 0);
            const totalGanancia = totalVenta - totalCosto;

            rows.push(['']);
            rows.push(['Resumen de Ganancias']);
            rows.push(['Total Costo', `$${totalCosto.toFixed(2)}`]);
            rows.push(['Total Venta', `$${totalVenta.toFixed(2)}`]);
            rows.push(['Total Ganancia', `$${totalGanancia.toFixed(2)}`]);
            if (totalVenta > 0) {
                rows.push(['Margen de Ganancia', `${((totalGanancia / totalVenta) * 100).toFixed(2)}%`]);
            } else {
                rows.push(['Margen de Ganancia', '0%']);
            }
        }

        const csvContent = rows
            .map(row => row.map(cell => `"${cell}"`).join(','))
            .join('\n');

        const blob = new Blob(['\ufeff' + csvContent], {
            type: 'text/csv;charset=utf-8'
        });

        saveAs(blob, `register-report-${user.name}-${new Date().toISOString().split('T')[0]}.csv`);

        return csvContent
    };

    const generateReport = async () => {
        if (!currentRegister || !user) return;

        try {
            // Usar la misma función asíncrona para generar el reporte
            await generateReportContent();
        } catch (error) {
            console.error('Error generando reporte:', error);
            setError('Error generando reporte');
        }
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

                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                {t('register.dollarRate')}
                            </label>
                            <input
                                type="number"
                                value={formData.dollarRate}
                                onChange={(e) => setFormData(prev => ({
                                    ...prev,
                                    dollarRate: parseFloat(e.target.value) || 0
                                }))}
                                step="0.01"
                                min="0"
                                required
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            />
                        </div>
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