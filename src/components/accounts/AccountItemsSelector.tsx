import React, { useState, useEffect } from 'react';
import { Product } from '../../types';
import ProductsGrid from '../pos/ProductsGrid';
import SearchBar from '../common/SearchBar';
import { config } from '../../config';
import { initDatabase } from '../../lib/database';
import { t } from 'i18next';


interface CartItem {
    product: Product;
    quantity: number;
}

interface AccountItemsSelectorProps {
    accountId: number;
    onConfirm: (items: Array<{ productId: number; quantity: number; price: number }>) => Promise<void>;
    onCancel: () => void;
}

const AccountItemsSelector: React.FC<AccountItemsSelectorProps> = ({ accountId, onConfirm, onCancel }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [cartItems, setCartItems] = useState<CartItem[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [products, setProducts] = useState<Product[]>([]);

    useEffect(() => {
        const loadProducts = async () => {
            try {
                const db = await initDatabase();
                const tx = db.transaction('products', 'readonly');
                const products = await tx.store.getAll();

                // Filtrar solo productos activos
                setProducts(products.filter((p: Product) => p.isActive));
            } catch (error) {
                console.error('Error loading products:', error);
            }
        };
        loadProducts();
    }, []);

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
            setCartItems(prev => prev.filter(item => item.product.id !== productId));
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

    const handleConfirm = async () => {
        console.log('Starting handleConfirm');
        if (cartItems.length === 0) {
            setError('Please add at least one item');
            return;
        }

        try {
            const items = cartItems.map(item => ({
                productId: item.product.id,
                quantity: item.quantity,
                price: item.product.price
            }));

            await onConfirm(items);

        } catch (error) {
            setError('Error adding accumulated items');
            console.error('Error adding accumulated items:', error);
        }
    };

    return (
        <div className="h-full flex gap-4">
            <div className="flex-1 flex flex-col overflow-hidden">
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
                        className={`px-4 py-2 rounded-lg whitespace-nowrap ${selectedCategory === null
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
                            className={`px-4 py-2 rounded-lg whitespace-nowrap ${selectedCategory === category
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-800'
                                }`}
                        >
                            {category}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-auto">
                    <ProductsGrid
                        products={products.filter(product => {
                            const searchLower = searchTerm.toLowerCase();
                            return product.name.toLowerCase().includes(searchLower) ||
                                (product.barcode && product.barcode.toLowerCase().includes(searchLower));
                        })}
                        onProductSelect={handleProductSelect}
                        selectedCategory={selectedCategory}
                    />
                </div>
            </div>

            <div className="w-96 bg-white rounded-lg shadow p-4">
                <h3 className="font-medium mb-4">{t('accounts.selectedItems')}</h3>
                <div className="flex-1 overflow-auto mb-4">
                    {cartItems.map(item => (
                        <div key={item.product.id} className="mb-2 p-2 border rounded">
                            <div className="flex justify-between">
                                <span>{item.product.name}</span>
                                <span>${item.product.price}</span>
                            </div>
                            <div className="flex items-center mt-2">
                                <button
                                    onClick={() => handleUpdateQuantity(item.product.id, item.quantity - 1)}
                                    className="w-8 h-8 flex items-center justify-center rounded-full border"
                                >
                                    -
                                </button>
                                <input
                                    type="number"
                                    value={item.quantity}
                                    onChange={(e) => {
                                        const value = parseInt(e.target.value) || 0;
                                        if (value >= 0) {
                                            handleUpdateQuantity(item.product.id, value);
                                        }
                                    }}
                                    className="mx-4 w-16 text-center border rounded-md"
                                    min="0"
                                />
                                <button
                                    onClick={() => handleUpdateQuantity(item.product.id, item.quantity + 1)}
                                    className="w-8 h-8 flex items-center justify-center rounded-full border"
                                >
                                    +
                                </button>

                                <button
                                    onClick={() => handleUpdateQuantity(item.product.id, 0)}
                                    className="ml-4 text-red-600 hover:text-red-800 text-xl font-bold"
                                >
                                    ×
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {error && (
                    <div className="text-red-600 mb-4">{error}</div>
                )}

                <div className="mt-auto border-t pt-4 space-y-2">
                    <div className="flex justify-between text-lg font-bold">
                        <span>Total:</span>
                        <span>${(cartItems.reduce(
                            (sum, item) => sum + item.product.price * item.quantity,
                            0
                        )).toFixed(2)}</span>
                    </div>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={handleConfirm}
                        className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
                    >
                        {t('common.confirm')}
                    </button>
                    <button
                        onClick={onCancel}
                        className="flex-1 bg-gray-100 py-2 rounded hover:bg-gray-200"
                    >
                        {t('common.cancel')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AccountItemsSelector;