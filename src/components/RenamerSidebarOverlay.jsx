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
        archiveSession,
        reconSession,
        openRenamer,
        closeRenamer,
        resetRenamerSession,
        setRenamerFormData
    } = useRenamer();
    const location = useLocation();

    // Определяем текущий режим в зависимости от страницы
    const currentMode = location.pathname === '/reconciliation' ? 'recon' : 'archive';
    const currentSession = currentMode === 'recon' ? reconSession : archiveSession;
    const sessionType = currentMode === 'recon' ? 'reconciliation' : 'archive';

    const { settings } = useSettings();
    const { addNotification } = useNotifications();
    const sidebarRef = useRef(null);

    // 0. Сброс при смене компании
    useEffect(() => {
        resetRenamerSession('archive');
        resetRenamerSession('reconciliation');
    }, [selectedCompany, resetRenamerSession]);

    // 0.1 Закрытие при клике вне панели
    useEffect(() => {
        if (!currentSession.isOpen) return;

        const handleClickOutside = (event) => {
            // Игнорируем правую кнопку мыши (button 2), чтобы не закрывать панель
            // перед открытием нового файла через контекстное меню
            if (event.button === 2) return;

            if (sidebarRef.current && !sidebarRef.current.contains(event.target)) {
                // Не закрывать при клике по шапке (используем класс .app-header из Header.jsx)
                const isHeader = event.target.closest('.app-header');
                if (!isHeader) {
                    closeRenamer(sessionType);
                }
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [currentSession.isOpen, sessionType, closeRenamer]);
    const [loadedCounterparties, setLoadedCounterparties] = useState([]);
    const [newFileNamePreview, setNewFileNamePreview] = useState('');
    const docDateInputRef = useRef(null);

    // Локальные геттеры из ТЕКУЩЕЙ сессии
    const { formData, file: overlayFile, isOpen: isOverlayOpen } = currentSession;
    const { reconNumber, docDate, docType, docNumber, counterparty, originalCopy } = formData;

    const updateField = (name, value) => {
        setRenamerFormData(sessionType, prev => ({ ...prev, [name]: value }));
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
        const allowedPaths = ['/archive', '/reconciliation'];

        // Если мы ушли с разрешенных страниц - скрываем оверлей (но не сбрасываем данные)
        if (!allowedPaths.includes(location.pathname)) {
            if (archiveSession.isOpen) closeRenamer('archive');
            if (reconSession.isOpen) closeRenamer('reconciliation');
        }
    }, [location.pathname, archiveSession.isOpen, reconSession.isOpen, closeRenamer]);
    // 2. Инициализация ПРИ ОТКРЫТИИ или СМЕНЕ файла
    useEffect(() => {
        if (currentSession.isOpen && overlayFile && !docDate && !docType) {
            // Парсим имя файла. Это сработает и при открытии панели,
            // и если мы кликнули на другой файл, когда панель уже открыта.
            const parsed = parseFileName(
                overlayFile.name,
                settings.docTypes,
                settings.legalForms,
                loadedCounterparties
            );
            setRenamerFormData(sessionType, parsed);

            // Фокус на дату
            setTimeout(() => {
                if (docDateInputRef.current) docDateInputRef.current.focus();
            }, 300);
        }
        // Добавляем зависимости от идентификаторов файла, чтобы эффект срабатывал при переключении
    }, [currentSession.isOpen, overlayFile?.fullPath, overlayFile?.path, settings, loadedCounterparties, setRenamerFormData, sessionType, docDate, docType]);

    // 3. Обновление превью
    useEffect(() => {
        const newName = generateNewFileName(formData);
        setNewFileNamePreview(newName || 'Заполните поля');
    }, [formData]);

    const handleRename = async () => {
        if (!overlayFile || !newFileNamePreview || newFileNamePreview === 'Заполните поля') return;

        // Используем fullPath или path в зависимости от того, как объект пришел
        const currentPath = overlayFile.fullPath || overlayFile.path;
        const result = await window.electronAPI.renameFile(currentPath, newFileNamePreview);
        if (result.success) {
            addNotification('success', <span><strong>{overlayFile.name}</strong><br />переименован в<br /><strong>{newFileNamePreview}</strong></span>);
            if (currentSession.onOverlaySuccess) currentSession.onOverlaySuccess(result.newPath, newFileNamePreview);
            resetRenamerSession(sessionType); // ПОЛНЫЙ сброс после успеха
        } else {
            addNotification('error', `Ошибка: ${result.message}`);
        }
    };

    const handleDelete = async () => {
        if (!overlayFile) return;
        const currentPath = overlayFile.fullPath || overlayFile.path;
        const result = await window.electronAPI.deleteFile(currentPath);
        if (result.success) {
            addNotification('success', <span>Файл <strong>{overlayFile.name}</strong> удален</span>);
            if (currentSession.onOverlaySuccess) currentSession.onOverlaySuccess(null, null); // Сигнал, что файл удален
            resetRenamerSession(sessionType); // ПОЛНЫЙ сброс после удаления
        } else {
            addNotification('error', <span><strong>{overlayFile.name}</strong><br></br>{result.message}</span>);
        }
    };

    const allowedPaths = ['/archive', '/reconciliation'];
    // Убираем return null, чтобы элемент всегда был в DOM для анимации
    const shouldShow = isOverlayOpen && allowedPaths.includes(location.pathname);

    return (
        <div className={`renamer-sidebar-overlay ${shouldShow ? 'open' : ''}`} ref={sidebarRef}>
            <FileList
                currentPdfFiles={overlayFile ? [overlayFile] : []}
                selectedFile={overlayFile}
                handleFileSelect={() => { }} // В архиве выбираем только один
                onClose={() => resetRenamerSession(sessionType)}
            />
            <RenamerSection
                selectedFile={overlayFile}
                reconNumber={reconNumber}
                setReconNumber={(v) => updateField('reconNumber', v)}
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

