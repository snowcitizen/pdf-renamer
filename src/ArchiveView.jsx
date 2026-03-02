import React from 'react';
import './styles/archive.css';
import './styles/reconciliation.css';
import PdfViewer from './components/PdfViewer.jsx';
import FileExplorerView from './components/FileExplorerView.jsx';
import { useArchiveContext } from './context/ArchiveContext.jsx';
import { useRenamer } from './context/RenamerContext.jsx';
import { useNavigate } from 'react-router-dom';

const ArchiveView = ({ selectedCompany }) => {
    const navigate = useNavigate();
    const { openArchiveRenamer } = useRenamer();
    const {
        fileData,
        setFileData,
        isLoading,
        error,
        selectedFile,
        setSelectedFile,
        currentExplorerPath,
        setCurrentExplorerPath,
        renamingItemId,
        setRenamingItemId,
        rootCompanyPath,
        navigateUp,
        updateFileNode,
        findNodeById,
    } = useArchiveContext();

    if (!selectedCompany) return <div className='archive-empty'>Выберите компанию для просмотра архива</div>;
    if (isLoading && !fileData) return <div className='archive-loading'>Загрузка архива...</div>;
    if (error && !fileData) return <div className='archive-error'>Ошибка: {error}</div>;

    const getCurrentFolderData = () => {
        if (!fileData || !currentExplorerPath) return null;
        return findNodeById(fileData, currentExplorerPath);
    };

    const currentFolderData = getCurrentFolderData();

    const formatDisplayPath = (path) => {
        if (!path || !rootCompanyPath) return '';
        if (path === rootCompanyPath) return '\\';
        if (path.startsWith(rootCompanyPath)) {
            let display = path.replace(rootCompanyPath, '');
            if (!display.startsWith('\\')) display = '\\' + display;
            return display;
        }
        return path;
    };

    const handleOpenReconciliation = (excelFilePath) => {
        navigate('/reconciliation', { state: { selectedExcelPath: excelFilePath } });
    };

    const handleRenamerOpen = (file) => {
        openArchiveRenamer(
            { id: file.id, name: file.name, path: file.id }, 
            (newPath, newName) => {
                if (newPath) {
                    // Успешное переименование
                    updateFileNode(file.id, { id: newPath, name: newName });
                    setSelectedFile({ path: newPath });
                } else {
                    // Удаление (newPath === null)
                    // Тут можно добавить логику удаления узла из дерева, если нужно
                    // Но пока просто сбросим выбор
                    setSelectedFile(null);
                    // Перезагружаем текущую папку чтобы узел исчез
                    // (updateFileNode для удаления не предусмотрен, проще перечитать)
                    // но для начала просто сбросим selected
                }
            }
        );
    };

    return (
        <>
            <div className='panel archive-left-panel left-panel'>
                <PdfViewer selectedFile={selectedFile} />
            </div>
            <div className='panel archive-right-panel right-panel'>
                <div className='archive-container'>
                    <FileExplorerView
                        files={currentFolderData?.children || []}
                        currentPath={currentExplorerPath}
                        displayPath={formatDisplayPath(currentExplorerPath)}
                        rootPath={rootCompanyPath}
                        onNavigate={(path) => setCurrentExplorerPath(path)}
                        onNavigateUp={navigateUp}
                        onOpenFile={(file) => setSelectedFile({ path: file.id })}
                        selectedFile={selectedFile}
                        onOpenReconciliationModal={handleOpenReconciliation}
                        onRenameClick={handleRenamerOpen}
                        renamingItemId={renamingItemId}
                        setRenamingItemId={setRenamingItemId}
                        setFileData={setFileData}
                        updateFileNode={updateFileNode}
                    />
                </div>
            </div>
        </>
    );
};

export default ArchiveView;

