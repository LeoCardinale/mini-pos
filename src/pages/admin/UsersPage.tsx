// src/pages/admin/UsersPage.tsx
import LanguageSelector from '../../components/common/LanguageSelector';
import { useTranslation } from 'react-i18next';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import UserForm from '../../components/admin/UserForm';
import { config } from '../../config';

interface User {
    id: string;
    name: string;
    cedula: string;
    role: string;
    active: boolean;
}

const UsersPage = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const { user: currentUser } = useAuth();
    const { t } = useTranslation();

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        try {
            const response = await fetch(`${config.apiUrl}/admin/users`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) throw new Error('Failed to load users');

            const data = await response.json();
            setUsers(data);
        } catch (err) {
            setError(t('errors.loadingUsers'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateUser = async (userData: any) => {
        try {
            const response = await fetch(`${config.apiUrl}/admin/users`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(userData)
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Error creating user');
            }

            await loadUsers();
            setShowForm(false);
        } catch (error) {
            throw error;
        }
    };

    const handleToggleStatus = async (userId: string) => {
        try {
            const response = await fetch(`${config.apiUrl}/admin/users/${userId}/toggle-status`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to update user status');
            }

            await loadUsers();
        } catch (err) {
            setError(t('errors.updatingUserStatus'));
        }
    };

    if (isLoading) return <div>{t('common.loading')}</div>;
    if (error) return <div className="text-red-600">{error}</div>;

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">{t('users.title')}</h1>
                <button
                    onClick={() => setShowForm(true)}
                    className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                    {t('users.addUser')}
                </button>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                {t('common.name')}
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                {t('users.cedula')}
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                {t('common.role')}
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
                        {users.map((user) => (
                            <tr key={user.id}>
                                <td className="px-6 py-4 whitespace-nowrap">{user.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap">{user.cedula}</td>
                                <td className="px-6 py-4 whitespace-nowrap">{user.role}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.active
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-red-100 text-red-800'
                                        }`}>
                                        {t(`common.${user.active ? 'active' : 'inactive'}`)}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    <button
                                        onClick={() => handleToggleStatus(user.id)}
                                        disabled={user.cedula === '20393453'}
                                        className={`text-${user.active ? 'red' : 'green'}-600 hover:text-${user.active ? 'red' : 'green'}-900 disabled:opacity-50`}
                                    >
                                        {t(`users.${user.active ? 'deactivate' : 'activate'}`)}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showForm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full">
                        <h2 className="text-xl font-bold mb-4">{t('users.addUser')}</h2>
                        <UserForm
                            onSubmit={handleCreateUser}
                            onCancel={() => setShowForm(false)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default UsersPage;