import React, { useState, useEffect } from 'react';
import { Product, Transaction, PaymentMethod } from '../../types';
import { productOperations, transactionOperations, cashRegisterOperations } from '../../lib/database';
import Cart from '../../components/pos/Cart';
import ProductsGrid from '../../components/pos/ProductsGrid';
import CheckoutModal from '../../components/pos/CheckoutModal';

interface CartItem {
    product: Product;
    quantity: number;
}

const CATEGORIES = ['Wines', 'Beers', 'Spirits', 'Food', 'Others'];

const POSPage = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [cartItems, setCartItems] = useState<CartItem[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showCheckout, setShowCheckout] = useState(false);

    useEffect(() => {
        loadProducts();
    }, []);

    const loadProducts = async () => {
        try {
            setIsLoading(true);
            const allProducts = await productOperations.getAll();
            setProducts(allProducts);
        } catch (err) {
            setError('Error loading products');
        } finally {
            setIsLoading(false);
        }
    };

    const handleProductSelect = (product: Product) => {
        setCartItems(prev => {
            const existing = prev.find(item => item.product.id === product.id);
            if (existing) {
                return prev.map(item =>
                    item.product.id === product.id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            }
            return [...prev, { product, quantity: 1 }];
        });
    };

    const handleUpdateQuantity = (productId: number, newQuantity: number) => {
        if (newQuantity <= 0) {
            handleRemoveItem(productId);
            return;
        }

        setCartItems(prev =>
            prev.map(item =>
                item.product.id === productId
                    ? { ...item, quantity: newQuantity }
                    : item
            )
        );
    };

    const handleRemoveItem = (productId: number) => {
        setCartItems(prev => prev.filter(item => item.product.id !== productId));
    };

    const handleCheckout = async (paymentMethod: PaymentMethod, customerName: string) => {
        try {
            const currentRegister = await cashRegisterOperations.getCurrent();
            if (!currentRegister) {
                alert('Please open the register first');
                return;
            }

            // Calcular el total
            const total = cartItems.reduce(
                (sum, item) => sum + item.product.price * item.quantity,
                0
            );

            // Crear transacción simplificada
            const transaction: Omit<Transaction, 'id'> = {
                amount: total,
                type: paymentMethod,
                createdAt: new Date()
            };

            // Guardar transacción
            await transactionOperations.create(transaction);

            // Actualizar stock
            for (const item of cartItems) {
                await productOperations.update(item.product.id, {
                    stock: item.product.stock - item.quantity
                });
            }

            // Resetear carrito y recargar productos
            setCartItems([]);
            loadProducts();
            setShowCheckout(false);

            alert('Sale completed successfully!');
        } catch (err) {
            setError('Error processing sale');
        }
    };

    if (isLoading) return <div>Loading...</div>;

    return (
        <div className="h-[calc(100vh-4rem)] flex gap-4">
            <div className="flex-1 flex flex-col overflow-hidden">
                <div className="mb-4 flex gap-2 overflow-x-auto py-2">
                    <button
                        onClick={() => setSelectedCategory(null)}
                        className={`px-4 py-2 rounded-lg whitespace-nowrap ${selectedCategory === null
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-800'
                            }`}
                    >
                        All
                    </button>
                    {CATEGORIES.map(category => (
                        <button
                            key={category}
                            onClick={() => setSelectedCategory(category)}
                            className={`px-4 py-2 rounded-lg whitespace-nowrap ${selectedCategory === category
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-800'
                                }`}
                        >
                            {category}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-auto pb-4">
                    <ProductsGrid
                        products={products}
                        onProductSelect={handleProductSelect}
                        selectedCategory={selectedCategory}
                    />
                </div>
            </div>

            <div className="w-96">
                <Cart
                    items={cartItems}
                    onUpdateQuantity={handleUpdateQuantity}
                    onRemoveItem={handleRemoveItem}
                    onCheckout={() => setShowCheckout(true)}
                    onClearCart={() => setCartItems([])}
                />
            </div>

            {showCheckout && (
                <CheckoutModal
                    total={cartItems.reduce(
                        (sum, item) => sum + item.product.price * item.quantity,
                        0
                    )}
                    onComplete={(paymentMethod, customerName) =>
                        handleCheckout(paymentMethod, customerName)
                    }
                    onCancel={() => setShowCheckout(false)}
                />
            )}

            {error && (
                <div className="fixed bottom-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                    {error}
                </div>
            )}
        </div>
    );
};

export default POSPage;