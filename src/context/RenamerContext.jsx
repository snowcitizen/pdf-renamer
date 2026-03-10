// src/context/RenamerContext.jsx
import React, { createContext, useContext, useState, useCallback } from 'react';

const RenamerContext = createContext();

// Добавляем состояние для хранения данных формы
const initialFormData = {
    reconNumber: '', // Добавляем поле для порядкового номера из сверки
    docDate: '',
    docType: '',
    docNumber: '',
    counterparty: '',
    originalCopy: ''
};

const createInitialSession = () => ({
    isOpen: false,
    file: null,
    formData: { ...initialFormData },
    onOverlaySuccess: null
});

export const RenamerProvider = ({ children }) => {
    // Две независимые сессии (Архив и Акты сверки)
    const [archiveSession, setArchiveSession] = useState(createInitialSession());
    const [reconSession, setReconSession] = useState(createInitialSession());

    // Универсальный метод открытия
    const openRenamer = useCallback((type, file, onSuccess) => {
        const updater = (prev) => ({
            ...prev,
            isOpen: true,
            file: file,
            onOverlaySuccess: onSuccess ? () => onSuccess : null,
            // Если открываем новый файл, сбрасываем или инициализируем форму
            formData: { ...initialFormData }
        });

        if (type === 'archive') setArchiveSession(updater);
        else setReconSession(updater);
    }, []);

    // Универсальный метод закрытия (без сброса данных)
    const closeRenamer = useCallback((type) => {
        const updater = (prev) => ({ ...prev, isOpen: false });

        // Мы НЕ сбрасываем file и formData здесь,
        // чтобы они сохранились при возврате на страницу
        if (type === 'archive') setArchiveSession(updater);
        else setReconSession(updater);
    }, []);

    // Универсальный метод сброса (полная очистка)
    const resetRenamerSession = useCallback((type) => {
        if (type === 'archive') setArchiveSession(createInitialSession());
        else setReconSession(createInitialSession());
    }, []);

    // Универсальный метод обновления данных формы
    const setRenamerFormData = useCallback((type, dataOrFn) => {
        const updater = (prev) => ({
            ...prev,
            formData: typeof dataOrFn === 'function' ? dataOrFn(prev.formData) : dataOrFn
        });
        if (type === 'archive') setArchiveSession(updater);
        else setReconSession(updater);
    }, []);

    // Метод для быстрого открытия оверлея, если файл уже выбран
    const showOverlay = useCallback((type) => {
        const updater = (prev) => {
            if (prev.file) return { ...prev, isOpen: true };
            return prev;
        };
        if (type === 'archive') setArchiveSession(updater);
        else setReconSession(updater);
    }, []);

    return (
        <RenamerContext.Provider value={{
            archiveSession,
            reconSession,
            openRenamer,
            closeRenamer,
            resetRenamerSession,
            setRenamerFormData,
            showOverlay
        }}>
            {children}
        </RenamerContext.Provider>
    );
};

export const useRenamer = () => useContext(RenamerContext);

