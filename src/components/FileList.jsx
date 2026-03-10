// src/components/FileList.jsx
import React, { useRef, useImperativeHandle, forwardRef } from "react";

const FileList = forwardRef(({
    selectedFile,
    currentPdfFiles,
    handleFileSelect,
    onClose // Added prop for the close button functionality
}, ref) => {
    const listRef = useRef(null);
    useImperativeHandle(ref, () => ({
        scrollToSelected: () => {
            if (listRef.current) {
                const selectedItem = listRef.current.querySelector('.selected');
                if (selectedItem) {
                    selectedItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        }
    }));

    return (
        <div className="file-list-container">
            <div className="section-header">
                <h3>Переименование файла</h3>
                {onClose && (
                    <button className="btn btn-close-sidebar" onClick={onClose} title="Закрыть">
                        <i className="fas fa-times"></i>
                    </button>
                )}
            </div>
            <ul ref={listRef} className="file-list custom-scrollbar">
                {currentPdfFiles.length === 0 ? (
                    <li className="placeholder-item">
                        PDF-файлы не найдены в этой папке.
                    </li>
                ) : (
                    currentPdfFiles.map((file, index) => (
                        <li
                            key={file.path || file.fullPath || file.name || index}
                            className={`${selectedFile && (
                                (selectedFile.path && selectedFile.path === file.path) ||
                                (selectedFile.fullPath && selectedFile.fullPath === file.fullPath) ||
                                (!selectedFile.path && !selectedFile.fullPath && selectedFile.name === file.name)
                            ) ? 'selected' : ''} ${file.status === 'success' ? 'file-renamed-success' : ''} ${file.status === 'error' ? 'file-renamed-error' : ''}`}
                            title={file.name}
                            onClick={() => handleFileSelect(file)}
                        >
                            <span className="file-name-text">{file.name}</span>
                            <span className="file-status-icons">
                                {file.status === 'success' && <span className="file-status-icon success-icon">✔</span>}
                                {file.status === 'error' && <span className="file-status-icon error-icon">✖</span>}
                                {file.status === 'renaming' && <span className="file-status-icon renaming-icon">...</span>}
                                {file.status === 'pending' && <span className="file-status-icon pending-icon">○</span>}
                            </span>
                        </li>
                    ))
                )}
            </ul>
        </div>
    );
});

export default FileList;