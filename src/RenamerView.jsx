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

    // Логика парсинга имени файла (остается здесь, так как это логика формы)
    const parseFileNameAndPopulateFields = useCallback((fileName) => {
        if (!fileName) {
            setDocDate("");
            setDocType("");
            setDocNumber("");
            setCounterparty("");
            setOriginalCopy("");
            return;
        }

        let raw = fileName.replace(/\.pdf$/i, "")
            .replace(/\u00A0/g, " ")
            .trim()
            .replace(/\s+/g, " ");

        let parsedDate = "";
        let parsedType = "";
        let parsedNumber = "";
        let parsedCounterparty = "";
        let parsedOriginalCopy = "";

        // 1) О/К надёжнее
        let m = raw.match(/\s*-\s*([ОК])\s*$/i);
        if (m) {
            parsedOriginalCopy = m[1].toUpperCase();
            raw = raw.slice(0, m.index).trim().replace(/\s+/g, " ");
        } else {
            m = raw.match(/\s([ОК])\s*$/i);
            if (m) {
                parsedOriginalCopy = m[1].toUpperCase();
                raw = raw.slice(0, m.index).trim().replace(/\s+/g, " ");
            }
        }

        // 2) Разбиваем
        let parts = raw.length ? raw.split(" ") : [];

        // 3) Поиск даты
        const months = {
            "января": "01", "январь": "01", "февраля": "02", "февраль": "02",
            "марта": "03", "март": "03", "апреля": "04", "апрель": "04",
            "мая": "05", "май": "05", "июня": "06", "июнь": "06",
            "июля": "07", "июль": "07", "августа": "08", "август": "08",
            "сентября": "09", "сентябрь": "09", "октября": "10", "октябрь": "10",
            "ноября": "11", "ноябрь": "11", "декабря": "12", "декабрь": "12"
        };
        const digitalRegex = /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})(г|г\.|года)?$/i;

        for (let i = 0; i < parts.length; i++) {
            const match = parts[i].match(digitalRegex);
            if (match) {
                const day = match[1].padStart(2, "0");
                const month = match[2].padStart(2, "0");
                let year = match[3];
                if (year.length === 2) year = "20" + year;
                parsedDate = `${year}-${month}-${day}`;
                parts.splice(i, 1);
                break;
            }
        }

        if (!parsedDate) {
            for (let i = 0; i < parts.length - 2; i++) {
                let day = parts[i].padStart(2, "0");
                let mon = parts[i + 1].toLowerCase();
                let month = months[mon];
                if (!month) continue;

                let yearRaw = parts[i + 2].toLowerCase();
                let yearMatch = yearRaw.match(/^(\d{2}|\d{4})(г|г\.|года)?$/);
                if (!yearMatch) continue;

                let year = yearMatch[1];
                if (year.length === 2) year = "20" + year;

                parsedDate = `${year}-${month}-${day}`;
                parts.splice(i, 3);
                break;
            }
        }

        // 4) Тип документа
        const docTypes = settings.docTypes;
        for (let i = 0; i < parts.length; i++) {
            const found = docTypes.find(dt => dt.toLowerCase() === parts[i].toLowerCase());
            if (found) {
                parsedType = found;
                parts.splice(i, 1);
                break;
            }
        }

        // 5) Номер
        let numberIndex = parts.findIndex(p => p === "№");
        if (numberIndex !== -1 && parts[numberIndex + 1]) {
            parsedNumber = parts[numberIndex + 1].replace(/[.,;:]$/, "");
            parts.splice(numberIndex, 2);
        } else {
            const compactIndex = parts.findIndex(p => /^№\S+/i.test(p));
            if (compactIndex !== -1) {
                parsedNumber = parts[compactIndex].slice(1).replace(/[.,;:]$/, "");
                parts.splice(compactIndex, 1);
            }
        }

        // 6) Контрагент
        const LEGAL_FORMS = settings.legalForms;
        let candidate = parts.join(" ").trim().replace(/\s+/g, " ");

        if (candidate) {
            const normCandidateWords = candidate
                .toLowerCase()
                .split(" ")
                .filter(w => w && !LEGAL_FORMS.includes(w));

            let bestMatch = "";
            let bestScorePercent = 0;

            for (let c of loadedCounterparties) {
                const normCWords = String(c)
                    .toLowerCase()
                    .split(" ")
                    .filter(w => w && !LEGAL_FORMS.includes(w));

                const commonCount = normCandidateWords.filter(w => normCWords.includes(w)).length;
                const scorePercent = (commonCount / normCandidateWords.length) * 100;

                if (scorePercent > bestScorePercent) {
                    bestScorePercent = scorePercent;
                    bestMatch = c;
                }
            }
            if (bestScorePercent > 50) {
                parsedCounterparty = bestMatch;
            }
        }


        // 7) Устанавливаем
        setDocDate(parsedDate);
        setDocType(parsedType || "");
        setDocNumber(parsedNumber || "");
        setCounterparty(parsedCounterparty || "");
        setOriginalCopy(parsedOriginalCopy || "");
    }, [loadedCounterparties, settings.docTypes, settings.legalForms]); // Зависимость теперь от состояния, возвращаемого хуком и настроек


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


    // Эффект для предпросмотра нового имени файла (зависит от полей формы)
    useEffect(() => {
        const date = docDate ? new Date(docDate) : null;
        const docTypeVal = docType;
        const docNumberVal = docNumber.trim();
        const counterpartyVal = counterparty.trim();
        const originalCopyVal = originalCopy;

        let newNameParts = [];

        if (date && !isNaN(date)) {
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            newNameParts.push(`${day}.${month}.${year}`);
        }

        if (docTypeVal) {
            newNameParts.push(docTypeVal);
        }
        if (docNumberVal) {
            newNameParts.push(`№${docNumberVal}`);
        }
        if (counterpartyVal) {
            newNameParts.push(counterpartyVal);
        }
        if (originalCopyVal) {
            newNameParts.push(`- ${originalCopyVal}`);
        }

        let newName = newNameParts.join(' ');
        if (newName && newName.trim() !== '') {
            setNewFileNamePreview(newName + '.pdf');
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




