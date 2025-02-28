// src/pages/inventory/InventoryPage.tsx
import React, { useState, useEffect } from 'react';
import { Product } from '../../types';
import { productOperations } from '../../lib/database';
import ProductForm from '../../components/inventory/ProductForm';
import SearchBar from '../../components/common/SearchBar';
import { useTranslation } from 'react-i18next';
import { Tab, TabGroup, TabPanels, TabPanel, TabList } from '@headlessui/react';
import AddStockModal from '../../components/inventory/AddStockModal';


const InventoryPage = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const { t } = useTranslation();
    const [showAddStockModal, setShowAddStockModal] = useState(false);
    const [selectedProductForStock, setSelectedProductForStock] = useState<Product | null>(null);

    useEffect(() => {
        loadProducts();
    }, []);

    const loadProducts = async () => {
        try {
            setIsLoading(true);
            const allProducts = await productOperations.getAll();
            setProducts(allProducts);
            checkLowStock(allProducts);
        } catch (err) {
            setError(t('errors.products'));
        } finally {
            setIsLoading(false);
        }
    };

    const checkLowStock = (products: Product[]) => {
        const lowStockProducts = products.filter(p =>
            p.stock <= (p.minStock ?? 5)
        );

        if (lowStockProducts.length > 0) {
            const message = lowStockProducts
                .map(p => `${p.name}: ${p.stock} left`)
                .join('\n');
            alert(`Alerta de bajo stock!\n${message}`);
        }
    };

    const handleDelete = async (productId: number) => {
        if (!confirm(t('confirmations.deleteProduct'))) return;

        try {
            await productOperations.delete(productId);
            loadProducts();
        } catch (err) {
            setError(t('errors.generic'));
        }
    };

    const filteredProducts = selectedCategory
        ? products.filter(p => p.category === selectedCategory)
        : products;

    const searchFilteredProducts = filteredProducts.filter(product => {
        const searchLower = searchTerm.toLowerCase();
        return product.name.toLowerCase().includes(searchLower) ||
            (product.barcode && product.barcode.toLowerCase().includes(searchLower));
    });

    const handleAddStock = async (data: { quantity: number; cost: number; price: number; notes?: string }) => {
        try {
            if (!selectedProductForStock) return;

            await productOperations.addStock(
                selectedProductForStock.id,
                data.quantity,
                data.cost,
                data.price,
                data.notes
            );

            // Recargar datos
            await loadProducts();
            setShowAddStockModal(false);
            setSelectedProductForStock(null);
        } catch (err) {
            setError(t('errors.addingStock'));
        }
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">{t('inventory.title')}</h1>
                <button
                    onClick={() => setShowAddForm(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                >
                    {t('inventory.addProduct')}
                </button>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-md mb-4">
                    {error}
                </div>
            )}

            <TabGroup>
                <TabList className="flex space-x-1 rounded-xl bg-blue-900/20 p-1 mb-4">
                    <Tab
                        className={({ selected }) =>
                            `w-full rounded-lg py-2.5 text-sm font-medium leading-5
                        ${selected
                                ? 'bg-white text-blue-700 shadow'
                                : 'text-gray-600 hover:bg-white/[0.12] hover:text-gray-800'
                            }`
                        }
                    >
                        {t('inventory.productsTab')}
                    </Tab>
                    <Tab
                        className={({ selected }) =>
                            `w-full rounded-lg py-2.5 text-sm font-medium leading-5
                        ${selected
                                ? 'bg-white text-blue-700 shadow'
                                : 'text-gray-600 hover:bg-white/[0.12] hover:text-gray-800'
                            }`
                        }
                    >
                        {t('inventory.historyTab')}
                    </Tab>
                </TabList>
                <TabPanels>
                    <TabPanel>
                        <div className="mb-4 flex gap-4">
                            <div className="flex-1">
                                <SearchBar
                                    value={searchTerm}
                                    onChange={setSearchTerm}
                                    placeholder={t('inventory.searchPlaceholder')}
                                />
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setSelectedCategory(null)}
                                    className={`px-4 py-2 rounded-lg ${selectedCategory === null
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-100 text-gray-800'
                                        }`}
                                >
                                    {t('inventory.catAll')}
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
                        </div>

                        {isLoading ? (
                            <div>{t('common.loading')}</div>
                        ) : (
                            <div className="bg-white rounded-lg shadow overflow-hidden">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                                {t('inventory.image')}
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                                {t('common.name')}
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                                {t('common.category')}
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                                {t('common.price')}
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                                {t('common.stock')}
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                                {t('common.status')}
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                                {t('common.actions')}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {searchFilteredProducts.map((product) => (
                                            <tr key={product.id}>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {product.imageUrl ? (
                                                        <img
                                                            src={product.imageUrl}
                                                            alt={product.name}
                                                            className="h-12 w-12 object-cover rounded-md"
                                                        />
                                                    ) : (
                                                        <div className="h-12 w-12 bg-gray-100 rounded-md flex items-center justify-center text-gray-400">
                                                            {t('inventory.noImage')}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm font-medium text-gray-900">
                                                        {product.name}
                                                    </div>
                                                    {product.barcode && (
                                                        <div className="text-sm text-gray-500">
                                                            {product.barcode}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {product.category}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    ${product.price.toFixed(2)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`inline-flex rounded-full px-2 text-xs font-semibold ${product.stock <= (product.minStock ?? 5)
                                                        ? 'bg-red-100 text-red-800'
                                                        : 'bg-green-100 text-green-800'
                                                        }`}>
                                                        {product.stock}
                                                    </span>
                                                </td>

                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {product.isActive ? 'Activo' : 'Inactivo'}
                                                </td>

                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                    <button
                                                        onClick={() => {
                                                            setSelectedProductForStock(product);
                                                            setShowAddStockModal(true);
                                                        }}
                                                        className="text-green-600 hover:text-green-900 mr-4"
                                                    >
                                                        {t('inventory.addStock')}
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingProduct(product)}
                                                        className="text-blue-600 hover:text-blue-900 mr-4"
                                                    >
                                                        {t('common.edit')}
                                                    </button>

                                                    <button
                                                        onClick={() => handleDelete(product.id)}
                                                        className="text-red-600 hover:text-red-900"
                                                    >
                                                        {t('common.delete')}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </TabPanel>

                    <TabPanel>
                        <div className="bg-white rounded-lg shadow overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                            {t('common.date')}
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                            {t('common.user')}
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                            {t('common.action')}
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                            {t('common.description')}
                                        </th>
                                    </tr>
                                </thead>
                                {/*<tbody className="bg-white divide-y divide-gray-200">
                                    {logs.map((log) => (
                                        <tr key={log.id}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {new Date(log.timestamp).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                {log.userName}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                {t(`inventory.action.${log.action.toLowerCase()}`)}
                                            </td>
                                            <td className="px-6 py-4 text-sm">
                                                <div className="max-w-xl">
                                                    <p className="font-medium">{log.description.product}</p>
                                                    {log.description.changes && (
                                                        <div className="mt-1">
                                                            {log.description.changes.map((change, idx) => (
                                                                <div key={idx} className="text-gray-600">
                                                                    {change.field}: {' '}
                                                                    {change.field === 'imageUrl'
                                                                        ? 'Nueva imagen'
                                                                        : <>
                                                                            {change.oldValue && <span className="line-through">{change.oldValue}</span>}
                                                                            {change.oldValue && change.newValue && ' → '}
                                                                            {change.newValue && <span>{change.newValue}</span>}
                                                                        </>
                                                                    }
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {log.description.notes && (
                                                        <p className="mt-1 text-gray-500 italic">{log.description.notes}</p>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>*/}
                            </table>
                        </div>
                    </TabPanel>
                </TabPanels>
            </TabGroup>

            {(showAddForm || editingProduct) && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full">
                        <h2 className="text-xl font-bold mb-4">
                            {editingProduct ? 'Editar Producto' : 'Agregar Nuevo Producto'}
                        </h2>
                        <ProductForm
                            initialProduct={editingProduct ?? undefined}
                            onSubmit={() => {
                                setShowAddForm(false);
                                setEditingProduct(null);
                                loadProducts();
                            }}
                            onCancel={() => {
                                setShowAddForm(false);
                                setEditingProduct(null);
                            }}
                        />
                    </div>
                </div>
            )}

            {showAddStockModal && selectedProductForStock && (
                <AddStockModal
                    product={selectedProductForStock}
                    onSubmit={handleAddStock}
                    onCancel={() => {
                        setShowAddStockModal(false);
                        setSelectedProductForStock(null);
                    }}
                />
            )}
        </div>
    );
};

export default InventoryPage;