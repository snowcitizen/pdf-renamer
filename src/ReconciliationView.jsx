import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import './styles/reconciliation.css';
import { useReconciliationLogic } from './components/reconciliation/hooks/useReconciliationLogic';
import DroppableRow from './components/reconciliation/components/DroppableRow';
import FileContainer from './components/reconciliation/components/FileContainer';
import SortableFile from './components/reconciliation/components/SortableFile';
import { DndContext, rectIntersection, DragOverlay } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useReconciliationContext } from './context/ReconciliationContext';

const ReconciliationView = ({ selectedCompany }) => {
    const location = useLocation();
    const {
        selectedExcelPath,
        setSelectedExcelPath,
        reconFiles,
        setReconFiles,
        activeTab,
                setActiveTab
    } = useReconciliationContext();
    
    // Реф для отслеживания текущего пути открытого файла внутри useEffect
    const selectedPathRef = useRef(selectedExcelPath);
    useEffect(() => {
        selectedPathRef.current = selectedExcelPath;
    }, [selectedExcelPath]);

    const [isLoadingFiles, setIsLoadingFiles] = useState(false);


        useEffect(() => {
        // Сбрасываем выбранный файл при любой смене компании
        setSelectedExcelPath(null);

        const loadFiles = () => {
            if (selectedCompany) {
                setIsLoadingFiles(true);
                window.electronAPI.findReconciliationFiles(selectedCompany).then(files => {
                    setReconFiles(files);
                    setIsLoadingFiles(false);
                    
                    // Если мы пришли из архива с выбранным файлом
                    if (location.state?.selectedExcelPath) {
                        const targetFile = files.find(f => f.fullPath === location.state.selectedExcelPath);
                        if (targetFile) {
                            setSelectedExcelPath(targetFile.fullPath);
                            setActiveTab(targetFile.type);
                        }
                        // Очищаем состояние, чтобы при повторном переходе на вкладку не открывался тот же файл
                        window.history.replaceState({}, document.title);
                    }
                });
            }
        };

        loadFiles();

                // Подписка на изменения в файлах сверки через вотчер архива
        const unsubscribe = window.electronAPI.on('watcher:change', ({ event, key, filePath, fileName }) => {
            if (key === 'archive' && (fileName.toLowerCase().endsWith('.xlsx') || fileName.toLowerCase().endsWith('.xls'))) {
                
                // Если был изменен или удален именно тот файл, который сейчас открыт
                if (selectedPathRef.current === filePath && (event === 'file-deleted' || event === 'file-changed' || event === 'dir-deleted')) {
                    setSelectedExcelPath(null);
                }

                // Обновляем список файлов в правой панели
                window.electronAPI.findReconciliationFiles(selectedCompany).then(files => {
                    setReconFiles(files);
                });
            }
        });

        return () => unsubscribe();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedCompany]); 
 

    // Фильтруем файлы по выбранной вкладке
    const filteredFiles = reconFiles.filter(f => f.type === activeTab);

    // Логика сверки
    const {
        data,
        isLoading: isProcessing,
        error,
        handleDragStart,
        handleDragOver,
        handleDragEnd,
        handleDragCancel,
        getActiveItem,
        handleRenameFiles,
        isRenaming,
        renameErrors,
        hoveredRow
    } = useReconciliationLogic(!!selectedExcelPath, selectedExcelPath);

    const activeItem = getActiveItem();

    // Расчет сводки
    const totalExcelRows = data?.reconciledPdfFiles?.length || 0;
    const totalMatchedFiles = data?.reconciledPdfFiles?.reduce((sum, row) => sum + row.matchedFiles.length, 0) || 0;
    const totalUnmatchedFiles = data?.unreconciledPdfFiles?.length || 0;
    const totalCopies = data?.copyPdfFiles?.length || 0;
    const filesReadyToRename = data?.reconciledPdfFiles?.filter(row => row.status === 'ready').length || 0;

    return (
        <div className="reconciliation-view-container">
            <div className="panel reconciliation-left-panel">
                {!selectedExcelPath ? (
                    <div className="reconciliation-empty-state">
                        <i className="fa-solid fa-file-excel"></i>
                        <p>Выберите файл Excel в правой панели для начала сверки</p>
                    </div>
                ) : (
                    <div className="reconciliation-content">
                        <div className="reconciliation-content-header">
                            <h3>Сверка: {reconFiles.find(f => f.fullPath === selectedExcelPath)?.label}</h3>
                        </div>
                        
                        <div className="reconciliation-main-area">
                            {isProcessing && <div className="loading-overlay">Загрузка данных...</div>}
                            {error && <div className="error-message">Ошибка: {error}</div>}
                            
                            {!isProcessing && !error && data && (
                                <DndContext
                                    collisionDetection={rectIntersection}
                                    onDragStart={handleDragStart}
                                    onDragOver={handleDragOver}
                                    onDragEnd={handleDragEnd}
                                    onDragCancel={handleDragCancel}
                                >
                                    <div className="top-lists-wrapper">
                                        <div className="excel-list-column">
                                            <h3>Строки Excel</h3>
                                            <ul className="excel-rows-list">
                                                {data.reconciledPdfFiles.map((item, index) => (
                                                    <li key={index} className="excel-row-item">
                                                        <div className="excel-row-content">
                                                            <span className="row-number">{item.number}</span>
                                                            <span className="row-filename">{item.newFileName}</span>
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                        <div className="pdf-list-column">
                                            <h3>Сопоставленные PDF</h3>
                                            <ul className="matched-files-list">
                                                {data.reconciledPdfFiles.map((item) => (
                                                    <DroppableRow
                                                        key={item.number}
                                                        item={item}
                                                        hoveredRow={hoveredRow}
                                                    />
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                    
                                    <div className="bottom-lists-wrapper">
                                        <div className="copies-section">
                                            <h3>Копии PDF</h3>
                                            <ul className="copies-list">
                                                <li className="matched-file-item empty">
                                                    <div className="file-items-wrapper">
                                                        <SortableContext items={data.copyPdfFiles.map(f => f.id)} strategy={verticalListSortingStrategy}>
                                                            {data.copyPdfFiles.map((file) => (
                                                                <SortableFile key={file.id} id={file.id} content={file.content} containerId="copies" isDraggable={false} />
                                                            ))}
                                                        </SortableContext>
                                                    </div>
                                                </li>
                                            </ul>
                                        </div>
                                        <div className="unmatched-section">
                                            <h3>Несопоставленные PDF</h3>
                                            <ul className="unmatched-list">
                                                <FileContainer
                                                    files={data.unreconciledPdfFiles}
                                                    containerId="unreconciled-files"
                                                    hoveredRow={hoveredRow}
                                                />
                                            </ul>
                                        </div>
                                    </div>

                                    <DragOverlay>
                                        {activeItem ? (
                                            <div className="file-draggable-item dragging-overlay">
                                                {activeItem.content}
                                            </div>
                                        ) : null}
                                    </DragOverlay>
                                </DndContext>
                            )}
                        </div>

                        <div className="reconcile-footer">
                             <div className="reconcile-errors-summary">
                                {renameErrors.length > 0 && (
                                    <div className="rename-errors">
                                        <h4>Ошибки ({renameErrors.length}):</h4>
                                        <ul>
                                            {renameErrors.map((e, index) => (
                                                <li key={index} className="error-message">
                                                    {e.message}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>

                            <button 
                                className="reconcile-rename-btn btn-primary btn"
                                onClick={handleRenameFiles}
                                disabled={isProcessing || isRenaming || filesReadyToRename === 0}
                            >
                                {isRenaming 
                                    ? 'Переименование...' 
                                    : `Назначить номера (${filesReadyToRename} готовы)`
                                }
                            </button>
                            
                            <div className="reconcile-stats-summary">
                                <div className="summary-item">
                                    <span>Строк Excel: {totalExcelRows}</span>
                                </div>
                                <div className="summary-item">
                                    <span>Сопоставлено: {totalMatchedFiles}</span>
                                </div>
                                <div className="summary-item">
                                    <span>Не сопоставлено: {totalUnmatchedFiles}</span>
                                </div>
                                <div className="summary-item">
                                    <span>Копий: {totalCopies}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="panel reconciliation-right-panel">
                <div className="recon-explorer-header">
                    <h3>Файлы сверки</h3>
                    <div className="recon-tab-selector">
                        <button
                            className={`recon-tab-btn ${activeTab === 'income' ? 'active' : ''}`}
                            onClick={() => setActiveTab('income')}
                        >
                            Поступления
                        </button>
                        <button
                            className={`recon-tab-btn ${activeTab === 'outcome' ? 'active' : ''}`}
                            onClick={() => setActiveTab('outcome')}
                        >
                            Реализации
                        </button>
                    </div>
                </div>
                <div className="recon-explorer-list">
                    {isLoadingFiles ? (
                        <div className="loading-text">Поиск файлов...</div>
                    ) : filteredFiles.length > 0 ? (
                        filteredFiles.map((file, index) => (
                            <div
                                key={index}
                                className={`recon-explorer-item ${selectedExcelPath === file.fullPath ? 'selected' : ''}`}
                                onClick={() => {
                                    setSelectedExcelPath(file.fullPath);
                                    setActiveTab(file.type);
                                }}
                            >
                                <i className="fa-solid fa-file-excel"></i>
                                <div className="recon-file-info">
                                    <span className="recon-file-label" title={file.fullPath}>
                                        {file.label}
                                    </span>
                                    <span className="recon-file-filename">
                                        {file.name}
                                    </span>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="empty-text">Файлы для сверки не найдены</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReconciliationView;
