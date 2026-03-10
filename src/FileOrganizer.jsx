// src/FileOrganizer.jsx

import React from 'react';
import { useNotifications } from './context/NotificationContext.jsx';
import useOrganizerFiles from './hooks/useOrganizerFiles.jsx';
import './styles/organizer.css';

const FileOrganizer = ({
    selectedCompany,
    setIsOrganizing
}) => {
    const { addNotification } = useNotifications();

    const {
        organizedFiles,
        handleFileTypeChange,
        handleOrganizeFiles,
        hasFilesToOrganize,
    } = useOrganizerFiles(
        addNotification,
        selectedCompany,
        setIsOrganizing
    );
    // =====================================

    return (
        <div className="organizer-view-container">
            {/* Левая основная колонка контента */}
            <div className="main-organizer-area">
                {organizedFiles.length > 0 ? (
                    <div className="card-list custom-scrollbar">
                        {organizedFiles.map(file => {
                            // Путь теперь можно получить напрямую из свойств файла или рассчитать
                            const currentSuggestedPath = file.suggestedPath;

                            return (
                                <div key={file.path} className={`card ${file.isFadingOut ? 'fade-out' : ''}`}>
                                    <div className="card-content">
                                        <div className="file-info">
                                            <p className="file-name">{file.name}</p>
                                            <p className="file-path">{currentSuggestedPath || 'Выберите тип'}</p>
                                        </div>
                                        <div className="button-group">
                                            <button
                                                className={`card-button ${file.selectedType === 'Поступления' ? 'active-type' : 'inactive-type'}`}
                                                onClick={() => handleFileTypeChange(file.path, 'Поступления')}
                                            >
                                                Поступления
                                            </button>
                                            <button
                                                className={`card-button ${file.selectedType === 'Реализации' ? 'active-type' : 'inactive-type'}`}
                                                onClick={() => handleFileTypeChange(file.path, 'Реализации')}
                                            >
                                                Реализации
                                            </button>
                                        </div>
                                        <div className="file-status-column">
                                            {/* Статусы остались без изменений */}
                                            {file.organizationStatus === 'moved' && (
                                                <svg className="icon-check" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="20 6 9 17 4 12"></polyline>
                                                </svg>
                                            )}
                                            {file.organizationStatus === 'failed' && <span className="organize-status-icon organize-error-icon">✖</span>}
                                            {file.organizationStatus === 'processing' && <span className="organize-status-icon organize-processing-icon">...</span>}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="no-files-message">В выбранной папке нет PDF файлов.</p>
                )}

                <div className="bottom-buttons-container">
                    <button
                        onClick={handleOrganizeFiles}
                        className="organizer-bottom-button default"
                        disabled={!hasFilesToOrganize} // Используем флаг из хука
                    >
                        Упорядочить выбранные файлы
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FileOrganizer;