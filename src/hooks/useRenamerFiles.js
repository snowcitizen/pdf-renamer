// src/hooks/useRenamerFiles.js (Обновленный)

import { useState, useEffect, useCallback, useRef } from 'react';
import { useFileContext } from '../context/FileContext.jsx';

/**
 * Хук для управления всеми асинхронными операциями, связанными с переименованием.
 */
const useRenamerFiles = (selectedCompany, showStatus, setIsRenamingGlobal) => {
    const [isRenamingLocal, setIsRenamingLocal] = useState(false); // Declare isRenamingLocal
    const isRenamingRef = useRef(isRenamingLocal); // Declare isRenamingRef

    useEffect(() => {
        isRenamingRef.current = isRenamingLocal;
    }, [isRenamingLocal]);

    const {
        currentFolder,
        currentPdfFiles,
        setCurrentPdfFiles
    } = useFileContext();

    // === СОСТОЯНИЕ (СПЕЦИФИЧНОЕ ДЛЯ RENAME) ===
    const [selectedFile, setSelectedFile] = useState(null);
    const [loadedCounterparties, setLoadedCounterparties] = useState([]);

    // === 1. ЗАГРУЗКА КОНТРАГЕНТОВ (Остается) ===
    useEffect(() => {
        // ... (логика загрузки контрагентов остается прежней) ...
        const fetchCounterparties = async () => {
            try {
                const counterparties = await window.electronAPI.getCounterparties();
                setLoadedCounterparties(counterparties);
            } catch (error) {
                console.error("Ошибка загрузки контрагентов:", error);
                showStatus("Ошибка загрузки списка контрагентов.", "error");
            }
        };
        fetchCounterparties();
    }, [showStatus]);

    // === 2. ОБРАБОТЧИК ПЕРЕИМЕНОВАНИЯ ФАЙЛА ===
    const renameFileHandler = useCallback(async (
        filePath,
        newName,
        onSuccess,
        onError
    ) => {
        setIsRenamingGlobal(true);
        setIsRenamingLocal(true);
        try {
            const result = await window.electronAPI.renameFile(filePath, newName);

            if (result.success) {
                onSuccess(result.newPath);
            } else {
                onError(result.message);
            }
        } catch (error) {
            onError(`Непредвиденная ошибка: ${error.message}`);
        } finally {
            setIsRenamingGlobal(false);
            setIsRenamingLocal(false);
        }
    }, [setIsRenamingGlobal]);


    return {
        currentPdfFiles,
        selectedFile,
        loadedCounterparties,
        currentFolder,
        setCurrentPdfFiles,
        setSelectedFile,
        renameFileHandler,
    };
};

export default useRenamerFiles;