import React, { useState } from 'react';
import { PaymentMethod, Currency, Wallet } from '../../types';
import { useTranslation } from 'react-i18next';

interface CheckoutModalProps {
    total: number;
    discount: number;
    dollarRate: number;
    context?: 'pos' | 'account';
    onComplete: (data: {
        paymentMethod: Wallet;  // Cambiado de PaymentMethod a Wallet
        customerName: string;
        discount: number;
        currency: Currency;
    }) => void;
    onCancel: () => void;
}

const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'card', 'transfer'];

const CheckoutModal: React.FC<CheckoutModalProps> = ({
    total,
    discount,
    dollarRate,
    onComplete,
    onCancel,
    context = 'pos'
}) => {
    const [currency, setCurrency] = useState<Currency>("USD");
    const [wallet, setWallet] = useState<Wallet>("CASH_USD");
    const [customerName, setCustomerName] = useState('');
    const { t } = useTranslation();

    const totalInSelectedCurrency = currency === "USD" ? total : total * dollarRate;
    const discountInSelectedCurrency = currency === "USD" ? discount : discount * dollarRate;
    const [selectedOption, setSelectedOption] = useState<string>('CASH_USD');

    const getAvailableWallets = (selectedCurrency: Currency) => {
        const options = selectedCurrency === "USD"
            ? [
                { value: "CASH_USD", label: "Cash $" },
                { value: "TRANSFER_USD", label: "Transfer $" }
            ]
            : [
                { value: "CASH_BS", label: "Efectivo Bs." },
                { value: "CUENTA_BS_CARD", label: "Tarjeta Bs." },
                { value: "CUENTA_BS_TRANSFER", label: "Transferencia Bs." }
            ];

        return options;
    };

    const handleCurrencyChange = (newCurrency: Currency) => {
        setCurrency(newCurrency);
        // Resetear a la primera opción disponible para la moneda
        const firstOption = getAvailableWallets(newCurrency)[0].value;
        setSelectedOption(firstOption);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const wallet: Wallet = selectedOption.includes('CUENTA_BS') ? 'CUENTA_BS' : selectedOption as Wallet;
        onComplete({
            paymentMethod: wallet,
            customerName,
            discount,
            currency
        });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
                <h2 className="text-xl font-bold mb-4">{t('pos.completeSale')}</h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Currency Toggle */}
                    <div className="flex gap-4 mb-4">
                        <button
                            type="button"
                            onClick={() => handleCurrencyChange("USD")}
                            className={`flex-1 py-2 rounded-md ${currency === "USD"
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-700'
                                }`}
                        >
                            USD
                        </button>
                        <button
                            type="button"
                            onClick={() => handleCurrencyChange("BS")}
                            className={`flex-1 py-2 rounded-md ${currency === "BS"
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-700'
                                }`}
                        >
                            Bs.
                        </button>
                    </div>

                    {/* Amounts */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-lg">
                            <span>{t('common.subtotal')}:</span>
                            <span>
                                {currency === "USD" ? "$" : "Bs."}
                                {totalInSelectedCurrency.toFixed(2)}
                            </span>
                        </div>
                        {discount > 0 && (
                            <div className="flex justify-between text-red-600">
                                <span>{t('pos.discount')}:</span>
                                <span>
                                    -{currency === "USD" ? "$" : "Bs."}
                                    {discountInSelectedCurrency.toFixed(2)}
                                </span>
                            </div>
                        )}
                        <div className="flex justify-between font-bold text-xl">
                            <span>{t('common.total')}:</span>
                            <span>
                                {currency === "USD" ? "$" : "Bs."}
                                {(totalInSelectedCurrency - discountInSelectedCurrency).toFixed(2)}
                            </span>
                        </div>
                    </div>

                    {/* Payment Method */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            {t('pos.paymentMethod')}
                        </label>
                        <select
                            value={selectedOption}
                            onChange={(e) => setSelectedOption(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300"
                        >
                            {getAvailableWallets(currency).map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Customer Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            {context === 'account' ? t('accounts.paymentNote') : t('pos.customerName')}
                        </label>
                        <input
                            type="text"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300"
                        />
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-3 pt-4">
                        <button
                            type="submit"
                            className="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700"
                        >
                            {t('common.complete')}
                        </button>
                        <button
                            type="button"
                            onClick={onCancel}
                            className="flex-1 bg-gray-100 py-2 rounded hover:bg-gray-200"
                        >
                            {t('common.cancel')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CheckoutModal;