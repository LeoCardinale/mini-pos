import React, { useState, useEffect } from 'react';
import { Currency, Wallet } from '../../types';
import { useTranslation } from 'react-i18next';

interface CheckoutModalProps {
    total: number;
    discount?: number;
    dollarRate: number;
    onComplete: (data: {
        paymentMethod: Wallet;
        customerName: string;
        discount: number;
        currency: Currency;
        paymentAmount?: number; // Monto opcional en caso de pagos parciales
        paymentNote?: string;   // Nota de pago opcional
    }) => Promise<void>;
    onCancel: () => void;
    context?: 'pos' | 'account'; // Para saber si viene de POS o de cuentas
    allowPartialPayment?: boolean; // Nuevo prop para permitir pagos parciales
}
const CheckoutModal: React.FC<CheckoutModalProps> = ({
    total,
    discount = 0,
    dollarRate,
    onComplete,
    onCancel,
    context = 'pos',
    allowPartialPayment = false
}) => {
    const [paymentMethod, setPaymentMethod] = useState<Wallet>('CASH_USD');
    const [customerName, setCustomerName] = useState('');
    const [currency, setCurrency] = useState<Currency>('USD');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [paymentAmount, setPaymentAmount] = useState<number>(total);
    const { t } = useTranslation();
    const [paymentNote, setPaymentNote] = useState('');

    // Actualizar el monto cuando cambia el total
    useEffect(() => {
        setPaymentAmount(total);
    }, [total]);

    // Función para obtener las billeteras disponibles según la moneda seleccionada
    const getAvailableWallets = (): Wallet[] => {
        if (currency === 'USD') {
            return ['CASH_USD', 'TRANSFER_USD'];
        } else {
            return ['CASH_BS', 'CUENTA_BS'];
        }
    };

    // Cada vez que cambia la moneda, actualizar el método de pago
    useEffect(() => {
        const wallets = getAvailableWallets();
        // Seleccionar la primera billetera disponible por defecto
        setPaymentMethod(wallets[0]);
    }, [currency]);

    const handleCurrencyChange = (newCurrency: Currency) => {
        setCurrency(newCurrency);
    };

    const handleComplete = async () => {
        try {
            setError(null);
            setIsProcessing(true);

            // Validar que el monto sea válido (solo para pagos parciales)
            if (allowPartialPayment) {
                if (paymentAmount <= 0) {
                    setError(t('accounts.amountMustBeGreaterThanZero', 'El monto debe ser mayor que cero'));
                    setIsProcessing(false);
                    return;
                }

                if (paymentAmount > total) {
                    setError(t('accounts.amountCannotExceedBalance', 'El monto no puede ser mayor al balance pendiente'));
                    setIsProcessing(false);
                    return;
                }
            }

            await onComplete({
                paymentMethod,
                customerName,
                discount,
                currency,
                paymentAmount: allowPartialPayment ? paymentAmount : undefined,
                paymentNote
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error procesando el pago');
        } finally {
            setIsProcessing(false);
        }
    };

    // Calcular el monto a mostrar según la moneda
    const displayTotal = currency === 'USD' ? paymentAmount : paymentAmount * dollarRate;

    return (
        <div className="fixed inset-0 bg-gray-700 bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
                <h2 className="text-xl font-bold mb-4">
                    {context === 'account' ? t('accounts.makePayment') : t('pos.checkout')}
                </h2>

                {allowPartialPayment && (
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('accounts.paymentAmount', 'Monto a pagar')}
                        </label>
                        <input
                            type="number"
                            value={paymentAmount}
                            onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                            className="w-full p-2 border rounded"
                            min="0.01"
                            max={total}
                            step="0.01"
                        />
                    </div>
                )}

                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('common.total')}
                    </label>
                    <div className="text-2xl font-bold">
                        {currency === 'USD' ? '$' : 'Bs. '}{displayTotal.toFixed(2)}
                    </div>
                </div>

                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('common.currency')}
                    </label>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => handleCurrencyChange('USD')}
                            className={`px-4 py-2 rounded ${currency === 'USD'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 text-gray-800'
                                }`}
                        >
                            USD
                        </button>
                        <button
                            type="button"
                            onClick={() => handleCurrencyChange('BS')}
                            className={`px-4 py-2 rounded ${currency === 'BS'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 text-gray-800'
                                }`}
                        >
                            Bs
                        </button>
                    </div>
                </div>

                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('common.paymentMethod')}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        {getAvailableWallets().map(wallet => (
                            <button
                                key={wallet}
                                type="button"
                                onClick={() => setPaymentMethod(wallet)}
                                className={`px-4 py-2 rounded ${paymentMethod === wallet
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-200 text-gray-800'
                                    }`}
                            >
                                {wallet === 'CASH_USD' && 'Cash $'}
                                {wallet === 'CASH_BS' && 'Cash Bs'}
                                {wallet === 'TRANSFER_USD' && 'Zelle $'}
                                {wallet === 'CUENTA_BS' && 'Cuenta Bs'}
                            </button>
                        ))}
                    </div>
                </div>

                {allowPartialPayment && (
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('common.paymentNote', 'Nota de pago')} ({t('common.optional')})
                        </label>
                        <input
                            type="text"
                            value={paymentNote}
                            onChange={(e) => setPaymentNote(e.target.value)}
                            className="w-full p-2 border rounded"
                            placeholder={t('accounts.paymentNotePlaceholder', 'Añadir una nota al pago...')}
                        />
                    </div>
                )}

                {context === 'pos' && (
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('common.customerName')} ({t('common.optional')})
                        </label>
                        <input
                            type="text"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            className="w-full p-2 border rounded"
                            placeholder={t('pos.customerNamePlaceholder')}
                        />
                    </div>
                )}

                {error && (
                    <div className="mb-4 text-red-600 text-sm">
                        {error}
                    </div>
                )}

                <div className="flex justify-end space-x-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
                        disabled={isProcessing}
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        type="button"
                        onClick={handleComplete}
                        className="px-4 py-2 text-white bg-green-600 rounded hover:bg-green-700"
                        disabled={isProcessing}
                    >
                        {isProcessing ? 'Procesando...' : t('common.complete')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CheckoutModal;