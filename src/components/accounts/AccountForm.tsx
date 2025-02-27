import React, { useState } from 'react';
import { AccountType } from '../../types';
import { useTranslation } from 'react-i18next';

interface AccountFormProps {
    onSubmit: (data: AccountFormData) => Promise<void>;
    onCancel: () => void;
}

interface AccountFormData {
    customerName: string;
    type: AccountType;
    creditLimit?: number;
}

const AccountForm: React.FC<AccountFormProps> = ({ onSubmit, onCancel }) => {
    const [formData, setFormData] = useState<AccountFormData>({
        customerName: '',
        type: AccountType.ACCUMULATED,
        creditLimit: undefined
    });
    const [showCreditLimit, setShowCreditLimit] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const { t } = useTranslation();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            if (!formData.customerName.trim()) {
                throw new Error(t('validation.required', { field: t('accounts.customerName') }));
            }

            await onSubmit(formData);
        } catch (err) {
            setError(err instanceof Error ? err.message : t('errors.saving', { item: t('accounts.account') }));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700">
                    {t('accounts.customerName')}
                </label>
                <input
                    type="text"
                    value={formData.customerName}
                    onChange={(e) => setFormData(prev => ({
                        ...prev,
                        customerName: e.target.value
                    }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    required
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700">
                    {t('accounts.accountType')}
                </label>
                <select
                    value={formData.type}
                    onChange={(e) => {
                        const newType = e.target.value as AccountType;
                        setFormData(prev => ({
                            ...prev,
                            type: newType,
                            creditLimit: newType === AccountType.PREPAID ? undefined : prev.creditLimit
                        }));
                    }}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                    <option value={AccountType.ACCUMULATED}>{t('accounts.accumulated')}</option>
                    <option value={AccountType.PREPAID}>{t('accounts.prepaid')}</option>
                </select>
            </div>

            {formData.type === AccountType.ACCUMULATED && (
                <div>
                    <div className="flex items-center mb-2">
                        <input
                            type="checkbox"
                            id="useCreditLimit"
                            checked={showCreditLimit}
                            onChange={(e) => {
                                setShowCreditLimit(e.target.checked);
                                if (!e.target.checked) {
                                    setFormData(prev => ({ ...prev, creditLimit: undefined }));
                                }
                            }}
                            className="h-4 w-4 text-blue-600 rounded border-gray-300"
                        />
                        <label htmlFor="useCreditLimit" className="ml-2 text-sm text-gray-700">
                            {t('accounts.setCreditLimit')}
                        </label>
                    </div>

                    {showCreditLimit && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                {t('accounts.creditLimit')}
                            </label>
                            <input
                                type="number"
                                value={formData.creditLimit || ''}
                                onChange={(e) => setFormData(prev => ({
                                    ...prev,
                                    creditLimit: parseFloat(e.target.value) || undefined
                                }))}
                                min="0"
                                step="0.01"
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            />
                        </div>
                    )}
                </div>
            )}

            {error && (
                <div className="text-red-600 text-sm">{error}</div>
            )}

            <div className="flex gap-3">
                <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                    {isLoading ? t('common.creating') : t('accounts.createAccount')}
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

export default AccountForm;