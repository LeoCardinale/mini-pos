// src/context/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { syncClient } from '../lib/sync/syncClient';
import { config } from '../config';

interface User {
    id: string;
    cedula: string;
    name: string;
    role: string;
}

interface AuthContextType {
    user: User | null;
    login: (cedula: string, password: string) => Promise<void>;
    logout: () => void;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Verificar token almacenado al cargar la aplicación
        const token = localStorage.getItem('token');
        if (token) {
            validateToken(token);
        } else {
            setIsLoading(false);
        }
    }, []);

    const validateToken = async (token: string) => {
        try {
            const response = await fetch('`${config.apiUrl}/auth/validate', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setUser(data.user);
            } else {
                localStorage.removeItem('token');
            }
        } catch (error) {
            localStorage.removeItem('token');
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (cedula: string, password: string) => {
        try {
            const response = await fetch(`${config.apiUrl}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ cedula, password })
            });

            if (!response.ok) {
                throw new Error('Login failed');
            }

            const data = await response.json();
            localStorage.setItem('token', data.token);
            setUser(data.user);

            // Iniciar sincronización después del login exitoso
            syncClient.start();

        } catch (error) {
            throw new Error('Login failed');
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        syncClient.stop(); // Detener la sincronización
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};