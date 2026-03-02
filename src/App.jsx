// src/App.jsx

import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import './styles/style.css';
import '@fortawesome/fontawesome-free/css/all.min.css';

import ArchiveView from './ArchiveView.jsx';
import RenamerView from './RenamerView.jsx';
import FileOrganizer from './FileOrganizer.jsx';
import ReconciliationView from './ReconciliationView.jsx'; // Added import for ReconciliationView
import CompanySelectionModal from './components/CompanySelectionModal.jsx';
import SettingsModal from './components/SettingsModal.jsx'; // Added import

import Header from './components/Header.jsx';
import { SettingsProvider } from './context/SettingsContext.jsx';
import { FileContextProvider } from './context/FileContext.jsx';
import { ArchiveContextProvider } from './context/ArchiveContext.jsx';
import { ReconciliationProvider } from './context/ReconciliationContext.jsx'; // Added import for ReconciliationProvider
import { NotificationProvider } from './context/NotificationContext.jsx';
import { RenamerProvider } from './context/RenamerContext.jsx';
import ToastContainer from './components/notifications/ToastContainer.jsx';
import NotificationSidebar from './components/notifications/NotificationSidebar.jsx';
import RenamerSidebarOverlay from './components/RenamerSidebarOverlay.jsx';
import { useNotifications } from './context/NotificationContext.jsx';

const UpdaterHandler = () => {
    const { addNotification } = useNotifications();

    useEffect(() => {
        // 1. Слушаем ответы от апдейтера
        const unsub = window.electronAPI.on('updater:status', (data) => {
            switch (data.status) {
                case 'available':
                    addNotification('info', `Найдено обновление ${data.info.version}. Загрузка...`, '', false);
                    break;
                case 'downloaded':
                    addNotification('success', `Обновление ${data.info.version} скачано и будет установлено после перезапуска программы.`, '', false);
                    break;
                /*case 'not-available':
                    addNotification('info', 'У вас установлена последняя версия программы.', '', false);
                    break;*/
                case 'error':
                    addNotification('error', `Ошибка обновления: ${data.message}`, '', false);
                    break;
            }
        });

        // 2. Запускаем проверку через 10 секунд
        const timer = setTimeout(() => {
            window.electronAPI.checkForUpdates();
        }, 10000);

        return () => {
            unsub && unsub();
            clearTimeout(timer);
        };
    }, [addNotification]);

    return null;
};

const App = () => {
    const [dark, setDark] = useState(false);

    useEffect(() => {
        // запрос текущей темы
        window.electronAPI.getDark().then(setDark);

        // подписка на изменения
        const unsub = window.electronAPI.onThemeChange((isDark) => setDark(isDark));
        return () => unsub && unsub();
    }, []);

    const [isRenaming, setIsRenaming] = useState(false);
    const [isOrganizing, setIsOrganizing] = useState(false);

    const [selectedFile, setSelectedFile] = useState(null);
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(true);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false); // Added state for SettingsModal

    useEffect(() => {
        if (selectedCompany) {
            // Если компания была выбрана, а потом удалена из настроек, нужно это обработать
            window.electronAPI.getSettings().then(settings => {
                const stillExists = settings.companies.some(c => c.name === selectedCompany);
                if (!stillExists) setSelectedCompany(null);
            });
        }
    }, [isSettingsOpen, selectedCompany]); // Added selectedCompany to dependencies

    const handleCompanySelected = async (company) => {
        setSelectedCompany(company);

        setIsCompanyModalOpen(false);
    };

    useEffect(() => {
        document.body.classList.toggle('dark', dark);
    }, [dark]);

        return (
        <NotificationProvider>
            <RenamerProvider>
                <UpdaterHandler />
                <SettingsProvider>
                    <FileContextProvider
                        selectedCompany={selectedCompany}
                        isRenaming={isRenaming}
                        isOrganizing={isOrganizing}
                    >
                        <ArchiveContextProvider selectedCompany={selectedCompany}>
                            <ReconciliationProvider>
                                <Router>
                                    <ToastContainer />
                                    <div className="container">
                                        <Header
                                            selectedCompany={selectedCompany}
                                            //currentFolder={currentFolder}

                                            onOpenCompanyModal={() => setIsCompanyModalOpen(true)}
                                            onOpenSettings={() => setIsSettingsOpen(true)} // Added prop for SettingsModal
                                        />

                                        <div className="main-container">
                                            <CompanySelectionModal
                                                isOpen={isCompanyModalOpen}
                                                onClose={() => setIsCompanyModalOpen(false)}
                                                onSelectCompany={handleCompanySelected}
                                            />

                                            {/* Added SettingsModal */}
                                            <SettingsModal
                                                isOpen={isSettingsOpen}
                                                onClose={() => setIsSettingsOpen(false)}
                                                onSettingsSaved={() => {
                                                    // Обновление теперь через контекст, reload не обязателен, 
                                                    // но оставим для надежности если другие части не на контексте
                                                    // window.location.reload();
                                                }}
                                            />
                                            <Routes>
                                                <Route path="/" element={<Navigate to="/archive" replace />} />
                                                <Route
                                                    path="/archive"
                                                    element={<ArchiveView
                                                        selectedCompany={selectedCompany}
                                                    />} />
                                                <Route
                                                    path="/renamer"
                                                    element={
                                                        <RenamerView
                                                            selectedCompany={selectedCompany}
                                                            setIsRenaming={setIsRenaming}
                                                        />
                                                    }
                                                />
                                                <Route
                                                    path="/organizer"
                                                    element={
                                                        <FileOrganizer
                                                            selectedCompany={selectedCompany}
                                                            setIsOrganizing={setIsOrganizing}
                                                        />
                                                    }
                                                />
                                                <Route
                                                    path="/reconciliation"
                                                    element={<ReconciliationView selectedCompany={selectedCompany} />}
                                                />
                                                <Route path="*" element={<Navigate to="/archive" replace />} />
                                            </Routes>
                                            <RenamerSidebarOverlay selectedCompany={selectedCompany} />
                                            <NotificationSidebar />
                                        </div>
                                    </div>
                                </Router>
                            </ReconciliationProvider>
                        </ArchiveContextProvider>
                    </FileContextProvider>
                </SettingsProvider>
            </RenamerProvider>
        </NotificationProvider>
    );
};

const container = document.getElementById('root');
const root = ReactDOM.createRoot(container);
root.render(<App />);

