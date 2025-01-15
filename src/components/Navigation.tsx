// src/components/Navigation.tsx
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { cashRegisterOperations } from '../lib/database';


const Navigation = () => {
    const { user, logout } = useAuth();
    const location = useLocation();
    const { t } = useTranslation();

    if (!user) return null;

    const isActive = (path: string) => location.pathname === path;

    const handleLogout = async () => {
        try {
            // Primero, verificar si hay una caja abierta para este usuario
            const currentRegister = await cashRegisterOperations.getCurrent(user?.id);

            if (currentRegister && currentRegister.status === 'open') {
                alert(t('register.closeBeforeLogout') || 'Favor cerrar caja antes de cerrar sesión');
                return;
            }

            // Si no hay caja abierta, pedir confirmación
            if (!window.confirm(t('confirmations.logout') || '¿Está seguro que desea cerrar sesión?')) {
                return;
            }

            // Si el usuario confirma, proceder con el logout
            logout();
        } catch (error) {
            console.error('Error checking register status:', error);
            alert(t('register.closeBeforeLogout') || 'Favor cerrar caja antes de cerrar sesión');
            return;
        }
    };

    return (
        <nav className="bg-white shadow-lg">
            <div className="max-w-7xl mx-auto px-4">
                <div className="flex justify-between h-16">
                    <div className="flex space-x-4 items-center">
                        <Link
                            to="/pos"
                            className={`px-3 py-2 rounded-md text-sm font-medium ${isActive('/pos')
                                ? 'bg-blue-500 text-white'
                                : 'text-gray-700 hover:bg-blue-50'
                                }`}
                        >
                            {t('nav.pos')}
                        </Link>

                        <Link
                            to="/accounts"
                            className={`px-3 py-2 rounded-md text-sm font-medium ${isActive('/accounts')
                                ? 'bg-blue-500 text-white'
                                : 'text-gray-700 hover:bg-blue-50'
                                }`}
                        >
                            {t('nav.accounts')}
                        </Link>

                        <Link
                            to="/register"
                            className={`px-3 py-2 rounded-md text-sm font-medium ${isActive('/register')
                                ? 'bg-blue-500 text-white'
                                : 'text-gray-700 hover:bg-blue-50'
                                }`}
                        >
                            {t('nav.register')}
                        </Link>
                    </div>

                    <div className="flex items-center space-x-4">
                        {user.role === 'admin' && (
                            <Link
                                to="/inventory"
                                className={`px-3 py-2 rounded-md text-sm font-medium ${isActive('/inventory')
                                    ? 'bg-blue-500 text-white'
                                    : 'text-gray-700 hover:bg-blue-50'
                                    }`}
                            >
                                {t('nav.inventory')}
                            </Link>
                        )}

                        {user.role === 'admin' && (
                            <Link
                                to="/admin/suppliers"
                                className={`px-3 py-2 rounded-md text-sm font-medium ${isActive('/admin/suppliers')
                                    ? 'bg-blue-500 text-white'
                                    : 'text-gray-700 hover:bg-blue-50'
                                    }`}
                            >
                                {t('nav.suppliers')}
                            </Link>
                        )}

                        {user.role === 'admin' && (
                            <Link
                                to="/admin/users"
                                className={`px-3 py-2 rounded-md text-sm font-medium ${isActive('/admin/users')
                                    ? 'bg-blue-500 text-white'
                                    : 'text-gray-700 hover:bg-blue-50'
                                    }`}
                            >
                                {t('nav.users')}
                            </Link>
                        )}

                        <Link
                            to="/reports/sales"
                            className={`px-3 py-2 rounded-md text-sm font-medium ${isActive('/reports/sales')
                                ? 'bg-blue-500 text-white'
                                : 'text-gray-700 hover:bg-blue-50'
                                }`}
                        >
                            {t('nav.salesReport')}
                        </Link>
                        <span className="text-sm text-gray-700">
                            {user.name} ({user.role})
                        </span>
                        <button
                            onClick={handleLogout}  // Cambiar onClick={logout} por onClick={handleLogout}
                            className="px-3 py-2 rounded-md text-sm font-medium text-red-600 hover:bg-red-50"
                        >
                            {t('nav.logout')}
                        </button>
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Navigation;