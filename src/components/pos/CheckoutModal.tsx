// src/components/pos/CheckoutModal.tsx
import React, { useState } from 'react';
import { PaymentMethod } from '../../types';

interface CheckoutModalProps {
    total: number;
    discount: number;
    onComplete: (paymentMethod: PaymentMethod, customerName: string, discount: number) => void;
    onCancel: () => void;
}

const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'card', 'transfer'];

const CheckoutModal: React.FC<CheckoutModalProps> = ({
    total,
    discount,
    onComplete,
    onCancel
}) => {
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
    const [customerName, setCustomerName] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onComplete(paymentMethod, customerName, discount);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
                <h2 className="text-xl font-bold mb-4">Complete Sale</h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Amount Details
                        </label>
                        <div className="text-3xl font-bold space-y-2">
                            <div className="text-lg text-gray-600">
                                Subtotal: ${(total + discount).toFixed(2)}
                            </div>
                            {discount > 0 && (
                                <div className="text-lg text-red-600">
                                    Discount: -${discount.toFixed(2)}
                                </div>
                            )}
                            <div className="text-green-600">
                                Total: ${total.toFixed(2)}
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Total Amount
                        </label>
                        <div className="text-3xl font-bold text-green-600">
                            ${total.toFixed(2)}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Payment Method
                        </label>
                        <div className="space-y-2">
                            {PAYMENT_METHODS.map((method) => (
                                <label key={method} className="flex items-center">
                                    <input
                                        type="radio"
                                        name="paymentMethod"
                                        value={method}
                                        checked={paymentMethod === method}
                                        onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                                        className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300"
                                    />
                                    <span className="ml-2 capitalize">{method}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Customer Name (optional)
                        </label>
                        <input
                            type="text"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="submit"
                            //onClick={() => onComplete(paymentMethod, customerName, discount)}
                            className="flex-1 bg-green-600 text-white py-2 rounded-md hover:bg-green-700"
                        >
                            Complete
                        </button>
                        <button
                            type="button"
                            onClick={onCancel}
                            className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-200"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CheckoutModal;