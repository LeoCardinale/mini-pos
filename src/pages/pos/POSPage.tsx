import React, { useState, useEffect } from 'react';
import { Product, Transaction, PaymentMethod } from '../../types';
import {
    productOperations,
    transactionOperations,
    cashRegisterOperations,
    syncQueueOperations
} from '../../lib/database';
import Cart from '../../components/pos/Cart';
import ProductsGrid from '../../components/pos/ProductsGrid';
import CheckoutModal from '../../components/pos/CheckoutModal';
import SearchBar from '../../components/common/SearchBar';
import { useAuth } from '../../context/AuthContext';

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
    const [searchTerm, setSearchTerm] = useState('');
    const [discount, setDiscount] = useState(0);
    const { user } = useAuth();


    useEffect(() => {
        loadProducts();
    }, []);

    const loadProducts = async () => {
        try {
            setIsLoading(true);
            const allProducts = await productOperations.getAll();
            setProducts(allProducts.filter((p: Product) => p.isActive));
        } catch (err) {
            setError('Error loading products');
        } finally {
            setIsLoading(false);
        }
    };

    const filteredProducts = products.filter(product => {
        const searchLower = searchTerm.toLowerCase();
        return product.name.toLowerCase().includes(searchLower) ||
            (product.barcode && product.barcode.toLowerCase().includes(searchLower));
    });

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

    const handleCheckout = async (paymentMethod: PaymentMethod, customerName: string, discount: number) => {
        try {
            console.log('User at checkout:', user);
            const currentRegister = await cashRegisterOperations.getCurrent(user!.id);
            console.log('Current register at checkout:', currentRegister);

            if (!currentRegister) {
                console.log('No register found for user:', user?.id);
                alert('Please open the register first');
                return;
            }

            // Calcular total con descuento
            const subtotal = cartItems.reduce(
                (sum, item) => sum + item.product.price * item.quantity,
                0
            );
            const total = Math.max(0, subtotal - discount);

            // Crear transacción
            if (!user) {
                throw new Error('User not authenticated');
            }
            const transaction: Omit<Transaction, 'id'> = {
                amount: total,
                discount: discount,
                type: paymentMethod,
                createdAt: new Date(),
                userId: user.id,
                deviceId: localStorage.getItem('deviceId') || 'unknown',
                customerName: customerName || undefined,
                status: 'active',
                items: cartItems.map(item => ({
                    id: 0,
                    transactionId: 0,
                    productId: item.product.id,
                    quantity: item.quantity,
                    price: item.product.price
                }))
            };

            const transactionId = await transactionOperations.create(transaction);

            // Actualizar stock
            for (const item of cartItems) {
                await productOperations.update(item.product.id, {
                    stock: item.product.stock - item.quantity
                });
            }

            for (const item of cartItems) {
                const saleRecord = {
                    productId: item.product.id,
                    quantity: item.quantity,
                    price: item.product.price,
                    total: item.quantity * item.product.price,
                    source: 'POS',
                    sourceId: transactionId.toString(),
                    userId: user.id,
                    createdAt: new Date()
                };

                // Encolar operación de sincronización
                await syncQueueOperations.addOperation({
                    type: 'create',
                    entity: 'salesRecord',
                    data: JSON.stringify(saleRecord),
                    deviceId: localStorage.getItem('deviceId') || 'unknown',
                    status: 'pending'
                });
            }

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
                <div className="mb-4 flex gap-2">
                    <div className="flex-1">
                        <SearchBar
                            value={searchTerm}
                            onChange={setSearchTerm}
                            placeholder="Search by name or barcode..."
                        />
                    </div>
                    <div className="flex space-x-2 overflow-x-auto py-2">
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
                </div>

                <div className="flex-1 overflow-auto pb-4">
                    <ProductsGrid
                        products={filteredProducts}
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
                    discount={discount}
                    onDiscountChange={setDiscount}
                />
            </div>

            {showCheckout && (
                <CheckoutModal
                    subtotal={cartItems.reduce(
                        (sum, item) => sum + item.product.price * item.quantity,
                        0
                    )}
                    total={Math.max(0, cartItems.reduce(
                        (sum, item) => sum + item.product.price * item.quantity,
                        0
                    ) - discount)}
                    discount={discount}
                    onComplete={handleCheckout}
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