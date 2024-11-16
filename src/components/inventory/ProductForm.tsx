// src/components/inventory/ProductForm.tsx
import React, { useState } from 'react';
import { Product } from '../../types';
import { productOperations } from '../../lib/database';

type ProductFormData = Omit<Product, 'id' | 'createdAt' | 'updatedAt'>;

interface ProductFormProps {
    onSubmit: () => void;
    initialProduct?: Product;
    onCancel: () => void;
}

const CATEGORIES = ['Wines', 'Beers', 'Spirits', 'Food', 'Others'];

const ProductForm: React.FC<ProductFormProps> = ({
    onSubmit,
    initialProduct,
    onCancel
}) => {
    const [formData, setFormData] = useState({
        name: initialProduct?.name || '',
        barcode: initialProduct?.barcode || '',
        category: initialProduct?.category || CATEGORIES[0],
        price: initialProduct?.price?.toString() || '',
        stock: initialProduct?.stock?.toString() || '',
        minStock: initialProduct?.minStock?.toString() || '',
        imageUrl: initialProduct?.imageUrl || ''
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                // Convert image to base64 for local storage
                const reader = new FileReader();
                reader.onloadend = () => {
                    setFormData(prev => ({
                        ...prev,
                        imageUrl: reader.result as string
                    }));
                };
                reader.readAsDataURL(file);
            } catch (err) {
                setError('Error processing image');
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            const productData: ProductFormData = {
                name: formData.name,
                barcode: formData.barcode || undefined,
                category: formData.category,
                price: parseFloat(formData.price),
                stock: parseInt(formData.stock),
                minStock: formData.minStock ? parseInt(formData.minStock) : undefined,
                imageUrl: formData.imageUrl || undefined
            };

            if (initialProduct) {
                await productOperations.update(initialProduct.id, productData);
            } else {
                await productOperations.create(productData);
            }

            onSubmit();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error saving product');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    maxLength={100}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700">Barcode</label>
                <input
                    type="text"
                    name="barcode"
                    value={formData.barcode}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700">Category</label>
                <select
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                    {CATEGORIES.map(category => (
                        <option key={category} value={category}>{category}</option>
                    ))}
                </select>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700">Price</label>
                <input
                    type="number"
                    name="price"
                    value={formData.price}
                    onChange={handleChange}
                    required
                    step="0.01"
                    min="0"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700">Stock</label>
                <input
                    type="number"
                    name="stock"
                    value={formData.stock}
                    onChange={handleChange}
                    required
                    min="0"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700">
                    Minimum Stock Alert
                </label>
                <input
                    type="number"
                    name="minStock"
                    value={formData.minStock}
                    onChange={handleChange}
                    min="0"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700">Image</label>
                <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {formData.imageUrl && (
                    <img
                        src={formData.imageUrl}
                        alt="Preview"
                        className="mt-2 h-32 w-32 object-cover rounded-md"
                    />
                )}
            </div>

            {error && (
                <div className="text-red-600 text-sm">{error}</div>
            )}

            <div className="flex gap-3">
                <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                    {isLoading ? 'Saving...' : initialProduct ? 'Update' : 'Add Product'}
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
    );
};

export default ProductForm;