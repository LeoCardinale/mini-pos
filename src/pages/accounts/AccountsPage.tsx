import React, { useState, useEffect } from 'react';
import { Account, AccountType } from '../../types';
import { config } from '../../config';
import AccountForm from '../../components/accounts/AccountForm';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';


const AccountsPage = () => {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const navigate = useNavigate();
    const { t } = useTranslation();

    const { user } = useAuth();

    const openAccounts = accounts.filter(account => account.status === 'open');
    const closedAccounts = accounts.filter(account => account.status === 'closed');

    // Subdividimos las cuentas abiertas por tipo
    const openPrepaidAccounts = openAccounts.filter(account => account.type === AccountType.PREPAID);
    const openAccumulatedAccounts = openAccounts.filter(account => account.type === AccountType.ACCUMULATED);

    // Subdividimos las cuentas cerradas por tipo
    const closedPrepaidAccounts = closedAccounts.filter(account => account.type === AccountType.PREPAID);
    const closedAccumulatedAccounts = closedAccounts.filter(account => account.type === AccountType.ACCUMULATED);

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

    // Renderizar las cuentas agrupadas
    const renderAccountGroup = (accounts: Account[], type: 'accumulated' | 'prepaid') => (
        <div className="grid grid-cols-1 gap-4">
            {accounts.map(account => (
                <div
                    key={account.id}
                    onClick={() => navigate(`/accounts/${account.id}`)}
                    className={`p-4 rounded-lg shadow cursor-pointer hover:shadow-md transition-shadow ${type === 'accumulated' ? 'bg-red-100' : 'bg-green-100'
                        }`}
                >
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="font-medium">{account.customerName}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs ${account.status === 'open'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                            }`}>
                            {account.status === 'open' ? t('accounts.open') : t('accounts.closed')}
                        </span>
                    </div>
                    <div className="text-sm text-gray-500">
                        <p>{t('common.type')}: {account.type === AccountType.PREPAID ? t('accounts.prepaid') : t('accounts.accumulated')}</p>
                        <p>{t('accounts.openedAt')}: {account.openedAt.toLocaleString()}</p>
                        {account.creditLimit && (
                            <p>{t('accounts.creditLimit')}: ${account.creditLimit}</p>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );

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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Cuentas Acumuladas Abiertas */}
                    <div>
                        <div className="flex items-center mb-3">
                            <h3 className="text-lg font-medium italic">{t('accounts.accumulated')}</h3>
                            {/*user?.role === 'admin' && openAccumulatedAccounts.length > 0 && (
                                <span className="ml-2 text-sm text-red-600">
                                    Deuda total: ${totalDebt.toFixed(2)}
                                </span>
                            )*/}
                        </div>
                        <div className="overflow-y-auto max-h-96">
                            {renderAccountGroup(openAccumulatedAccounts, 'accumulated')}
                            {openAccumulatedAccounts.length === 0 && (
                                <p className="text-gray-500">{t('accounts.noAccumulatedAccounts')}</p>
                            )}
                        </div>
                    </div>

                    {/* Cuentas Prepago Abiertas */}
                    <div>
                        <h3 className="text-lg font-medium italic mb-3">{t('accounts.prepaid')}</h3>
                        <div className="overflow-y-auto max-h-96">
                            {renderAccountGroup(openPrepaidAccounts, 'prepaid')}
                            {openPrepaidAccounts.length === 0 && (
                                <p className="text-gray-500">{t('accounts.noPrepaidAccounts')}</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Separador */}
            <div className="border-t border-gray-200 my-8"></div>

            {/* Cuentas Cerradas */}
            <div>
                <h2 className="text-xl font-semibold mb-4">{t('accounts.closedAccounts')}</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Cuentas Acumuladas Cerradas */}
                    <div>
                        <h3 className="text-lg font-medium italic mb-3">{t('accounts.accumulated')}</h3>
                        <div className="overflow-y-auto max-h-96">
                            {renderAccountGroup(closedAccumulatedAccounts, 'accumulated')}
                            {closedAccumulatedAccounts.length === 0 && (
                                <p className="text-gray-500">{t('accounts.noAccumulatedAccounts')}</p>
                            )}
                        </div>
                    </div>

                    {/* Cuentas Prepago Cerradas */}
                    <div>
                        <h3 className="text-lg font-medium italic mb-3">{t('accounts.prepaid')}</h3>
                        <div className="overflow-y-auto max-h-96">
                            {renderAccountGroup(closedPrepaidAccounts, 'prepaid')}
                            {closedPrepaidAccounts.length === 0 && (
                                <p className="text-gray-500">{t('accounts.noPrepaidAccounts')}</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal de formulario */}
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