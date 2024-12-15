import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Account, AccountType } from '../../types';
import { config } from '../../config';
import PrepaidAccountDetail from '../../components/accounts/PrepaidAccountDetail';
import AccumulatedAccountDetail from '../../components/accounts/AccumulatedAccountDetail';

const AccountDetailPage = () => {
    const { id } = useParams();
    const [account, setAccount] = useState<Account | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadAccount();
    }, [id]);

    const loadAccount = async () => {
        try {
            const response = await fetch(`${config.apiUrl}/accounts/${id}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) throw new Error('Failed to load account');

            const data = await response.json();
            setAccount({
                ...data,
                openedAt: new Date(data.openedAt),
                closedAt: data.closedAt ? new Date(data.closedAt) : undefined
            });
        } catch (err) {
            setError('Error loading account');
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) return <div>Loading...</div>;
    if (error) return <div className="text-red-600">{error}</div>;
    if (!account) return <div>Account not found</div>;

    return (
        <div className="p-6">
            {account.type === AccountType.PREPAID ? (
                <PrepaidAccountDetail account={account} onUpdate={loadAccount} />
            ) : (
                <AccumulatedAccountDetail account={account} onUpdate={loadAccount} />
            )}
        </div>
    );
};

export default AccountDetailPage;