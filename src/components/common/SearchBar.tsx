// src/components/common/SearchBar.tsx
import React from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { t } from 'i18next';

interface SearchBarProps {
    placeholder?: string;
    value: string;
    onChange: (value: string) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({
    placeholder = t('common.search'),
    value,
    onChange
}) => {
    return (
        <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
                type="text"
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
        </div>
    );
};

export default SearchBar;