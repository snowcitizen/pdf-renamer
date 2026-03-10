// src/RenamerView.jsx
// Компонент для вида переименования файлов
// Теперь управляет только локальным состоянием формы и UI.

import React, { useState, useEffect, useCallback, useRef } from 'react';

// Импорт хука
import useRenamerFiles from './hooks/useRenamerFiles.js';

import './styles/renamer.css';
import PdfViewer from "./components/PdfViewer.jsx";
import FileList from "./components/FileList.jsx";
import RenamerSection from "./components/RenamerSection.jsx";

import { useNotifications } from './context/NotificationContext.jsx';
import { useSettings } from './context/SettingsContext.jsx';
import { parseFileName, generateNewFileName } from './utils/renamerUtils.js';

const RenamerView = ({
    selectedCompany,
    setIsRenaming, // Функция обновления глобального флага из App.jsx
}) => {
    const { addNotification } = useNotifications();
    const { settings } = useSettings();

    // === ИСПОЛЬЗУЕМ ХУК ДЛЯ ВСЕЙ ЛОГИКИ ФАЙЛОВ ===
    const {
        currentPdfFiles,
        selectedFile,
        loadedCounterparties,
        setCurrentPdfFiles,
        setSelectedFile,
        renameFileHandler,
    } = useRenamerFiles(selectedCompany, addNotification, setIsRenaming);
    // ============================================

    // === ЛОКАЛЬНОЕ СОСТОЯНИЕ ФОРМЫ ===
    const [docDate, setDocDate] = useState('');
    const [docType, setDocType] = useState('');
    const [docNumber, setDocNumber] = useState('');
    const [counterparty, setCounterparty] = useState('');
    const [originalCopy, setOriginalCopy] = useState('');
    const [newFileNamePreview, setNewFileNamePreview] = useState('Заполните поля для формирования имени');

    const docDateInputRef = useRef(null);
    const fileListRef = useRef(null);

    const [focusedFieldId, setFocusedFieldId] = useState(null);

    const handleFocus = (event) => { setFocusedFieldId(event.target.id); };
    const handleBlur = () => { setFocusedFieldId(null); };

    // === ЛОГИКА ФОРМЫ: ПАРСИНГ И СБРОС ===

    const resetFormState = useCallback(() => {
        setDocDate('');
        setDocType('');
        setDocNumber('');
        setCounterparty('');
        setOriginalCopy('');
        setNewFileNamePreview('Заполните поля для формирования имени');
    }, []);

    // Логика парсинга имени файла (теперь использует утилиту)
    const parseFileNameAndPopulateFields = useCallback((fileName) => {
        const parsed = parseFileName(
            fileName,
            settings.docTypes,
            settings.legalForms,
            loadedCounterparties
        );

        setDocDate(parsed.docDate);
        setDocType(parsed.docType);
        setDocNumber(parsed.docNumber);
        setCounterparty(parsed.counterparty);
        setOriginalCopy(parsed.originalCopy);
    }, [loadedCounterparties, settings.docTypes, settings.legalForms]);


    // Эффект для заполнения формы при выборе файла
    useEffect(() => {
        if (selectedFile) {
            parseFileNameAndPopulateFields(selectedFile.name);
            if (docDateInputRef.current) {
                docDateInputRef.current.focus();
            }
        } else {
            resetFormState();
        }
    }, [selectedFile, parseFileNameAndPopulateFields, resetFormState]);


    // Эффект для предпросмотра нового имени файла (теперь использует утилиту)
    useEffect(() => {
        const newName = generateNewFileName({ docDate, docType, docNumber, counterparty, originalCopy });
        if (newName) {
            setNewFileNamePreview(newName);
        } else {
            setNewFileNamePreview('Заполните поля для формирования имени');
        }
    }, [docDate, docType, docNumber, counterparty, originalCopy]);


    const handleFileSelect = (file) => {
        setSelectedFile(file);
    };

    const handleDeleteFile = async () => {
        if (!selectedFile) return;

        const result = await window.electronAPI.deleteFile(selectedFile.path);

        if (result.success) {
            const deletedPath = selectedFile.path;

            // 1. Находим следующий файл перед тем как удалить текущий из списка
            const currentFileIndex = currentPdfFiles.findIndex(file => file.path === deletedPath);
            let nextFile = null;
            if (currentFileIndex !== -1 && currentFileIndex + 1 < currentPdfFiles.length) {
                nextFile = currentPdfFiles[currentFileIndex + 1];
            }

            // 2. Удаляем из локального списка
            setCurrentPdfFiles(prevFiles => prevFiles.filter(f => f.path !== deletedPath));

            // 3. Выбираем следующий или сбрасываем
            if (nextFile) {
                setSelectedFile(nextFile);
            } else {
                setSelectedFile(null);
                resetFormState();
            }

            addNotification('success', <span><strong>{selectedFile.name}</strong><br></br>успешно перемещен в корзину</span>);
        } else if (result.message !== 'Удаление отменено') {
            addNotification('error', `Ошибка при удалении: ${result.message}`);
        }
    };


    // === ОБРАБОТЧИК ПЕРЕИМЕНОВАНИЯ ===
    const handleRenameFile = async () => {
        if (!selectedFile) {
            addNotification('error', 'Файл для переименования не выбран.');
            return;
        }

        const newName = newFileNamePreview;
        if (!newName || newName === 'Заполните поля для формирования имени') {
            addNotification('error', 'Новое имя файла не сформировано. Заполните все поля.');
            return;
        }

        if (!docDate || !docType || !docNumber || !counterparty || !originalCopy) {
            addNotification('error', 'Заполните все поля перед переименованием.');
            return;
        }

        const oldFileName = selectedFile.name;
        const oldFilePath = selectedFile.path;

        // 1. Обновляем статус выбранного файла на "renaming"
        setCurrentPdfFiles(prevFiles =>
            prevFiles.map(file =>
                file.path === oldFilePath ? { ...file, status: 'renaming' } : file
            )
        );

        // 2. Вызываем асинхронный обработчик переименования
        await renameFileHandler(
            oldFilePath,
            newName,
            // onSuccess callback
            (newPath) => {
                // 2a. Обновляем локальный список файлов с новым именем и статусом
                setCurrentPdfFiles(prevFiles => {
                    return prevFiles.map(file =>
                        file.path === oldFilePath
                            ? { ...file, name: newName, path: newPath, status: 'success' }
                            : file
                    );
                });

                // 2b. Логика перехода к следующему файлу и уведомлений
                const currentFileIndex = currentPdfFiles.findIndex(file => file.path === oldFilePath);

                if (currentFileIndex !== -1 && currentFileIndex + 1 < currentPdfFiles.length) {
                    const nextFile = currentPdfFiles[currentFileIndex + 1];
                    setSelectedFile(nextFile);

                    if (fileListRef.current && fileListRef.current.scrollToSelected) {
                        fileListRef.current.scrollToSelected();
                    }

                    addNotification('success', <span><strong>{oldFileName}</strong><br></br>успешно переименован в<br></br><strong>{newName}</strong></span>);
                } else {
                    setSelectedFile(null);
                    resetFormState();
                    addNotification('success', <span><strong>{oldFileName}</strong><br></br>успешно переименован в<br></br><strong>{newName}</strong></span>);
                }
            },
            // onError callback
            (errorMessage) => {
                setCurrentPdfFiles(prevFiles =>
                    prevFiles.map(file =>
                        file.path === oldFilePath ? { ...file, status: 'error' } : file
                    )
                );
                // Ошибка при переименовании
                addNotification('error', <span><strong>{oldFileName}</strong>:<br></br>{errorMessage}</span>);
            }
        );
    };



    // === ЛОГИКА UI: ОБРАБОТКА ENTER И ФОКУСОВ ===
    const handleEnterKey = useCallback((event) => {
        // ... (логика обработки Enter, как в предыдущем ответе) ...
        if (event.key === 'Enter') {
            event.preventDefault();

            if (event.target.id === 'rename-btn') {
                event.target.click();
                return;
            }

            if (event.target.id === 'doc-date') {
                const parts = docDate.split('-');
                if (parts.length === 3 && parts[0].length === 4 && parts[0].startsWith('00')) {
                    const newYear = `20${parts[0].substring(2)}`;
                    setDocDate(`${newYear}-${parts[1]}-${parts[2]}`);
                }
            }

            const formControls = Array.from(document.querySelectorAll('.form-control, #rename-btn'));
            const currentElement = event.target;
            const currentIndex = formControls.indexOf(currentElement);

            if (currentIndex !== -1 && currentIndex < formControls.length - 1) {
                const nextElement = formControls[currentIndex + 1];
                if (nextElement) {
                    nextElement.focus();
                }
            }
        }
    }, [docDate]);

    useEffect(() => {
        const formControls = document.querySelectorAll('.form-control, #rename-btn');
        formControls.forEach(element => {
            element.addEventListener('keydown', handleEnterKey);
            element.addEventListener('focus', handleFocus);
            element.addEventListener('blur', handleBlur);
        });
        return () => {
            formControls.forEach(element => {
                element.removeEventListener('keydown', handleEnterKey);
                element.removeEventListener('focus', handleFocus);
                element.removeEventListener('blur', handleBlur);
            });
        };
    }, [handleEnterKey]);

    return (
        <>
            {/* Левая панель - Просмотр PDF */}
            <div className="panel left-panel">
                <PdfViewer
                    selectedFile={selectedFile}
                />
            </div>
            {/* Правая панель - Список файлов и форма переименования */}
            <div className="panel right-panel">

                <FileList
                    ref={fileListRef}
                    selectedFile={selectedFile}
                    currentPdfFiles={currentPdfFiles}
                    handleFileSelect={handleFileSelect}
                />

                <RenamerSection
                    selectedFile={selectedFile}
                    docDate={docDate}
                    setDocDate={setDocDate}
                    docType={docType}
                    setDocType={setDocType}
                    docNumber={docNumber}
                    setDocNumber={setDocNumber}
                    counterparty={counterparty}
                    setCounterparty={setCounterparty}
                    originalCopy={originalCopy}
                    setOriginalCopy={setOriginalCopy}
                    newFileNamePreview={newFileNamePreview}
                    handleRenameFile={handleRenameFile}
                    handleDeleteFile={handleDeleteFile}
                    docDateInputRef={docDateInputRef}
                    loadedCounterparties={loadedCounterparties}
                />
            </div>
        </>
    );
};

export default RenamerView;

