// src/components/Navigation.tsx
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navigation = () => {
    const { user, logout } = useAuth();
    const location = useLocation();

    if (!user) return null;

    const isActive = (path: string) => location.pathname === path;

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
                            POS
                        </Link>

                        {user.role === 'admin' && (
                            <Link
                                to="/inventory"
                                className={`px-3 py-2 rounded-md text-sm font-medium ${isActive('/inventory')
                                        ? 'bg-blue-500 text-white'
                                        : 'text-gray-700 hover:bg-blue-50'
                                    }`}
                            >
                                Inventory
                            </Link>
                        )}

                        <Link
                            to="/register"
                            className={`px-3 py-2 rounded-md text-sm font-medium ${isActive('/register')
                                ? 'bg-blue-500 text-white'
                                : 'text-gray-700 hover:bg-blue-50'
                                }`}
                        >
                            Register
                        </Link>

                        {user.role === 'admin' && (
                            <Link
                                to="/admin/users"
                                className={`px-3 py-2 rounded-md text-sm font-medium ${isActive('/admin/users')
                                    ? 'bg-blue-500 text-white'
                                    : 'text-gray-700 hover:bg-blue-50'
                                    }`}
                            >
                                Users
                            </Link>
                        )}
                    </div>

                    <div className="flex items-center space-x-4">
                        <span className="text-sm text-gray-700">
                            {user.name} ({user.role})
                        </span>
                        <button
                            onClick={logout}
                            className="px-3 py-2 rounded-md text-sm font-medium text-red-600 hover:bg-red-50"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Navigation;