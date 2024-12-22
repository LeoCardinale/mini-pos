// src/components/pos/ProductsGrid.tsx
import React from 'react';
import { Product } from '../../types';
import { useTranslation } from 'react-i18next';

interface ProductsGridProps {
    products: Product[];
    onProductSelect: (product: Product) => void;
    selectedCategory: string | null;
}

const ProductsGrid: React.FC<ProductsGridProps> = ({
    products,
    onProductSelect,
    selectedCategory,
}) => {
    const filteredProducts = selectedCategory
        ? products.filter(p => p.category === selectedCategory)
        : products;

    const { t } = useTranslation();

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredProducts.map((product) => (
                <button
                    key={product.id}
                    onClick={() => onProductSelect(product)}
                    disabled={product.stock <= 0}
                    className={`
            p-4 rounded-lg border text-left
            ${product.stock > 0
                            ? 'hover:bg-blue-50 border-blue-200'
                            : 'opacity-50 cursor-not-allowed border-gray-200'
                        }
          `}
                >
                    <div className="aspect-square w-full bg-gray-100 rounded-md mb-2">
                        {product.imageUrl ? (
                            <img
                                src={product.imageUrl}
                                alt={product.name}
                                className="w-full h-full object-cover rounded-md"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                                {t('inventory.noImage')}
                            </div>
                        )}
                    </div>

                    <div className="mt-2">
                        <h3 className="font-medium text-gray-900 truncate">
                            {product.name}
                        </h3>
                        <p className="text-green-600 font-medium">
                            ${product.price.toFixed(2)}
                        </p>
                        <p className="text-sm text-gray-500">
                            {t('common.stock')}: {product.stock}
                        </p>
                    </div>
                </button>
            ))}
        </div>
    );
};

export default ProductsGrid;