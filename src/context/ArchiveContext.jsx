import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ArchiveContext = createContext(null);

export const ArchiveContextProvider = ({ children, selectedCompany }) => {
    const [fileData, setFileData] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [openFolders, setOpenFolders] = useState(new Set());
    const [currentExplorerPath, setCurrentExplorerPath] = useState(null);
    const [renamingItemId, setRenamingItemId] = useState(null);
    const [rootCompanyPath, setRootCompanyPath] = useState('');
    // УДАЛЕНО: состояние reconciliationModal
    // Состояние для хранения последнего пути каждой компании
    const [lastPaths, setLastPaths] = useState({});

    const findNodeById = useCallback((node, id) => {
        if (!node) return null;
        if (node.id === id) return node;
        if (!node.children) return null;
        for (const child of node.children) {
            const found = findNodeById(child, id);
            if (found) return found;
        }
        return null;
    }, []);

    const findParentNode = useCallback((node, targetId) => {
        if (!node || !node.children) return null;
        if (node.children.some(child => child.id === targetId)) return node;
        for (const child of node.children) {
            const found = findParentNode(child, targetId);
            if (found) return found;
        }
        return null;
    }, []);

    const updateFileNode = useCallback((tree, id, newName, newId) => {
        if (tree.id === id) return { ...tree, name: newName, id: newId };
        if (tree.children) {
            return { ...tree, children: tree.children.map(child => updateFileNode(child, id, newName, newId)) };
        }
        return tree;
    }, []);

    // Вспомогательные функции для работы с деревом через watcher
    const addNodeToTree = useCallback((tree, newNode, parentPath) => {
        if (!tree) return tree;
        
        // Если текущий узел и есть родитель
        if (tree.id === parentPath) {
            // Проверяем, нет ли уже такого узла
            if (tree.children.some(child => child.id === newNode.id)) return tree;
            const updatedChildren = [...tree.children, newNode].sort((a, b) => {
                if (a.type === b.type) return a.name.localeCompare(b.name, undefined, { numeric: true });
                return a.type === 'folder' ? -1 : 1;
            });
            return { ...tree, children: updatedChildren };
        }

        // Если нет, ищем в детях
        if (tree.children) {
            return {
                ...tree,
                children: tree.children.map(child => addNodeToTree(child, newNode, parentPath))
            };
        }
        return tree;
    }, []);

    const removeNodeFromTree = useCallback((tree, targetId) => {
        if (!tree || !tree.children) return tree;
        
        // Проверяем, нет ли удаляемого узла среди прямых детей
        const filteredChildren = tree.children.filter(child => child.id !== targetId);
        
        if (filteredChildren.length !== tree.children.length) {
            return { ...tree, children: filteredChildren };
        }

        // Если не нашли, идем глубже
        return {
            ...tree,
            children: tree.children.map(child => removeNodeFromTree(child, targetId))
        };
    }, []);

    const fetchData = useCallback(async () => {
        if (!selectedCompany || typeof selectedCompany !== "string") return;

        setIsLoading(true);
        try {
            const companyPath = await window.electronAPI.getCompanyArchivePath(selectedCompany);
            setRootCompanyPath(companyPath);

            // Пытаемся восстановить последний путь для этой компании
            const savedPath = lastPaths[selectedCompany];

            // Если сохраненный путь валиден для этой компании, используем его, иначе корень
            if (savedPath && savedPath.startsWith(companyPath)) {
                setCurrentExplorerPath(savedPath);
            } else if (!currentExplorerPath || !currentExplorerPath.startsWith(companyPath)) {
                setCurrentExplorerPath(companyPath);
            }

            const data = await window.electronAPI.readArchive({ recursive: true, parentPath: companyPath });
            setFileData(data);

            if (selectedFile && !findNodeById(data, selectedFile.path)) {
                setSelectedFile(null);
            }
            setError(null);
        } catch (err) {
            console.error("Archive loading error:", err);
            setError("Archive loading error");
        } finally {
            setIsLoading(false);
        }
    }, [selectedCompany, lastPaths, currentExplorerPath, selectedFile, findNodeById]); // Добавили lastPaths в зависимости

    // Сохраняем путь при его изменении
    useEffect(() => {
        if (selectedCompany && currentExplorerPath) {
            setLastPaths(prev => ({
                ...prev,
                [selectedCompany]: currentExplorerPath
            }));
        }
    }, [currentExplorerPath, selectedCompany]);

    useEffect(() => {
        setSearchQuery('');
        fetchData();
    }, [selectedCompany]);

    // Обработка событий вотчера для архива
    useEffect(() => {
        const unsubscribe = window.electronAPI.on('watcher:change', ({ event, key, filePath, fileName }) => {
            if (key !== 'archive') return;

            // В нашем дереве IDs — это абсолютные пути (так как они приходят из readArchive с абсолютным parentPath)
            // Поэтому мы можем использовать filePath напрямую без обрезки baseDrive

            // Находим путь родительской папки (всё, что до последнего слэша)
            const lastSeparatorIndex = Math.max(filePath.lastIndexOf('\\'), filePath.lastIndexOf('/'));
            const parentId = filePath.substring(0, lastSeparatorIndex);
                if (event === 'file-added' || event === 'dir-added') {
                    const newNode = {
                    id: filePath, // Используем полный путь как ID
                    name: fileName,
                        type: event === 'dir-added' ? 'folder' : 'file',
                        ...(event === 'dir-added' ? { children: [], hasChildren: true } : {})
                    };
                    setFileData(prev => addNodeToTree(prev, newNode, parentId));
                } else if (event === 'file-deleted' || event === 'dir-deleted') {
                setFileData(prev => removeNodeFromTree(prev, filePath));
                }
            });
        return () => {
            unsubscribe();
        };
    }, [addNodeToTree, removeNodeFromTree]);

    const navigateUp = useCallback(() => {
        if (!fileData || !currentExplorerPath || currentExplorerPath === rootCompanyPath) return;
        const parent = findParentNode(fileData, currentExplorerPath);
        if (parent) setCurrentExplorerPath(parent.id);
    }, [fileData, currentExplorerPath, rootCompanyPath, findParentNode]);

    // УДАЛЕНЫ: handleOpenReconciliationModal и handleCloseReconciliationModal
    const value = {
        fileData,
        setFileData,
        searchQuery,
        setSearchQuery,
        isLoading,
        error,
        selectedFile,
        setSelectedFile,
        openFolders,
        setOpenFolders,
        currentExplorerPath,
        setCurrentExplorerPath,
        renamingItemId,
        setRenamingItemId,
        rootCompanyPath,
        // УДАЛЕНО: reconciliationModal
        fetchData,
        navigateUp,
        updateFileNode,
        findNodeById,
        findParentNode,
        // УДАЛЕНО: handleOpenReconciliationModal, handleCloseReconciliationModal
    };

    return (
        <ArchiveContext.Provider value={value}>
            {children}
        </ArchiveContext.Provider>
    );
};

export const useArchiveContext = () => {
    const context = useContext(ArchiveContext);
    if (!context) {
        throw new Error('useArchiveContext must be used within ArchiveContextProvider');
    }
    return context;
};

export default ArchiveContext;

