// src/components/pos/Cart.tsx
import React from 'react';
import { Product } from '../../types';

interface CartItem {
    product: Product;
    quantity: number;
}

interface CartProps {
    items: CartItem[];
    onUpdateQuantity: (productId: number, quantity: number) => void;
    onRemoveItem: (productId: number) => void;
    onCheckout: () => void;
    onClearCart: () => void;
}

const Cart: React.FC<CartProps> = ({
    items,
    onUpdateQuantity,
    onRemoveItem,
    onCheckout,
    onClearCart
}) => {
    const total = items.reduce(
        (sum, item) => sum + item.product.price * item.quantity,
        0
    );

    if (items.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-4 text-gray-500">
                <p>Cart is empty</p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-white rounded-lg shadow">
            <div className="p-4 border-b">
                <div className="flex justify-between items-center">
                    <h2 className="text-lg font-semibold">Current Order</h2>
                    <button
                        onClick={onClearCart}
                        className="text-red-600 hover:text-red-800 text-sm"
                    >
                        Clear Cart
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-auto">
                {items.map((item) => (
                    <div
                        key={item.product.id}
                        className="p-4 border-b flex justify-between items-center"
                    >
                        <div className="flex-1">
                            <h3 className="font-medium">{item.product.name}</h3>
                            <p className="text-sm text-gray-500">
                                ${item.product.price.toFixed(2)} each
                            </p>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1)}
                                className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-300 hover:bg-gray-100"
                            >
                                -
                            </button>
                            <span className="w-8 text-center">{item.quantity}</span>
                            <button
                                onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
                                className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-300 hover:bg-gray-100"
                            >
                                +
                            </button>
                            <button
                                onClick={() => onRemoveItem(item.product.id)}
                                className="ml-2 text-red-600 hover:text-red-800"
                            >
                                ×
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="p-4 border-t mt-auto bg-gray-50">
                <div className="mb-4">
                    <div className="flex justify-between mb-2">
                        <span className="font-medium">Subtotal:</span>
                        <span>${total.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold">
                        <span>Total:</span>
                        <span>${total.toFixed(2)}</span>
                    </div>
                </div>

                <button
                    onClick={onCheckout}
                    className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                >
                    Complete Sale (${total.toFixed(2)})
                </button>
            </div>
        </div>
    );
};

export default Cart;