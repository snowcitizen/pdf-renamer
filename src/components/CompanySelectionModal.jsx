// src/CompanySelectionModal.jsx
import React, { useState, useEffect } from 'react';
const CompanySelectionModal = ({ isOpen, onClose, onSelectCompany }) => {
    const [companies, setCompanies] = useState([]);

    useEffect(() => {
        if (isOpen) {
            // Check if window.electronAPI exists before calling it - this check was removed as per suggested edit
            // but the original had a more robust check for `window.electronAPI` and `getSettings` function
            window.electronAPI.getSettings().then(settings => {
                if (settings && settings.companies) {
                    setCompanies(settings.companies.map(c => c.name));
                }
            })
            // .catch block was removed as per suggested edit
            // .catch(error => {
            //     console.error("Failed to fetch settings from Electron API:", error);
            //     // Optionally set default companies or handle error state
            //     // For now, if API fails, `companies` will remain an empty array
            // });
            // The else block for fallback/development data was also removed as per suggested edit
            // } else {
            //     console.warn("window.electronAPI or getSettings function not available. Using default/empty companies.");
            //     // Fallback or development data if Electron API is not available
            //     setCompanies(['1. Стройэлемент (default)', '2. Пузиков Д.В (default)']);
            // }
        }
    }, [isOpen]);

    if (!isOpen) {
        return null;
    }

    // The hardcoded companies list is now removed, as it's fetched from settings
    // const companies = [
    //     '1. Стройэлемент',
    //     '2. Пузиков Д.В'
    // ];

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-select-company-content" onClick={e => e.stopPropagation()}>
                <h3 className="modal-select-company-title">Выберите компанию:</h3>
                <div className="company-options">
                    {companies.length > 0 ? (
                        companies.map((company, index) => (
                            <button
                                key={index}
                                className="btn btn-primary company-button"
                                onClick={() => onSelectCompany(company)}
                            >
                                {company}
                            </button>
                        ))
                    ) : (
                        <p>Компании не добавлены. Перейдите в настройки.</p>
                    )}
                </div>
                {/* Кнопка закрытия закомментирована, так как выбор обязателен - This comment is no longer fully accurate as the button is now active. */}
                <button onClick={onClose} className="btn btn-secondary close-button" style={{ marginTop: '1rem' }}>Закрыть</button>
            </div>
        </div>
    );
};

export default CompanySelectionModal;

