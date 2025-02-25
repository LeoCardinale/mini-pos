// src/components/admin/UserForm.tsx
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

// Interface para los datos del formulario (incluyendo confirmación)
interface UserFormState {
    name: string;
    cedula: string;
    password: string;
    passwordConfirm: string;
    roleId: string;
}

// Interface para los datos que se envían al backend (sin confirmación)
interface UserFormData {
    name: string;
    cedula: string;
    password: string;
    roleId: string;
}

interface UserFormProps {
    onSubmit: (userData: UserFormData) => Promise<void>;
    onCancel: () => void;
}

const UserForm: React.FC<UserFormProps> = ({ onSubmit, onCancel }) => {
    const [formData, setFormData] = useState<UserFormState>({
        name: '',
        cedula: '',
        password: '',
        passwordConfirm: '',
        roleId: '2'
    });
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const { t } = useTranslation();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (formData.password !== formData.passwordConfirm) {
            setError(t('validation.passwordsDoNotMatch'));
            return;
        }

        setIsLoading(true);

        try {
            const { passwordConfirm, ...submitData } = formData;
            await onSubmit(submitData);
        } catch (err) {
            setError(err instanceof Error ? err.message : t('errors.saving', { item: t('users.user') }));
        } finally {
            setIsLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700">
                    {t('common.name')}
                </label>
                <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700">
                    {t('users.cedula')}
                </label>
                <input
                    type="text"  // Cambiamos a text pero con patrón numérico
                    name="cedula"
                    value={formData.cedula}
                    onChange={(e) => {
                        // Solo permitir números
                        const value = e.target.value.replace(/[^0-9]/g, '');
                        setFormData(prev => ({
                            ...prev,
                            cedula: value
                        }));
                    }}
                    pattern="[0-9]*"  // Forzar solo números
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700">
                    {t('common.password')}
                </label>
                <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    minLength={6}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700">
                    {t('users.confirmPassword')}
                </label>
                <input
                    type="password"
                    name="passwordConfirm"
                    value={formData.passwordConfirm}
                    onChange={handleChange}
                    required
                    minLength={6}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700">
                    {t('common.role')}
                </label>
                <select
                    name="roleId"
                    value={formData.roleId}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                    <option value="2">{t('users.userRole')}</option>
                    <option value="1">{t('users.adminRole')}</option>
                </select>
            </div>

            {error && (
                <div className="text-red-600 text-sm">{error}</div>
            )}

            <div className="flex gap-3">
                <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                    {isLoading ? t('common.creating') : t('users.createUser')}
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-200"
                >
                    {t('common.cancel')}
                </button>
            </div>
        </form>
    );
};

export default UserForm;