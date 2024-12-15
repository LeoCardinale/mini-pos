// src/components/suppliers/SupplierForm.tsx
import React, { useState } from 'react';

interface Supplier {
    id?: number;
    fiscalName: string;
    tradeName: string;
    contact?: string;
    phone?: string;
    email?: string;
    taxId?: string;
    address?: string;
    notes?: string;
    active: boolean;
}

interface SupplierFormProps {
    initialData?: Supplier;
    onSubmit: (data: Supplier) => Promise<void>;
    onCancel: () => void;
}

const SupplierForm: React.FC<SupplierFormProps> = ({
    initialData,
    onSubmit,
    onCancel
}) => {
    const [formData, setFormData] = useState<Supplier>({
        fiscalName: initialData?.fiscalName || '',
        tradeName: initialData?.tradeName || '',
        contact: initialData?.contact || '',
        phone: initialData?.phone || '',
        email: initialData?.email || '',
        taxId: initialData?.taxId || '',
        address: initialData?.address || '',
        notes: initialData?.notes || '',
        active: initialData?.active ?? true
    });
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox'
                ? (e.target as HTMLInputElement).checked
                : value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            if (!formData.fiscalName.trim() || !formData.tradeName.trim()) {
                throw new Error('Fiscal name and trade name are required');
            }

            await onSubmit(formData);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error saving supplier');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Fiscal Name */}
                <div>
                    <label className="block text-sm font-medium text-gray-700">
                        Fiscal Name *
                    </label>
                    <input
                        type="text"
                        name="fiscalName"
                        value={formData.fiscalName}
                        onChange={handleChange}
                        required
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                </div>

                {/* Trade Name */}
                <div>
                    <label className="block text-sm font-medium text-gray-700">
                        Trade Name *
                    </label>
                    <input
                        type="text"
                        name="tradeName"
                        value={formData.tradeName}
                        onChange={handleChange}
                        required
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                </div>

                {/* Contact Person */}
                <div>
                    <label className="block text-sm font-medium text-gray-700">
                        Contact Person
                    </label>
                    <input
                        type="text"
                        name="contact"
                        value={formData.contact}
                        onChange={handleChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                </div>

                {/* Phone */}
                <div>
                    <label className="block text-sm font-medium text-gray-700">
                        Phone
                    </label>
                    <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                </div>

                {/* Email */}
                <div>
                    <label className="block text-sm font-medium text-gray-700">
                        Email
                    </label>
                    <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                </div>

                {/* Tax ID */}
                <div>
                    <label className="block text-sm font-medium text-gray-700">
                        Tax ID (RIF/NIF)
                    </label>
                    <input
                        type="text"
                        name="taxId"
                        value={formData.taxId}
                        onChange={handleChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                </div>
            </div>

            {/* Address - Full width */}
            <div>
                <label className="block text-sm font-medium text-gray-700">
                    Address
                </label>
                <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
            </div>

            {/* Notes - Full width */}
            <div>
                <label className="block text-sm font-medium text-gray-700">
                    Notes
                </label>
                <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    rows={3}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
            </div>

            {/* Active Status */}
            <div className="flex items-center">
                <input
                    type="checkbox"
                    name="active"
                    checked={formData.active}
                    onChange={handleChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm text-gray-700">
                    Active
                </label>
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
                    {isLoading ? 'Saving...' : initialData ? 'Update' : 'Create'}
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

export default SupplierForm;