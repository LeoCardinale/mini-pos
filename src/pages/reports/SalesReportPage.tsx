import React, { useState, useEffect } from 'react';
import { config } from '../../config';
import { useTranslation } from 'react-i18next';

interface SaleRecord {
    id: string;
    productId: number;
    quantity: number;
    price: number;
    total: number;
    source: 'POS' | 'ACCUMULATED' | 'PREPAID';
    sourceId: string;
    createdAt: string;
    product: {
        name: string;
        price: number;
    };
    user: {
        name: string;
    };
}

const SalesReportPage = () => {
    const [sales, setSales] = useState<SaleRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [source, setSource] = useState<string>('');
    const { t } = useTranslation();

    const loadSales = async () => {
        try {
            let url = `${config.apiUrl}/sales?`;
            if (startDate) url += `&startDate=${startDate}`;
            if (endDate) url += `&endDate=${endDate}`;
            if (source) url += `&source=${source}`;

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) throw new Error('Failed to load sales data');

            const data = await response.json();
            setSales(data);
        } catch (err) {
            setError(t('errors.loadingSales'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleExportCSV = () => {
        // Crear el contenido CSV
        const headers = [t('common.date'), t('common.product'), t('common.quantity'), t('common.price'), t('common.total'), t('sales.source'), t('sales.seller')];
        const csvContent = [
            headers.join(','),
            ...sales.map(sale => [
                new Date(sale.createdAt).toLocaleString(),
                sale.product.name,
                sale.quantity,
                sale.price.toFixed(2),
                sale.total.toFixed(2),
                sale.source,
                sale.user.name
            ].map(cell => `"${cell}"`).join(','))
        ].join('\n');

        // Crear y descargar el archivo
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reporte_ventas-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    };

    useEffect(() => {
        loadSales();
    }, [startDate, endDate, source]);

    const totalAmount = sales.reduce((sum, sale) => sum + sale.total, 0);
    const totalItems = sales.reduce((sum, sale) => sum + sale.quantity, 0);

    if (isLoading) return <div>Loading...</div>;

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">{t('sales.title')}</h1>
                <button
                    onClick={handleExportCSV}
                    className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                >
                    {t('sales.exportCsv')}
                </button>
            </div>

            {/* Filtros */}
            <div className="mb-6 flex gap-4 bg-white p-4 rounded-lg shadow">
                <div>
                    <label className="block text-sm font-medium text-gray-700">{t('sales.startDate')}</label>
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="mt-1 block rounded-md border-gray-300 shadow-sm"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">{t('sales.endDate')}</label>
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="mt-1 block rounded-md border-gray-300 shadow-sm"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">{t('sales.source')}</label>
                    <select
                        value={source}
                        onChange={(e) => setSource(e.target.value)}
                        className="mt-1 block rounded-md border-gray-300 shadow-sm"
                    >
                        <option value="">{t('common.all')}</option>
                        <option value="POS">{t('nav.pos')}</option>
                        <option value="ACCUMULATED">{t('accounts.accumulated')}</option>
                        <option value="PREPAID">{t('accounts.prepaid')}</option>
                    </select>
                </div>
            </div>

            {/* Resumen */}
            <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-white p-4 rounded-lg shadow">
                    <h3 className="text-lg font-medium">{t('sales.totalSales')}</h3>
                    <p className="text-2xl font-bold">${totalAmount.toFixed(2)}</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow">
                    <h3 className="text-lg font-medium"> {t('sales.totalItems')}</h3>
                    <p className="text-2xl font-bold">{totalItems}</p>
                </div>
            </div>

            {/* Tabla de ventas */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('common.date')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('common.product')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('common.quantity')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('common.price')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('common.total')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('sales.source')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('sales.seller')}</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {sales.map((sale) => (
                            <tr key={sale.id}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {new Date(sale.createdAt).toLocaleString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">{sale.product.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap">{sale.quantity}</td>
                                <td className="px-6 py-4 whitespace-nowrap">${sale.price.toFixed(2)}</td>
                                <td className="px-6 py-4 whitespace-nowrap">${sale.total.toFixed(2)}</td>
                                <td className="px-6 py-4 whitespace-nowrap">{sale.source}</td>
                                <td className="px-6 py-4 whitespace-nowrap">{sale.user.name}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {error && (
                <div className="mt-4 text-red-600">
                    {error}
                </div>
            )}
        </div>
    );
};

export default SalesReportPage;