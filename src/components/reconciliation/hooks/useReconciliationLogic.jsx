import { useState, useEffect, useCallback, useRef } from 'react';
// Импортируем getReconciliationStatus
import { reconcileData, getReconciliationStatus, normalize, isFileMatchRow } from '../reconciliationUtils';
import { useNotifications } from '../../../context/NotificationContext.jsx';

export const useReconciliationLogic = (isVisible, excelFilePath) => {
    const { addNotification } = useNotifications();
    const [data, setData] = useState({
        reconciledPdfFiles: [],
        unreconciledPdfFiles: [],
        copyPdfFiles: []
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [originalExcelRows, setOriginalExcelRows] = useState([]);

    // Новые состояния для переименования
    const [isRenaming, setIsRenaming] = useState(false);
    const [renameErrors, setRenameErrors] = useState([]);
    // Предполагается, что Electron API вернет директорию PDF-файлов
    const [pdfDirectory, setPdfDirectory] = useState('');

    // Рефы для работы вотчера без переподписок
    const dataRef = useRef(data);
    const pdfDirectoryRef = useRef(pdfDirectory);
    const originalExcelRowsRef = useRef(originalExcelRows);

    useEffect(() => { dataRef.current = data; }, [data]);
    useEffect(() => { pdfDirectoryRef.current = pdfDirectory; }, [pdfDirectory]);
    useEffect(() => { originalExcelRowsRef.current = originalExcelRows; }, [originalExcelRows]);


    // Состояния для Drag and Drop
    const [activeId, setActiveId] = useState(null);
    const [hoveredRow, setHoveredRow] = useState(null);

    // Функция обновления статуса строки
    const updateStatus = useCallback((row) => {
        if (!row) return;
        // Используем content для проверки статуса, так как он содержит имя файла
        const matchedFileContents = row.matchedFiles.map(f => f.content);
        // Вызываем функцию из reconciliationUtils
        row.status = getReconciliationStatus(matchedFileContents, row.number);
    }, []);

    const findContainer = useCallback((id) => {
        if (String(id) === 'unreconciled-files') return 'unreconciled-files';
        if (data.reconciledPdfFiles.find(item => String(item.number) === String(id))) return String(id);
        return null;
    }, [data.reconciledPdfFiles]);

    const getActiveItem = useCallback(() => {
        if (!activeId) return null;
        const unmatched = data.unreconciledPdfFiles.find(f => f.id === activeId);
        if (unmatched) return { ...unmatched, containerId: 'unreconciled-files' };
        for (const row of data.reconciledPdfFiles) {
            const f = row.matchedFiles.find(ff => ff.id === activeId);
            if (f) return { ...f, containerId: row.number };
        }
        return null;
    }, [activeId, data.reconciledPdfFiles, data.unreconciledPdfFiles]);

    useEffect(() => {
        if (isVisible && excelFilePath) {
            // --- НОВАЯ ЛОГИКА: Вычисление pdfDirectory из excelFilePath ---
            const getDirectoryFromPath = (fullPath) => {
                if (!fullPath) return '';

                // Нормализуем разделители для корректной работы с lastIndexOf (на Windows будет работать с \ или /)
                const normalizedPath = fullPath.replace(/\\/g, '/');

                // Находим индекс последнего разделителя
                const lastSeparatorIndex = normalizedPath.lastIndexOf('/');

                if (lastSeparatorIndex === -1) {
                    return ''; // Директория не найдена
                }

                // Возвращаем путь к папке, включая разделитель в конце (например: "N:/.../07 Июль/")
                return normalizedPath.substring(0, lastSeparatorIndex + 1);
            };

            const derivedPdfDirectory = getDirectoryFromPath(excelFilePath);
            setPdfDirectory(derivedPdfDirectory);
            // --- КОНЕЦ НОВОЙ ЛОГИКИ ---

            const loadData = async () => {
                try {
                    setIsLoading(true);
                    setError(null);
                    // Вызываем Electron API, передавая только путь к Excel
                    const result = await window.electronAPI.getSourceDataForReconciliation(excelFilePath);

                    if (result.success) {
                        setOriginalExcelRows(result.excelRows);
                        const { reconciledData, unmatchedFiles, copies } = reconcileData(result.excelRows, result.pdfFiles);


                        // Инициализируем данные для DND и рассчитываем статус
                        const processedReconciledData = reconciledData.map(item => {
                            const row = {
                                ...item,
                                matchedFiles: item.matchedFiles.map(file => ({
                                    id: file,
                                    content: file,
                                    type: 'matched'
                                })),
                            };
                            updateStatus(row); // Расчет и установка статуса
                            return row;
                        });

                        setData({
                            reconciledPdfFiles: processedReconciledData,
                            unreconciledPdfFiles: unmatchedFiles.map(file => ({ id: file, content: file, type: 'unmatched' })),
                            copyPdfFiles: copies.map(file => ({ id: file, content: file, type: 'copy' }))
                        });
                    } else {
                        setError(result.message);
                    }
                } catch (err) {
                    setError('Ошибка загрузки данных: ' + err.message);
                } finally {
                    setIsLoading(false);
                }
            };
            loadData();
        }
    }, [isVisible, excelFilePath, updateStatus]);

    // Эффект для синхронизации файлов в реальном времени (watcher)
    useEffect(() => {
        if (!isVisible || !excelFilePath) return;

        const unsubscribe = window.electronAPI.on('watcher:change', ({ event, key, filePath, fileName }) => {
            // Файлы сверки всегда в архиве
            if (key !== 'archive') return;

            const currentDir = pdfDirectoryRef.current;
            if (!currentDir) return;

            // Проверяем, что файл относится к текущей папке сверки
            // Используем нормализованные пути для сравнения
            const normFilePath = filePath.replace(/\\/g, '/').toLowerCase();
            const normCurrentDir = currentDir.replace(/\\/g, '/').toLowerCase();

            // Если это не наш файл (не начинается с пути папки или не PDF)
            if (!normFilePath.startsWith(normCurrentDir)) return;
            if (!fileName.toLowerCase().endsWith('.pdf') && event !== 'file-deleted' && event !== 'dir-deleted') return;

            setData(prevData => {
                const newData = JSON.parse(JSON.stringify(prevData));

                if (event === 'file-deleted' || event === 'dir-deleted') {
                    let changed = false;

                    // 1. Удаляем из несопоставленных
                    const oldUnmatchedLen = newData.unreconciledPdfFiles.length;
                    newData.unreconciledPdfFiles = newData.unreconciledPdfFiles.filter(f => f.id !== fileName);
                    if (newData.unreconciledPdfFiles.length !== oldUnmatchedLen) changed = true;

                    // 2. Удаляем из копий
                    const oldCopiesLen = newData.copyPdfFiles.length;
                    newData.copyPdfFiles = newData.copyPdfFiles.filter(f => f.id !== fileName);
                    if (newData.copyPdfFiles.length !== oldCopiesLen) changed = true;

                    // 3. Удаляем из сопоставленных
                    newData.reconciledPdfFiles.forEach(row => {
                        const oldMatchedLen = row.matchedFiles.length;
                        row.matchedFiles = row.matchedFiles.filter(f => f.id !== fileName);
                        if (row.matchedFiles.length !== oldMatchedLen) {
                            updateStatus(row);
                            changed = true;
                        }
                    });

                    return changed ? newData : prevData;
                }

                if (event === 'file-added') {
                    // Проверка на дубликаты (уже есть в любом из списков)
                    const isDuplicate =
                        newData.unreconciledPdfFiles.some(f => f.id === fileName) ||
                        newData.copyPdfFiles.some(f => f.id === fileName) ||
                        newData.reconciledPdfFiles.some(r => r.matchedFiles.some(f => f.id === fileName));

                    if (isDuplicate) return prevData;

                                        // Пытаемся автоматически сопоставить новый файл
                    let matched = false;

                    for (const row of newData.reconciledPdfFiles) {
                        const origRow = originalExcelRowsRef.current.find(r => String(r.number) === String(row.number));
                        
                        if (origRow && isFileMatchRow(fileName, origRow)) {
                            row.matchedFiles.push({ id: fileName, content: fileName, type: 'matched' });
                            updateStatus(row);
                            matched = true;
                            break;
                        }
                    }

                    if (!matched) {
                        newData.unreconciledPdfFiles.push({ id: fileName, content: fileName, type: 'unmatched' });
                    }
                    return newData;
                }

                return prevData;
            });
        });

        return () => unsubscribe();
    }, [isVisible, excelFilePath, updateStatus]);

    // --- ЛОГИКА DRAG & DROP ---


    const handleDragStart = useCallback((event) => {
        setActiveId(event.active.id);
        setHoveredRow(null);
    }, []);

    const handleDragOver = useCallback(({ over }) => {
        if (!over) {
            setHoveredRow(null);
            return;
        }
        const overId = over.id;
        if (String(overId) === 'unreconciled-files') {
            setHoveredRow('unreconciled-files');
            return;
        }
        const parentRow = data.reconciledPdfFiles.find(row => row.matchedFiles.some(f => f.id === overId));
        if (parentRow) {
            setHoveredRow(parentRow.number);
            return;
        }
        const rowById = data.reconciledPdfFiles.find(row => String(row.number) === String(overId));
        if (rowById) {
            setHoveredRow(rowById.number);
            return;
        }
        setHoveredRow(null);
    }, [data.reconciledPdfFiles]);

    const handleDragEnd = useCallback(({ active, over }) => {
        const activeIdLocal = active.id;
        const overId = over?.id;
        const activeContainer = active.data.current?.containerId;
        const overContainer = findContainer(overId) || over?.data.current?.containerId;

        if (!overContainer || !activeIdLocal) {
            setActiveId(null);
            setHoveredRow(null);
            return;
        }

        const newData = JSON.parse(JSON.stringify(data));
        let activeFile = null;
        let sourceRow = null;
        let targetRow = null;

        if (activeContainer === 'unreconciled-files') {
            const fileIndex = newData.unreconciledPdfFiles.findIndex(f => f.id === activeIdLocal);
            if (fileIndex !== -1) {
                activeFile = newData.unreconciledPdfFiles.splice(fileIndex, 1)[0];
            }
        } else {
            sourceRow = newData.reconciledPdfFiles.find(r => String(r.number) === String(activeContainer));
            const fileIndex = sourceRow?.matchedFiles.findIndex(f => f.id === activeIdLocal);
            if (sourceRow && fileIndex !== -1) {
                activeFile = sourceRow.matchedFiles.splice(fileIndex, 1)[0];
            }
        }

        if (!activeFile) {
            setActiveId(null);
            setHoveredRow(null);
            return;
        }

        if (overContainer === 'unreconciled-files') {
            newData.unreconciledPdfFiles.push(activeFile);
        } else {
            targetRow = newData.reconciledPdfFiles.find(r => String(r.number) === String(overContainer));
            targetRow?.matchedFiles.push(activeFile);
        }

        updateStatus(sourceRow);
        updateStatus(targetRow);

        setData(newData);
        setActiveId(null);
        setHoveredRow(null);
    }, [data, findContainer, updateStatus]);

    const handleDragCancel = useCallback(() => {
        setActiveId(null);
        setHoveredRow(null);
    }, []);

    // --- ЛОГИКА ПЕРЕИМЕНОВАНИЯ (обновлена) ---
    const handleRenameFiles = useCallback(async () => {
        if (!pdfDirectory) {
            setError('Не удалось выполнить переименование: не определена директория PDF-файлов.');
            return;
        }

        // Критическая проверка наличия API-моста
        if (!window.electronAPI || typeof window.electronAPI.renameFile !== 'function') {
            setError('Ошибка Electron API: функция renameFile недоступна. Проверьте preload.js.');
            setIsRenaming(false);
            return;
        }

        setIsRenaming(true);
        setRenameErrors([]);

        // Создаем глубокую копию данных для изменения
        const newData = JSON.parse(JSON.stringify(data));
        const currentErrors = [];
        let allSucceeded = true;

        try {
            // Проходим по всем строкам
            for (const row of newData.reconciledPdfFiles) {
                if (row.status !== 'ready' || row.matchedFiles.length !== 1) {
                    continue;
                }

                const fileToRename = row.matchedFiles[0];
                const oldFileName = fileToRename.content;
                const renameRegex = /^(\d{3} - )/;

                let baseName = oldFileName.replace(renameRegex, '');

                const newPrefix = `${String(row.number).padStart(3, '0')} - `;
                const newName = `${newPrefix}${baseName}`;
                const oldPath = `${pdfDirectory}${oldFileName}`;

                const result = await window.electronAPI.renameFile(oldPath, newName);

                if (result.success) {
                    addNotification('success', (
                        <span>
                            <strong>{oldFileName}</strong><br></br>Файлу назначен номер <strong>{row.number}</strong>
                        </span>
                    ), `Новое имя: ${newName}`);

                    fileToRename.content = newName;
                    fileToRename.id = newName;
                    row.status = 'renamed-now';
                    row.matchedFiles = [fileToRename];

                    // Убираем подсветку через 2 секунды
                    const currentRowNumber = row.number;
                    setTimeout(() => {
                        setData(currentData => {
                            const updatedData = JSON.parse(JSON.stringify(currentData));
                            const targetRow = updatedData.reconciledPdfFiles.find(r => String(r.number) === String(currentRowNumber));
                            if (targetRow && targetRow.status === 'renamed-now') {
                                const matchedFileContents = targetRow.matchedFiles.map(f => f.content);
                                targetRow.status = getReconciliationStatus(matchedFileContents, targetRow.number);
                                return updatedData;
                            }
                            return currentData;
                        });
                    }, 2000);
                } else {
                    addNotification('error', (
                        <span>
                            Ошибка при назначении номера <strong>{row.number}</strong> файлу<br></br>{oldFileName}
                        </span>
                    ), result.message);

                    allSucceeded = false;
                    currentErrors.push({ file: oldFileName, message: result.message });
                }
            }

                        // 2. Проходим по несопоставленным файлам для очистки номеров
            const cleanRegex = /^(\d{3} - )/;
            for (const file of newData.unreconciledPdfFiles) {
                if (cleanRegex.test(file.content)) {
                    const oldFileName = file.content;
                    const newName = oldFileName.replace(cleanRegex, '');
                    const oldPath = `${pdfDirectory}${oldFileName}`;

                    const result = await window.electronAPI.renameFile(oldPath, newName);

                    if (result.success) {
                        addNotification('info', (
                            <span>
                                <strong>{oldFileName}</strong><br></br>Номер удален из имени файла
                            </span>
                        ), `Новое имя: ${newName}`);

                        file.content = newName;
                        file.id = newName;
                    } else {
                        addNotification('error', (
                            <span>
                                Ошибка при удалении номера у файла<br></br>{oldFileName}
                            </span>
                        ), result.message);

                        allSucceeded = false;
                        currentErrors.push({ file: oldFileName, message: result.message });
                    }
                }
            }

            setRenameErrors(currentErrors);

            if (!allSucceeded) {
                setError(`Переименование завершено с ${currentErrors.length} ошибками.`);
            } else {
                setError(null);
            }

            setData(newData);

        } catch (err) {
            console.error("Глобальная ошибка при выполнении переименования:", err);
            setError(`Глобальная ошибка при переименовании: ${err.message}`);
            addNotification('error', 'Глобальная ошибка при переименовании', err.message);
        } finally {
            setIsRenaming(false);
        }
    }, [data, pdfDirectory, addNotification]);


    return {
        data,
        isLoading,
        error,
        activeId,
        hoveredRow,
        handleDragStart,
        handleDragOver,
        handleDragEnd,
        handleDragCancel,
        getActiveItem,

        // Добавлены функции и состояния для переименования
        handleRenameFiles,
        isRenaming,
        renameErrors,
        pdfDirectory
    };
};


