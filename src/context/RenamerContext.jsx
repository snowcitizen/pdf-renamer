// src/context/RenamerContext.jsx
import React, { createContext, useContext, useState, useCallback } from 'react';

const RenamerContext = createContext();

export const RenamerProvider = ({ children }) => {
    // Состояние для оверлей-режима (Архив)
    const [isOverlayOpen, setIsOverlayOpen] = useState(false);
    const [overlayFile, setOverlayFile] = useState(null);
    const [onOverlaySuccess, setOnOverlaySuccess] = useState(null);

    // Добавляем состояние для хранения данных формы
    const [overlayFormData, setOverlayFormData] = useState({
        docDate: '',
        docType: '',
        docNumber: '',
        counterparty: '',
        originalCopy: ''
    });

    const openArchiveRenamer = useCallback((file, onSuccess) => {
        // Если открываем новый файл, сбрасываем или инициализируем форму
        // Если тот же самый - можно оставить как есть
        setOverlayFile(file);
        setOnOverlaySuccess(() => onSuccess);
        setIsOverlayOpen(true);
    }, []);

    const closeArchiveRenamer = useCallback(() => {
        setIsOverlayOpen(false);
        // Мы НЕ сбрасываем overlayFile и overlayFormData здесь,
        // чтобы они сохранились при возврате на страницу
    }, []);

    const resetOverlaySession = useCallback(() => {
        setIsOverlayOpen(false);
        setOverlayFile(null);
        setOverlayFormData({
            docDate: '',
            docType: '',
            docNumber: '',
            counterparty: '',
            originalCopy: ''
        });
        setOnOverlaySuccess(null);
    }, []);

    const showOverlay = useCallback(() => {
        if (overlayFile) setIsOverlayOpen(true);
    }, [overlayFile]);

    return (
        <RenamerContext.Provider value={{
            isOverlayOpen,
            overlayFile,
            overlayFormData,
            setOverlayFormData,
            openArchiveRenamer,
            closeArchiveRenamer,
            resetOverlaySession,
            showOverlay,
            onOverlaySuccess
        }}>
            {children}
        </RenamerContext.Provider>
    );
};

export const useRenamer = () => useContext(RenamerContext);

