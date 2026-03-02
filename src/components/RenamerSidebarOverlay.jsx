// src/components/RenamerSidebarOverlay.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useRenamer } from '../context/RenamerContext.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { useNotifications } from '../context/NotificationContext.jsx';
import { parseFileName, generateNewFileName } from '../utils/renamerUtils.js';
import FileList from './FileList.jsx';
import RenamerSection from './RenamerSection.jsx';
import '../styles/renamer.css';

const RenamerSidebarOverlay = ({ selectedCompany }) => {
    const {
        isOverlayOpen,
        overlayFile,
        overlayFormData,
        setOverlayFormData,
        closeArchiveRenamer,
        showOverlay,
        onOverlaySuccess,
        resetOverlaySession
    } = useRenamer();
    const location = useLocation();
    const { settings } = useSettings();
    const { addNotification } = useNotifications();
    const sidebarRef = useRef(null);

    // 0. Сброс при смене компании
    useEffect(() => {
            resetOverlaySession();
    }, [selectedCompany, resetOverlaySession]);

    // 0.1 Закрытие при клике вне панели
    useEffect(() => {
        if (!isOverlayOpen) return;

        const handleClickOutside = (event) => {
            if (sidebarRef.current && !sidebarRef.current.contains(event.target)) {
                // Не закрывать при клике по шапке (используем класс .app-header из Header.jsx)
                const isHeader = event.target.closest('.app-header');
                if (!isHeader) {
                    resetOverlaySession();
                }
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOverlayOpen, resetOverlaySession]);

    const [loadedCounterparties, setLoadedCounterparties] = useState([]);
    const [newFileNamePreview, setNewFileNamePreview] = useState('');
    const docDateInputRef = useRef(null);

    // Локальные геттеры для удобства проброса в RenamerSection
    const { docDate, docType, docNumber, counterparty, originalCopy } = overlayFormData;

    const updateField = (name, value) => {
        setOverlayFormData(prev => ({ ...prev, [name]: value }));
    };

    // Загрузка контрагентов
    useEffect(() => {
        const fetchCounterparties = async () => {
            const cp = await window.electronAPI.getCounterparties();
            setLoadedCounterparties(cp);
        };
        fetchCounterparties();
    }, []);

    // 1. Управление видимостью при смене страниц
    useEffect(() => {
        // Если мы ушли с архива - скрываем оверлей (но не сбрасываем данные)
        if (location.pathname !== '/archive' && isOverlayOpen) {
            closeArchiveRenamer();
        }
        // Если вернулись в архив и у нас ЕСТЬ активный файл в сессии - показываем обратно
        else if (location.pathname === '/archive' && overlayFile && !isOverlayOpen) {
            showOverlay();
        }
    }, [location.pathname, isOverlayOpen, overlayFile, closeArchiveRenamer, showOverlay]);

    // 2. Инициализация ПРИ ПЕРВОМ открытии нового файла или когда данные пусты
    useEffect(() => {
        if (isOverlayOpen && overlayFile && !docDate && !docType) {
            // Только если поля пустые (значит новый сеанс или сброс)
            const parsed = parseFileName(
                overlayFile.name,
                settings.docTypes,
                settings.legalForms,
                loadedCounterparties
            );
            setOverlayFormData(parsed);

            // Фокус на дату
            setTimeout(() => {
                if (docDateInputRef.current) docDateInputRef.current.focus();
            }, 300);
        }
    }, [isOverlayOpen, overlayFile, settings, loadedCounterparties, docDate, docType, setOverlayFormData]);

    // 3. Обновление превью
    useEffect(() => {
        const newName = generateNewFileName(overlayFormData);
        setNewFileNamePreview(newName || 'Заполните поля');
    }, [overlayFormData]);

    const handleRename = async () => {
        if (!overlayFile || !newFileNamePreview || newFileNamePreview === 'Заполните поля') return;

        const result = await window.electronAPI.renameFile(overlayFile.path, newFileNamePreview);
        if (result.success) {
            addNotification('success', <span><strong>{overlayFile.name}</strong><br/>переименован в<br/><strong>{newFileNamePreview}</strong></span>);
            if (onOverlaySuccess) onOverlaySuccess(result.newPath, newFileNamePreview);
            resetOverlaySession(); // ПОЛНЫЙ сброс после успеха
        } else {
            addNotification('error', `Ошибка: ${result.message}`);
        }
    };

    const handleDelete = async () => {
        if (!overlayFile) return;
        const result = await window.electronAPI.deleteFile(overlayFile.path);
        if (result.success) {
            addNotification('success', <span>Файл <strong>{overlayFile.name}</strong> удален</span>);
            if (onOverlaySuccess) onOverlaySuccess(null, null); // Сигнал, что файл удален
            resetOverlaySession(); // ПОЛНЫЙ сброс после удаления
        }
    };

    if (!isOverlayOpen || location.pathname !== '/archive') return null;

    return (
        <div className={`renamer-sidebar-overlay ${isOverlayOpen ? 'open' : ''}`} ref={sidebarRef}>
            <FileList
                currentPdfFiles={overlayFile ? [overlayFile] : []}
                selectedFile={overlayFile}
                handleFileSelect={() => {}} // В архиве выбираем только один
                onClose={resetOverlaySession}
            />
            <RenamerSection 
                selectedFile={overlayFile}
                docDate={docDate}
                setDocDate={(v) => updateField('docDate', v)}
                docType={docType}
                setDocType={(v) => updateField('docType', v)}
                docNumber={docNumber}
                setDocNumber={(v) => updateField('docNumber', v)}
                counterparty={counterparty}
                setCounterparty={(v) => updateField('counterparty', v)}
                originalCopy={originalCopy}
                setOriginalCopy={(v) => updateField('originalCopy', v)}
                newFileNamePreview={newFileNamePreview}
                handleRenameFile={handleRename}
                handleDeleteFile={handleDelete}
                docDateInputRef={docDateInputRef}
                loadedCounterparties={loadedCounterparties}
            />
        </div>
    );
};

export default RenamerSidebarOverlay;

