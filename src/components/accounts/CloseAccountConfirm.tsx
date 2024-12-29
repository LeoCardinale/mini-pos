import React from 'react';
import { Account } from '../../types';
import { useTranslation } from 'react-i18next';

interface CloseAccountConfirmProps {
    account: Account;
    onConfirm: () => void;
    onCancel: () => void;
}

const CloseAccountConfirm: React.FC<CloseAccountConfirmProps> = ({ account, onConfirm, onCancel }) => {
    const { t } = useTranslation();
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
                <h3 className="text-lg font-bold mb-4">{t('accounts.closeAccount')}</h3>
                <p className="mb-6">
                    {t('accounts.confirmClose')}<br />
                </p>
                <div className="flex gap-3">
                    <button
                        onClick={onConfirm}
                        className="flex-1 bg-red-600 text-white py-2 rounded hover:bg-red-700"
                    >
                        {t('accounts.closeAccount')}
                    </button>
                    <button
                        onClick={onCancel}
                        className="flex-1 bg-gray-100 text-gray-700 py-2 rounded hover:bg-gray-200"
                    >
                        {t('common.cancel')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CloseAccountConfirm;