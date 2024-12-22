import React, { useState, useEffect } from 'react';
import { Product } from '../../types';
import ProductsGrid from '../pos/ProductsGrid';
import Cart from '../pos/Cart';
import { config } from '../../config';
import { PaymentMethod } from '../../types';
import CheckoutModal from '../pos/CheckoutModal';
import SearchBar from '../common/SearchBar';
import { accountOperations, initDatabase } from '../../lib/database';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';


interface PrepaidProductSelectorProps {
    accountId: number;
    onSuccess: () => void;
    onCancel: () => void;
}

const PrepaidProductSelector: React.FC<PrepaidProductSelectorProps> = ({ accountId, onSuccess, onCancel }) => {
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


    useEffect(() => {
        const loadProducts = async () => {
            try {
                setIsLoading(true);
                const db = await initDatabase();
                const tx = db.transaction('products', 'readonly');
                const products = await tx.store.getAll();

                // Filtrar solo productos activos
                setProducts(products.filter((p: Product) => p.isActive));
            } catch (error) {
                setError('Error loading products');
            } finally {
                setIsLoading(false);
            }
        };
        loadProducts();
    }, []);

    const handleCheckout = async (paymentMethod: PaymentMethod, customerName: string, discount: number) => {
        try {
            if (!user) {
                throw new Error('User not authenticated');
            }

            const products = cartItems.map(item => ({
                productId: item.product.id,
                quantity: item.quantity,
                price: item.product.price
            }));

            await accountOperations.addItems(accountId, products, user.id, 'PREPAID', 'credit');
            onSuccess();
        } catch (error) {
            setError(t('errors.addingProducts'));
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

                <div className="mb-4 flex gap-2">
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
                    onCheckout={() => setShowCheckoutModal(true)}
                    onClearCart={() => setCartItems([])}
                    discount={discount}
                    onDiscountChange={setDiscount}
                />

                {showCheckoutModal && (
                    <CheckoutModal
                        total={cartItems.reduce(
                            (sum, item) => sum + item.product.price * item.quantity,
                            0
                        )}
                        subtotal={cartItems.reduce(
                            (sum, item) => sum + item.product.price * item.quantity,
                            0
                        )}
                        discount={discount}
                        onComplete={handleCheckout}
                        onCancel={() => setShowCheckoutModal(false)}
                    />
                )}
            </div>
        </div>
    );
};

export default PrepaidProductSelector;