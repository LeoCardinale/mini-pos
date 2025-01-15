import React, { useState, useEffect, useRef } from 'react';
import ProductsGrid from '../pos/ProductsGrid';
import Cart from '../pos/Cart';
import { Product, Wallet, Currency, CashRegister, Transaction, Account } from '../../types';
import CheckoutModal from '../pos/CheckoutModal';
import SearchBar from '../common/SearchBar';
import { accountOperations, productOperations, cashRegisterOperations, transactionOperations } from '../../lib/database';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';


interface PrepaidProductSelectorProps {
    account: Account;
    onSuccess: () => void;
    onCancel: () => void;
}

const PrepaidProductSelector: React.FC<PrepaidProductSelectorProps> = ({ account, onSuccess, onCancel }) => {
    const [products, setProducts] = useState<Product[]>([]);
    const [cartItems, setCartItems] = useState<Array<{ product: Product; quantity: number }>>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [discount, setDiscount] = useState(0);

    const [showCheckoutModal, setShowCheckoutModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const { user } = useAuth();
    const { t } = useTranslation();
    const [currentRegister, setCurrentRegister] = useState<CashRegister | null>(null);

    useEffect(() => {
        loadProducts();
        checkCurrentRegister();
    }, []);

    const loadProducts = async () => {
        try {
            setIsLoading(true);
            const allProducts = await productOperations.getAll();
            setProducts(allProducts.filter((p: Product) => p.isActive));
        } catch (error) {
            setError(t('errors.products'));
            console.error('Error loading products:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCheckout = async (data: {
        paymentMethod: Wallet;
        customerName: string;
        discount: number;
        currency: Currency;
    }) => {
        try {
            console.log('User at checkout:', user);
            const currentRegister = await cashRegisterOperations.getCurrent(user!.id);
            console.log('Current register at checkout:', currentRegister);

            if (!currentRegister) {
                console.log('No register found for user:', user?.id);
                alert("Debe abrir caja para esta operación");
                return;
            }

            // Calcular total con descuento
            const subtotal = cartItems.reduce(
                (sum, item) => sum + item.product.price * item.quantity,
                0
            );
            const total = Math.max(0, subtotal - data.discount);

            // Si el pago es en Bs, convertir el monto
            const amount = data.currency === 'BS' ? total * currentRegister.dollarRate : total;

            if (!user) {
                throw new Error('User not authenticated');
            }

            // Crear la transacción POS
            const transaction: Omit<Transaction, 'id'> = {
                amount,
                discount: data.discount,
                type: data.paymentMethod,
                currency: data.currency,
                wallet: data.paymentMethod,
                createdAt: new Date(),
                userId: user.id,
                deviceId: localStorage.getItem('deviceId') || 'unknown',
                customerName: `Prepaid: ${account.customerName}`,
                status: 'active',
                items: cartItems.map(item => ({
                    id: 0,
                    transactionId: 0,
                    productId: item.product.id,
                    quantity: item.quantity,
                    price: item.product.price
                }))
            };

            await transactionOperations.create(transaction);

            // Crear transacción de cuenta Prepaid
            const products = cartItems.map(item => ({
                productId: item.product.id,
                quantity: item.quantity,
                price: item.product.price
            }));

            await accountOperations.addItems(
                account.id,
                products,
                user.id,
                'PREPAID',
                'credit',
                {
                    amount,
                    method: data.paymentMethod,
                    discount: data.discount,
                    currency: data.currency
                }
            );

            onSuccess();
        } catch (error) {
            setError('Error adding products to account');
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

    const checkCurrentRegister = async () => {
        try {
            if (!user) return;
            const register = await cashRegisterOperations.getCurrent(user.id);
            setCurrentRegister(register);
        } catch (err) {
            setError('Error checking register status');
        }
    };

    if (isLoading) return <div>{t('common.loading')}</div>;
    if (error) return <div className="text-red-600">{error}</div>;

    return (
        <div className="h-[calc(100vh-4rem)] flex gap-4">

            <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex justify-between items-center mb-4">
                    <button
                        onClick={onCancel}
                        className="text-gray-600 hover:text-gray-800 flex items-center gap-2"
                    >
                        <span>←</span> {t('common.back')}
                    </button>
                </div>
                <div className="mb-4">
                    <SearchBar
                        value={searchTerm}
                        onChange={setSearchTerm}
                        placeholder={t('inventory.searchPlaceholder')}
                    />
                </div>

                <div className="mb-4 flex gap-2 overflow-x-auto">
                    <button
                        onClick={() => setSelectedCategory(null)}
                        className={`px-4 py-2 rounded-lg ${selectedCategory === null
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-800'
                            }`}
                    >
                        {t('common.all')}
                    </button>
                    {[t('inventory.catBeers'), t('inventory.catFood'), t('inventory.catSpirits'), t('inventory.catWines'), t('inventory.catOthers')].map(category => (
                        <button
                            key={category}
                            onClick={() => setSelectedCategory(category)}
                            className={`px-4 py-2 rounded-lg ${selectedCategory === category
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-800'
                                }`}
                        >
                            {category}
                        </button>
                    ))}
                </div>
                <div className="flex-1 overflow-y-auto">
                    <ProductsGrid
                        products={products.filter(product => {
                            const searchLower = searchTerm.toLowerCase();
                            const matchesSearch = product.name.toLowerCase().includes(searchLower) ||
                                (product.barcode && product.barcode.toLowerCase().includes(searchLower));
                            const matchesCategory = selectedCategory ? product.category === selectedCategory : true;
                            return matchesSearch && matchesCategory;
                        })}
                        onProductSelect={handleProductSelect}
                        selectedCategory={selectedCategory}
                    />
                </div>
            </div>
            <div className="w-96">
                <Cart
                    items={cartItems}
                    onUpdateQuantity={(productId, quantity) => {
                        if (quantity <= 0) {
                            setCartItems(prev => prev.filter(item => item.product.id !== productId));
                            return;
                        }
                        setCartItems(prev =>
                            prev.map(item =>
                                item.product.id === productId
                                    ? { ...item, quantity }
                                    : item
                            )
                        );
                    }}
                    onRemoveItem={(productId) => {
                        setCartItems(prev => prev.filter(item => item.product.id !== productId));
                    }}
                    onCheckout={() => {
                        if (!currentRegister) {
                            alert("Debe abrir caja para esta operación");
                            return;
                        }
                        setShowCheckoutModal(true);
                    }}
                    onClearCart={() => setCartItems([])}
                    discount={discount}
                    onDiscountChange={setDiscount}
                />

                {showCheckoutModal && currentRegister && (
                    <CheckoutModal
                        total={cartItems.reduce(
                            (sum, item) => sum + item.product.price * item.quantity,
                            0
                        )}
                        discount={discount}
                        dollarRate={currentRegister.dollarRate}
                        onComplete={handleCheckout}
                        onCancel={() => setShowCheckoutModal(false)}
                        context="account"
                    />
                )}
            </div>
        </div>
    );
};

export default PrepaidProductSelector;