import React, { useState, useEffect } from 'react';
import { Account, AccountType } from '../../types';
import { config } from '../../config';
import AccountForm from '../../components/accounts/AccountForm';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';


const AccountsPage = () => {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const navigate = useNavigate();
    const { t } = useTranslation();

    useEffect(() => {
        loadAccounts();
    }, []);

    const handleCreateAccount = async (formData: any) => {
        try {
            const response = await fetch(`${config.apiUrl}/accounts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || t('errors.creatingAccount'));
            }

            await loadAccounts();
            setShowForm(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : t('errors.creatingAccount'));
        }
    };

    const loadAccounts = async () => {
        try {
            const response = await fetch(`${config.apiUrl}/accounts`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) {
                throw new Error('Error loading accounts');
            }

            const data = await response.json();
            setAccounts(data.map((account: any) => ({
                ...account,
                openedAt: new Date(account.openedAt),
                closedAt: account.closedAt ? new Date(account.closedAt) : undefined
            })));
        } catch (err) {
            setError(t('errors.loadingAccounts'));
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) return <div>{t('common.loading')}</div>;

    const openAccounts = accounts.filter(account => account.status === 'open');
    const closedAccounts = accounts.filter(account => account.status === 'closed');

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">{t('accounts.title')}</h1>
                <button
                    onClick={() => setShowForm(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                >
                    {t('accounts.newAccount')}
                </button>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-md mb-4">
                    {error}
                </div>
            )}

            {/* Cuentas Abiertas */}
            <div className="mb-8">
                <h2 className="text-xl font-semibold mb-4">{t('accounts.openAccounts')}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {openAccounts.map(account => (
                        <div
                            key={account.id}
                            onClick={() => navigate(`/accounts/${account.id}`)}
                            className="bg-white p-4 rounded-lg shadow cursor-pointer hover:shadow-md transition-shadow"
                        >
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="font-medium">{account.customerName}</h3>
                                <span className={`px-2 py-1 rounded-full text-xs ${account.status === 'open'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-gray-100 text-gray-800'
                                    }`}>
                                    {account.status}
                                </span>
                            </div>
                            <div className="text-sm text-gray-500">
                                <p>{t('common.type')}: {account.type}</p>
                                <p>{t('accounts.openedAt')}: {account.openedAt.toLocaleString()}</p>
                                {account.creditLimit && (
                                    <p>{t('accounts.creditLimit')}: ${account.creditLimit}</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Separador */}
            <div className="border-t border-gray-200 my-8"></div>

            {/* Cuentas Cerradas */}
            <div>
                <h2 className="text-xl font-semibold mb-4">{t('accounts.closedAccounts')}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {closedAccounts.map(account => (
                        <div
                            key={account.id}
                            onClick={() => navigate(`/accounts/${account.id}`)}
                            className="bg-white p-4 rounded-lg shadow cursor-pointer hover:shadow-md transition-shadow opacity-75"
                        >
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="font-medium">{account.customerName}</h3>
                                <span className={`px-2 py-1 rounded-full text-xs ${account.status === 'open'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-gray-100 text-gray-800'
                                    }`}>
                                    {account.status}
                                </span>
                            </div>
                            <div className="text-sm text-gray-500">
                                <p>{t('common.type')}: {account.type}</p>
                                <p>{t('accounts.openedAt')}: {account.openedAt.toLocaleString()}</p>
                                {account.creditLimit && (
                                    <p>{t('accounts.creditLimit')}: ${account.creditLimit}</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {showForm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full">
                        <h2 className="text-xl font-bold mb-4">{t('accounts.createAccount')}</h2>
                        <AccountForm
                            onSubmit={handleCreateAccount}
                            onCancel={() => setShowForm(false)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default AccountsPage;