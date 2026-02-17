import React, { createContext, useContext, useState, useEffect } from 'react';

const ReconciliationContext = createContext();

export const ReconciliationProvider = ({ children }) => {
    const [selectedExcelPath, setSelectedExcelPath] = useState(null);
    const [reconFiles, setReconFiles] = useState([]);
    const [activeTab, setActiveTab] = useState('income');

    const value = {
        selectedExcelPath,
        setSelectedExcelPath,
        reconFiles,
        setReconFiles,
        activeTab,
        setActiveTab
    };

    return (
        <ReconciliationContext.Provider value={value}>
            {children}
        </ReconciliationContext.Provider>
    );
};

export const useReconciliationContext = () => {
    const context = useContext(ReconciliationContext);
    if (!context) {
        throw new Error('useReconciliationContext must be used within a ReconciliationProvider');
    }
    return context;
};
