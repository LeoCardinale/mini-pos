import React, { useState, useEffect } from 'react';
import { Account, AccountType } from '../../types';
import { config } from '../../config';
import AccountForm from '../../components/accounts/AccountForm';
import { useNavigate } from 'react-router-dom';


const AccountsPage = () => {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const navigate = useNavigate();

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
                throw new Error(error.error || 'Error creating account');
            }

            await loadAccounts();
            setShowForm(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error creating account');
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
            setError('Error loading accounts');
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) return <div>Loading...</div>;

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Accounts</h1>
                <button
                    onClick={() => setShowForm(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                >
                    New Account
                </button>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-md mb-4">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {accounts.map(account => (
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
                            <p>Type: {account.type}</p>
                            <p>Opened: {account.openedAt.toLocaleString()}</p>
                            {account.creditLimit && (
                                <p>Credit Limit: ${account.creditLimit}</p>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {showForm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full">
                        <h2 className="text-xl font-bold mb-4">Create New Account</h2>
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