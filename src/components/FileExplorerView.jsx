// src/FileExplorerView.jsx

import React, { useState, useRef, useEffect } from 'react';
import { useArchiveContext } from '../context/ArchiveContext.jsx';

const FileExplorerView = ({
    files,
    currentPath,
    displayPath,
    rootPath,
    onNavigate,
    onNavigateUp,
    onOpenFile,
    selectedFile,
    onOpenReconciliationModal,
    onRenameClick,
    renamingItemId,
    setRenamingItemId,
    setFileData,
    updateFileNode // Changed from updateFileName
}) => {
    // Временные данные для демонстрации - УДАЛЕНЫ, теперь данные приходят через пропсы
    // const files = [
    //     { name: 'document1.pdf', type: 'file' },
    //     { name: 'document2.pdf', type: 'file' },
    //     { name: 'folder1', type: 'folder' },
    //     { name: 'folder2', type: 'folder' },
    // ;

    const { searchQuery, setSearchQuery } = useArchiveContext();
    const [newName, setNewName] = useState('');
    const inputRef = useRef(null);

    // useEffect для сброса поиска удален, так как теперь он в контексте
    // и сбрасывается только при смене компании в ArchiveContextProvider
    // Только инициализируем новое имя при начале переименования
    useEffect(() => {
        if (renamingItemId) {
            const item = files.find(f => f.id === renamingItemId);
            if (item) {
                setNewName(item.name);
                // Фокус и выделение делаем только один раз при открытии
                setTimeout(() => {
                    if (inputRef.current) {
                        inputRef.current.focus();
                        inputRef.current.setSelectionRange(0, item.name.length);
                    }
                }, 0);
            }
        }
    }, [renamingItemId]); // Убрали files из зависимостей, чтобы не сбрасывать при наборе текста

    // Убрали отдельный useEffect для фокуса, так как он вызывал повторное выделение
    const getFileIcon = (item) => {
        if (item.type === 'folder') return <i className="fa-solid fa-folder"></i>;

        const name = item.name.toLowerCase();
        if (name.endsWith('.pdf')) {
            return <i className="fa-solid fa-file-pdf"></i>;
        } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
            return <i className="fa-solid fa-file-excel"></i>;
        }
        return <i className="fa-solid fa-file"></i>;
    };

    const getIconClass = (item) => {
        if (item.type === 'folder') return 'folder';

        const name = item.name.toLowerCase();
        if (name.endsWith('.pdf')) return 'file-pdf';
        if (name.endsWith('.xlsx') || name.endsWith('.xls')) return 'file-excel';
        return 'file-generic';
    };

    const handleItemClick = (item) => {
        if (renamingItemId) return; // Prevent interaction if currently renaming
        if (item.type === 'folder') {
            // При клике на папку в проводнике просто выбираем её (для синхронизации)
            // или сразу заходим? Обычно в проводнике один клик - выбор, даблклик - вход.
            // Но для удобства сделаем один клик - выбор, и если это папка, то навигация.
            onNavigate(item.id);
        } else {
            const name = item.name.toLowerCase();
            if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
                onOpenReconciliationModal(item.id);
            } else if (name.endsWith('.pdf')) {
                onOpenFile(item);
            }
        }
    };

        const handleContextMenu = (e, item) => {
        e.preventDefault();

        const isPDF = item.name.toLowerCase().endsWith('.pdf');
        if (item.type !== 'folder' && isPDF) {
            onOpenFile(item); // Highlight the file
            onRenameClick(item); // Вызываем наш новый оверлей
        }
    };

    const handleRenameConfirm = async (item) => {
        if (!newName || newName === item.name) {
            setRenamingItemId(null);
            return;
        }

        // Assuming electronAPI.renameFile exists and returns { success: boolean, newPath: string | null }
        const result = await window.electronAPI.renameFile(item.id, newName);
        if (!result.success) {
            console.error("Failed to rename file:", result.error);
            setRenamingItemId(null);
            return;
        }

        // ВАЖНО: Обновляем и имя, и ID в глобальном дереве
        setFileData(prev => updateFileNode(prev, item.id, newName, result.newPath));
        setRenamingItemId(null);

        // Обновляем выбранный файл новым путем
        onOpenFile({ id: result.newPath });
    };

    const handleKeyDown = (e, item) => {
        if (e.key === 'Enter') handleRenameConfirm(item);
        else if (e.key === 'Escape') setRenamingItemId(null);
    };

    // Рекурсивный поиск по дереву
    const getFilteredFiles = () => {
        if (!searchQuery) return files;

        const results = [];
        const query = searchQuery.toLowerCase();

        const traverse = (items) => {
            if (!items) return;
            for (const item of items) {
                if (item.name.toLowerCase().includes(query)) {
                    results.push(item);
                }
                if (item.children && item.children.length > 0) {
                    traverse(item.children);
                }
            }
        };

        traverse(files);
        return results;
    };

    const filteredFiles = getFilteredFiles();

    // Сортировка: сначала папки, потом файлы, внутри по алфавиту с поддержкой чисел
    const sortedFiles = [...filteredFiles].sort((a, b) => {
        if (a.type === b.type) {
            return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
        }
        return a.type === 'folder' ? -1 : 1;
    });

    return (
        <div className="file-explorer-view">
            <div className="explorer-search-bar">
                <div className="search-input-wrapper">
                    <i className="fa-solid fa-magnifying-glass search-icon"></i>
                    <input
                        type="text"
                        className="explorer-search-input"
                        placeholder="Поиск"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button
                            className="search-clear-btn"
                            onClick={() => setSearchQuery('')}
                            title="Очистить поиск"
                        >
                            <i className="fa-solid fa-xmark"></i>
                        </button>
                    )}
                </div>
            </div>
            <div className="explorer-navigation-bar">
                <button
                    onClick={onNavigateUp}
                    disabled={currentPath === rootPath || !!searchQuery}
                    className="btn"
                    title="На уровень вверх"
                >
                    <i className="fa-solid fa-arrow-up"></i>
                </button>
                                <div className="explorer-path-display" title={currentPath}>
                    {searchQuery ? `Результаты поиска: ${searchQuery}` : (displayPath || currentPath)}
                </div>
                <button
                    className="btn explorer-open-folder-btn"
                    onClick={() => currentPath && window.electronAPI.openPath(currentPath)}
                    title="Открыть в проводнике Windows"
                    disabled={!currentPath}
                >
                    <i className="fa-solid fa-folder-open"></i>
                </button>
            </div>
            <div className="explorer-list">
                {sortedFiles && sortedFiles.length > 0 ? (
                    sortedFiles.map((item, index) => {
                        const isSelected = selectedFile?.path === item.id;
                        const isRenaming = renamingItemId === item.id;
                        return (
                            <div
                                key={item.id || index}
                                className={`explorer-list-item ${isSelected ? 'selected' : ''}`}
                                onClick={() => handleItemClick(item)}
                                onContextMenu={(e) => handleContextMenu(e, item)}
                            >
                                <div className={`explorer-item-icon ${getIconClass(item)}`}>
                                    {getFileIcon(item)}
                                </div>
                                {isRenaming ? (
                                    <div className="rename-input-container" onClick={(e) => e.stopPropagation()}>
                                        <input
                                            ref={inputRef}
                                            type="text"
                                            value={newName}
                                            onChange={(e) => setNewName(e.target.value)}
                                            onKeyDown={(e) => handleKeyDown(e, item)}
                                            className="rename-input"
                                            onBlur={() => handleRenameConfirm(item)}
                                            onClick={(e) => e.stopPropagation()} // Предотвращаем потерю фокуса при клике в поле
                                        />
                                    </div>
                                ) : (
                                    <span className="explorer-item-name" title={item.name}>{item.name}</span>
                                )}
                            </div>
                        );
                    })
                ) : (
                    <div className="empty-folder-message">
                        {searchQuery ? "Ничего не найдено" : "Папка пуста"}
                    </div>
                )}
            </div>
        </div>
    );
};

export default FileExplorerView;