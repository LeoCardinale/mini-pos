import React, { useState, useEffect } from 'react';
import { Product } from '../../types';
import ProductsGrid from '../pos/ProductsGrid';
import SearchBar from '../common/SearchBar';
import { config } from '../../config';

interface CartItem {
    product: Product;
    quantity: number;
}

interface AccountItemsSelectorProps {
    onConfirm: (items: Array<{ productId: number; quantity: number; price: number }>) => Promise<void>;
    onCancel: () => void;
}

const AccountItemsSelector: React.FC<AccountItemsSelectorProps> = ({ onConfirm, onCancel }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [cartItems, setCartItems] = useState<CartItem[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [products, setProducts] = useState<Product[]>([]);

    useEffect(() => {
        const loadProducts = async () => {
            try {
                const response = await fetch(`${config.apiUrl}/products`, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });
                if (response.ok) {
                    const data = await response.json();
                    setProducts(data.filter((p: Product) => p.isActive));
                }
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
        if (cartItems.length === 0) {
            setError('Please add at least one item');
            return;
        }

        const items = cartItems.map(item => ({
            productId: item.product.id,
            quantity: item.quantity,
            price: item.product.price
        }));

        await onConfirm(items);
    };

    return (
        <div className="h-full flex gap-4">
            <div className="flex-1 flex flex-col overflow-hidden">
                <div className="mb-4">
                    <SearchBar
                        value={searchTerm}
                        onChange={setSearchTerm}
                        placeholder="Search products..."
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
                        All
                    </button>
                    {['Wines', 'Beers', 'Spirits', 'Food', 'Others'].map(category => (
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
                <h3 className="font-medium mb-4">Selected Items</h3>
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
                                <span className="mx-4">{item.quantity}</span>
                                <button
                                    onClick={() => handleUpdateQuantity(item.product.id, item.quantity + 1)}
                                    className="w-8 h-8 flex items-center justify-center rounded-full border"
                                >
                                    +
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {error && (
                    <div className="text-red-600 mb-4">{error}</div>
                )}

                <div className="flex gap-2">
                    <button
                        onClick={handleConfirm}
                        className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
                    >
                        Confirm
                    </button>
                    <button
                        onClick={onCancel}
                        className="flex-1 bg-gray-100 py-2 rounded hover:bg-gray-200"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AccountItemsSelector;