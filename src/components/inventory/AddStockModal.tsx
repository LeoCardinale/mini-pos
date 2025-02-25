import React, { useState } from 'react';
import { Product } from '../../types';
import { useTranslation } from 'react-i18next';

interface AddStockModalProps {
    product: Product;
    onSubmit: (data: { quantity: number; cost: number; price: number; notes?: string }) => Promise<void>;
    onCancel: () => void;
}

const AddStockModal: React.FC<AddStockModalProps> = ({ product, onSubmit, onCancel }) => {
    const [formData, setFormData] = useState({
        quantity: '',
        cost: product.cost.toString(),
        price: product.price.toString(),
        notes: ''
    });
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const { t } = useTranslation();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const quantity = parseInt(formData.quantity);
        if (!quantity || quantity <= 0) {
            setError(t('validation.invalidQuantity'));
            return;
        }

        setIsLoading(true);
        try {
            await onSubmit({
                quantity,
                cost: parseFloat(formData.cost),
                price: parseFloat(formData.price),
                notes: formData.notes.trim() || undefined
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : t('errors.addingStock'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
                <h2 className="text-xl font-bold mb-4">
                    {t('inventory.addStock')} - {product.name}
                </h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            {t('common.quantity')}
                        </label>
                        <input
                            type="number"
                            min="1"
                            step="1"
                            value={formData.quantity}
                            onChange={(e) => setFormData(prev => ({
                                ...prev,
                                quantity: e.target.value
                            }))}
                            required
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            {t('inventory.costPrice')}
                        </label>
                        <div className="mt-1 relative rounded-md shadow-sm">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <span className="text-gray-500 sm:text-sm">$</span>
                            </div>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={formData.cost}
                                onChange={(e) => setFormData(prev => ({
                                    ...prev,
                                    cost: e.target.value
                                }))}
                                required
                                className="block w-full pl-7 pr-3 py-2 rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            {t('inventory.sellingPrice')}
                        </label>
                        <div className="mt-1 relative rounded-md shadow-sm">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <span className="text-gray-500 sm:text-sm">$</span>
                            </div>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={formData.price}
                                onChange={(e) => setFormData(prev => ({
                                    ...prev,
                                    price: e.target.value
                                }))}
                                required
                                className="block w-full pl-7 pr-3 py-2 rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            {t('common.notes')}
                        </label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData(prev => ({
                                ...prev,
                                notes: e.target.value
                            }))}
                            rows={3}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
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
                            {isLoading ? t('common.saving') : t('common.save')}
                        </button>
                        <button
                            type="button"
                            onClick={onCancel}
                            className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-200"
                        >
                            {t('common.cancel')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddStockModal;