import React from 'react';
import { useTranslation } from 'react-i18next';

const LanguageSelector: React.FC = () => {
    const { i18n } = useTranslation();

    const changeLanguage = (event: React.ChangeEvent<HTMLSelectElement>) => {
        i18n.changeLanguage(event.target.value);
    };

    return (
        <select
            value={i18n.language}
            onChange={changeLanguage}
            className="mt-1 block rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        >
            <option value="en">English</option>
            <option value="es">Español</option>
        </select>
    );
};

export default LanguageSelector;