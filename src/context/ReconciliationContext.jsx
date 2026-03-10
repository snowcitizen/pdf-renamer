import React, { createContext, useContext, useState, useEffect } from 'react';

const ReconciliationContext = createContext();

export const ReconciliationProvider = ({ children, selectedCompany }) => {
    const [selectedExcelPath, setSelectedExcelPath] = useState(null);
    const [reconFiles, setReconFiles] = useState([]);
    const [activeTab, setActiveTab] = useState('income');
    const [isLoadingFiles, setIsLoadingFiles] = useState(false);

    // Сброс и загрузка при смене компании
    useEffect(() => {
        setSelectedExcelPath(null);
        setReconFiles([]);

        if (selectedCompany) {
            setIsLoadingFiles(true);
            window.electronAPI.findReconciliationFiles(selectedCompany).then(files => {
                setReconFiles(files);
                setIsLoadingFiles(false);
            });
        }
    }, [selectedCompany]);

    const value = {
        selectedExcelPath,
        setSelectedExcelPath,
        reconFiles,
        setReconFiles,
        activeTab,
        setActiveTab,
        isLoadingFiles,
        setIsLoadingFiles
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

