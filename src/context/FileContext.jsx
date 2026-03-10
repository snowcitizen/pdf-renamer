// src/context/FileContext.jsx

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNotifications } from './NotificationContext.jsx';

/**
 * Контекст для управления состоянием файлов и папок.
 * Содержит логику инициализации папки, загрузки файлов и подписки на изменения файловой системы.
 */
const FileContext = createContext(null);

/**
 * Провайдер контекста файлов.
 * 
 * @param {Object} props - Пропсы провайдера
 * @param {React.ReactNode} props.children - Дочерние компоненты
 * @param {string} props.selectedCompany - Текущая выбранная компания
 * @param {boolean} props.isRenaming - Флаг, указывающий, идет ли процесс переименования
 * @param {boolean} props.isOrganizing - Флаг, указывающий, идет ли процесс организации файлов
 */
export const FileContextProvider = ({ children, selectedCompany, isRenaming = false, isOrganizing = false }) => {
    const { addNotification } = useNotifications();
    // === СОСТОЯНИЕ ===
    // Здесь хранится сырой список файлов и текущая папка.
    const [currentFolder, setCurrentFolder] = useState(null);
    const [currentPdfFiles, setCurrentPdfFiles] = useState([]);

    // === УТИЛИТЫ ДЛЯ ОБНОВЛЕНИЯ ФАЙЛОВ В ОДНОМ МЕСТЕ ===
    const sortFiles = (files) => {
        return [...files].sort((a, b) =>
            a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
        );
    };

    const updatePdfFileByPath = useCallback((filePath, patch) => {
        setCurrentPdfFiles(prev =>
            prev.map(f => (f.path === filePath ? { ...f, ...(typeof patch === 'function' ? patch(f) : patch) } : f))
        );
    }, []);

    const updatePdfFilesBulk = useCallback((updater) => {
        setCurrentPdfFiles(prev => updater(prev));
    }, []);

    const removePdfFilesByPaths = useCallback((paths) => {
        const set = new Set(paths);
        setCurrentPdfFiles(prev => prev.filter(f => !set.has(f.path)));
    }, []);

    // === ЛОГИКА ЗАГРУЗКИ ФАЙЛОВ ===
    const loadFilesFromFolder = useCallback(async (folderPath) => {
        if (!folderPath) {
            setCurrentFolder(null);
            setCurrentPdfFiles([]);
            return;
        }

        setCurrentFolder(folderPath);
        try {
            // Загрузка файлов
            const newFiles = (await window.electronAPI.getPdfFiles(folderPath))
                .map(file => ({
                    ...file,
                    // === ЕДИНЫЙ ОБЪЕКТ СОСТОЯНИЯ ДЛЯ РЕНЕЙМА И ОРГАНАЙЗЕРА ===
                    status: 'pending', // renamer: pending | renaming | success | error
                    errorMessage: null, // renamer optional
                    selectedType: '', // organizer
                    organizationStatus: 'pending', // organizer: pending | processing | failed | fading-out | moved
                    organizationErrorMessage: null, // organizer optional
                    isFadingOut: false, // organizer UI
                }));
            setCurrentPdfFiles(sortFiles(newFiles));
        } catch (e) {
            addNotification("error", `Ошибка при загрузке файлов: ${e.message}`);
        }
    }, [addNotification]);

    // === ЛОГИКА ИНИЦИАЛИЗАЦИИ ПАПКИ ===
    const initializeFolderAndFiles = useCallback(async (shouldSelectFolder = false) => {
        if (!selectedCompany) return;

        try {
            // 1. Получение пути папки
            let folderPath = await window.electronAPI.getCompanyTempPath(selectedCompany);

            // Если нужно принудительно выбрать или путь пуст
            if (!folderPath || folderPath.trim() === '' || shouldSelectFolder) {
                const result = await window.electronAPI.selectFolder();
                if (result && result.filePaths && result.filePaths.length > 0) {
                    folderPath = result.filePaths[0];
                } else if (typeof result === 'string') {
                    // Обработка случая если selectFolder возвращает строку пути напрямую
                    folderPath = result;
                }
            }

            if (folderPath) {
                // Подписываемся на изменения в этой папке
                await window.electronAPI.watchPath('temp', folderPath, { depth: 0 });
                // Вызываем загрузку файлов
                await loadFilesFromFolder(folderPath);
            }

        } catch (e) {
            addNotification("error", `Ошибка при инициализации данных: ${e.message}`);
        }
    }, [selectedCompany, addNotification, loadFilesFromFolder]);

    // Эффект для прослушивания событий вотчера
    useEffect(() => {
        const unsubscribe = window.electronAPI.on('watcher:change', ({ event, key, filePath, fileName }) => {
            if (key !== 'temp') return;

            if (event === 'file-added') {
                if (fileName.toLowerCase().endsWith('.pdf')) {
                    setCurrentPdfFiles(prev => {
                        // Проверяем, нет ли уже такого файла (чтобы избежать дублей)
                        if (prev.some(f => f.path === filePath)) return prev;
                        const newList = [...prev, {
                            name: fileName,
                            path: filePath,
                            status: 'pending',
                            errorMessage: null,
                            selectedType: '',
                            organizationStatus: 'pending',
                            organizationErrorMessage: null,
                            isFadingOut: false,
                        }];
                        return sortFiles(newList);
                    });
                }
            } else if (event === 'file-deleted') {
                setCurrentPdfFiles(prev => prev.filter(f => f.path !== filePath));
            } else if (event === 'file-changed') {
                // Можно добавить логику обновления, если нужно (например, mtime)
            }
        });

        return () => {
            unsubscribe();
        };
    }, []);

    // Инициализация при изменении компании
    useEffect(() => {
        initializeFolderAndFiles();

        // Подписываемся на архив компании при её выборе
        const setupArchiveWatcher = async () => {
            const archivePath = await window.electronAPI.getCompanyArchivePath(selectedCompany);
            if (archivePath) {
                await window.electronAPI.watchPath('archive', archivePath, { depth: 10 });
            }
        };
        setupArchiveWatcher();

        return () => {
            window.electronAPI.unwatchPath('temp');
            window.electronAPI.unwatchPath('archive');
        };
    }, [selectedCompany, initializeFolderAndFiles]);

    const value = {
        currentFolder,
        currentPdfFiles,
        setCurrentPdfFiles,
        updatePdfFileByPath,
        updatePdfFilesBulk,
        removePdfFilesByPaths,
        initializeFolderAndFiles,
        loadFilesFromFolder
    };

    return (
        <FileContext.Provider value={value}>
            {children}
        </FileContext.Provider>
    );
};

/**
 * Хук для доступа к контексту файлов.
 * @returns {{
 *   currentFolder: string | null,
 *   currentPdfFiles: Array<{path: string, name: string, status: string}>,
 *   initializeFolderAndFiles: Function,
 *   loadFilesFromFolder: Function
 * }}
 */
export const useFileContext = () => {
    const context = useContext(FileContext);
    if (!context) {
        throw new Error('useFileContext must be used within FileContextProvider');
    }
    return context;
};

export default FileContext;

