// src/hooks/useOrganizerFiles.js (Обновленный)

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useFileContext } from '../context/FileContext.jsx';

// ... (getMonthName остается) ...
const getMonthName = (monthNumber) => {
    const names = [
        'Январь', 'Февраль', 'Март', 'Апрель',
        'Май', 'Июнь', 'Июль', 'Август',
        'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
    ];
    return names[monthNumber - 1] || '';
};


/**
 * Хук для управления логикой упорядочивания файлов в FileOrganizer.
 */
const useOrganizerFiles = (addNotification, selectedCompany, setIsOrganizing) => {

    const {
        currentFolder,
        currentPdfFiles,
        updatePdfFilesBulk,
        removePdfFilesByPaths
    } = useFileContext();

    const [baseArchivePath, setBaseArchivePath] = useState(null);

    // === 2. ЗАГРУЗКА БАЗОВОГО ПУТИ АРХИВА ===
    useEffect(() => {
        if (window.electronAPI && window.electronAPI.getCompanyArchivePath) {
            window.electronAPI.getCompanyArchivePath(selectedCompany)
                .then(path => {
                    setBaseArchivePath(path);
                })
                .catch(error => {
                    console.error("Ошибка при получении базового пути:", error);
                    addNotification("error", "Ошибка при получении базового пути архива.");
                });
        }
    }, [addNotification, selectedCompany]);

    // === СОСТОЯНИЕ (СПЕЦИФИЧНОЕ ДЛЯ ORGANIZER) ===
    // Сначала определяем функцию, потом используем её в useMemo
    const getSuggestedPath = useCallback((file) => {
        const type = file.selectedType || '';
        const dateMatch = file.name.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
        let suggestedPath = '';

        if (dateMatch && type && baseArchivePath && selectedCompany) {
            const month = parseInt(dateMatch[2], 10);
            const year = parseInt(dateMatch[3], 10);

            const quarter = Math.ceil(month / 3);
            const monthNamePadded = `${String(month).padStart(2, '0')} ${getMonthName(month)}`;

            let baseFolder = type;
            if (type === 'Поступления') {
                baseFolder = `1. ПОСТУПЛЕНИЯ`;
            } else if (type === 'Реализации') {
                baseFolder = `2. РЕАЛИЗАЦИИ`;
            }
            const quarterFolder = `${quarter} Квартал`;
            const monthFolder = `${monthNamePadded}`;

            const basePath = String(baseArchivePath);
            const basePathClean = basePath.endsWith('\\') ? basePath.slice(0, -1) : basePath;

            suggestedPath = `${basePathClean}\\${baseFolder}\\${year}\\${quarterFolder}\\${monthFolder}`;
        }
        return suggestedPath;
    }, [baseArchivePath, selectedCompany]);

    const organizedFiles = useMemo(() => {
        return (currentPdfFiles || []).map(f => ({
            ...f,
            suggestedPath: getSuggestedPath(f)
        })).filter(f => f.organizationStatus !== 'fading-out' && f.organizationStatus !== 'moved');
    }, [currentPdfFiles, getSuggestedPath]);


    // === 4. ОБРАБОТЧИК ИЗМЕНЕНИЯ ТИПА ФАЙЛА ===
    const handleFileTypeChange = useCallback((filePath, newType) => {
        updatePdfFilesBulk(prev => prev.map(file => {
            if (file.path !== filePath) return file;
            const typeToSet = file.selectedType === newType ? '' : newType;
            return { ...file, selectedType: typeToSet };
        }));
    }, [updatePdfFilesBulk]);

    // === ОБРАБОТЧИКИ (ACTIONS) ===
    const handleOrganizeFiles = useCallback(async () => {
        setIsOrganizing(true);
        const filesToProcess = organizedFiles.filter(file => file.selectedType && file.suggestedPath && file.organizationStatus !== 'moved' && file.organizationStatus !== 'fading-out');

        if (filesToProcess.length === 0) {
            addNotification('error', 'Нет файлов для упорядочивания или не выбран тип.');
            setIsOrganizing(false);
            return;
        }

        // Обновляем статус на processing (в общем массиве)
        const processSet = new Set(filesToProcess.map(f => f.path));
        updatePdfFilesBulk(prev => prev.map(file => (
            processSet.has(file.path)
                ? { ...file, organizationStatus: 'processing', organizationErrorMessage: null }
                : file
        )));

        const ipcFriendlyFiles = filesToProcess.map(f => ({
            path: f.path,
            suggestedPath: f.suggestedPath
        }));

        try {
            const result = await window.electronAPI.organizeFiles(ipcFriendlyFiles);

            let allMovedSuccessfully = true;
            let anyMoved = false;

            const resultsMap = new Map(result.results.map(res => [res.oldPath, res]));
            const filesToAnimate = [];

            filesToProcess.forEach(file => {
                const foundResult = resultsMap.get(file.path);
                if (foundResult) {
                    if (foundResult.success) {
                        anyMoved = true;
                        addNotification('success', <span><strong>{file.name}</strong><br></br>Файл успешно перенесен</span>, file.suggestedPath);
                        filesToAnimate.push(file.path);
                    } else {
                        allMovedSuccessfully = false;
                        addNotification('error', <span>Ошибка переноса<br></br><strong>{file.name}</strong></span>, foundResult.message);
                    }
                }
            });

            // ... (остаток логики анимации и удаления) ...
            const animateSet = new Set(filesToAnimate);
            updatePdfFilesBulk(prev => prev.map(file => {
                const path = file.path;
                const isSuccessful = animateSet.has(path);
                const hasFailed = resultsMap.has(path) && !resultsMap.get(path).success;

                if (isSuccessful) {
                    return { ...file, organizationStatus: 'fading-out', isFadingOut: true };
                }
                if (hasFailed) {
                    const message = resultsMap.get(path).message;
                    return { ...file, organizationStatus: 'failed', organizationErrorMessage: message, isFadingOut: false };
                }
                return file;
            }));

            if (filesToAnimate.length > 0) {
                setTimeout(() => {
                    removePdfFilesByPaths(filesToAnimate);
                }, 500);
            }

            /*if (allMovedSuccessfully && anyMoved) {
                addNotification('success', 'Все выбранные файлы успешно упорядочены!');
            } else if (!allMovedSuccessfully && anyMoved) {
                addNotification('warning', 'Некоторые файлы упорядочены с ошибками.');
            }*/

        } catch (error) {
            addNotification('error', `Непредвиденная ошибка при упорядочивании: ${error.message}`);
        } finally {
            setIsOrganizing(false);
        }
    }, [organizedFiles, setIsOrganizing, addNotification, updatePdfFilesBulk, removePdfFilesByPaths]);

    // Вспомогательный флаг для кнопки
    const hasFilesToOrganize = organizedFiles.some(file => file.selectedType && file.suggestedPath && file.organizationStatus !== 'moved' && file.organizationStatus !== 'fading-out');

    return {
        organizedFiles,
        currentFolder,
        getSuggestedPath,
        handleFileTypeChange,
        handleOrganizeFiles,
        hasFilesToOrganize,
    };
};

export default useOrganizerFiles;