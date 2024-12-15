// src/pages/admin/SuppliersPage.tsx
import React, { useState, useEffect } from 'react';
import SupplierForm from '../../components/suppliers/SupplierForm';
import { config } from '../../config';

interface Supplier {
    id: number;
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

const SuppliersPage = () => {
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

    useEffect(() => {
        loadSuppliers();
    }, []);

    const loadSuppliers = async () => {
        try {
            setIsLoading(true);
            const response = await fetch(`${config.apiUrl}/suppliers`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load suppliers');
            }

            const data = await response.json();
            setSuppliers(data);
        } catch (err) {
            setError('Error loading suppliers');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async (supplierData: Omit<Supplier, 'id'>) => {
        try {
            const url = editingSupplier
                ? `${config.apiUrl}/suppliers/${editingSupplier.id}`
                : `${config.apiUrl}/suppliers`;

            const response = await fetch(url, {
                method: editingSupplier ? 'PUT' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(supplierData)
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Error saving supplier');
            }

            await loadSuppliers();
            setShowForm(false);
            setEditingSupplier(null);
        } catch (error) {
            throw error;
        }
    };

    const handleEdit = (supplier: Supplier) => {
        setEditingSupplier(supplier);
        setShowForm(true);
    };

    const handleDelete = async (supplierId: number) => {
        if (!confirm('Are you sure you want to delete this supplier?')) return;

        try {
            const response = await fetch(`${config.apiUrl}/suppliers/${supplierId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to delete supplier');
            }

            await loadSuppliers();
        } catch (err) {
            setError('Error deleting supplier');
        }
    };

    if (isLoading) return <div>Loading...</div>;

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Suppliers</h1>
                <button
                    onClick={() => setShowForm(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                >
                    Add Supplier
                </button>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-md mb-4">
                    {error}
                </div>
            )}

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    ID
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Fiscal Name
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Trade Name
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Contact
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Phone/Email
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Tax ID
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {suppliers.map((supplier) => (
                                <tr key={supplier.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {supplier.id}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">
                                            {supplier.fiscalName}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900">
                                            {supplier.tradeName}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900">
                                            {supplier.contact || '-'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900">
                                            {supplier.phone && (
                                                <div>{supplier.phone}</div>
                                            )}
                                            {supplier.email && (
                                                <div className="text-gray-500">{supplier.email}</div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {supplier.taxId || '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px - 2 inline - flex text - xs leading - 5 font - semibold rounded - full ${supplier.active
                                            ? 'bg-green-100 text-green-800'
                                            : 'bg-red-100 text-red-800'
                                            }`}>
                                            {supplier.active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <button
                                            onClick={() => handleEdit(supplier)}
                                            className="text-blue-600 hover:text-blue-900 mr-4"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDelete(supplier.id)}
                                            className="text-red-600 hover:text-red-900"
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal para el formulario */}
            {showForm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
                        <h2 className="text-xl font-bold mb-4">
                            {editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
                        </h2>
                        <SupplierForm
                            initialData={editingSupplier || undefined}
                            onSubmit={handleSave}
                            onCancel={() => {
                                setShowForm(false);
                                setEditingSupplier(null);
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default SuppliersPage;