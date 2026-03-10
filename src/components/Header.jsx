import { NavLink, useLocation } from "react-router-dom";
import React from 'react';
import { useNotifications } from "../context/NotificationContext.jsx";

const Header = ({
    selectedCompany,
    currentFolder,
    handleSelectFolder,
    onOpenCompanyModal,
    onOpenSettings,
    loadedCounterparties
}) => {
    const { toggleSidebar, isSidebarOpen } = useNotifications();
    const location = useLocation();
    const [hasCompanies, setHasCompanies] = React.useState(true); // Added: State to track if any companies exist

    const isOrganizerPage = location.pathname === '/organizer';
    const isSidebarActive = isSidebarOpen && !isOrganizerPage;

    // Added: Effect to check for companies from settings
    React.useEffect(() => {
        // This assumes 'window.electronAPI' is available in an Electron environment
        // and has a 'getSettings' method that returns a Promise.
        if (window.electronAPI && window.electronAPI.getSettings) {
            window.electronAPI.getSettings().then(settings => {
                setHasCompanies(settings.companies && settings.companies.length > 0);
            });
        } else {
            // Fallback for non-Electron environments or if electronAPI is not available
            // You might want to log a warning or handle this differently based on your setup.
            console.warn("window.electronAPI or getSettings not available. Assuming companies exist for UI consistency.");
            setHasCompanies(true); // Default to true if not in Electron context
        }
    }, [selectedCompany]); // Rerun when selectedCompany changes

    // Added: Helper function to determine button text
    const getCompanyBtnText = () => {
        if (selectedCompany) return `${selectedCompany}`;
        return hasCompanies ? 'Выберите компанию' : 'Добавьте компанию';
    };

    const isLinkDisabled = !selectedCompany; // Added: Constant to determine if navigation links should be disabled

    return (
        <header className="app-header">
            <div className="left-section">
                {/*<h1>{selectedCompany}</h1>*/}
            </div>

            <div className="center-section">
                <NavLink
                    to="/archive"
                    className={({ isActive }) => `btn outline ${isActive ? 'active' : ''} ${isLinkDisabled ? 'disabled' : ''}`}
                    onClick={(e) => isLinkDisabled && e.preventDefault()}
                >
                    Архив
                </NavLink>
                <NavLink
                    to="/reconciliation"
                    className={({ isActive }) => `btn outline ${isActive ? 'active' : ''} ${isLinkDisabled ? 'disabled' : ''}`}
                    onClick={(e) => isLinkDisabled && e.preventDefault()}
                >
                    Сверка
                </NavLink>
                <NavLink
                    to="/renamer"
                    className={({ isActive }) => `btn outline ${isActive ? 'active' : ''} ${isLinkDisabled ? 'disabled' : ''}`}
                    onClick={(e) => isLinkDisabled && e.preventDefault()}
                >
                    Переименовать
                </NavLink>
                <NavLink
                    to="/organizer"
                    className={({ isActive }) => `btn outline ${isActive ? 'active' : ''} ${isLinkDisabled ? 'disabled' : ''}`}
                    onClick={(e) => isLinkDisabled && e.preventDefault()}
                >
                    Упорядочить
                </NavLink>
            </div>

            <div className="right-section">
                <button
                    onClick={onOpenCompanyModal}
                    className="btn btn-primary"
                >
                    {getCompanyBtnText()}
                </button>

                {/* Added: New button for settings */}
                <button
                    onClick={onOpenSettings}
                    className="btn btn-icon settings-btn"
                    title="Настройки"
                >
                    <i className="fa-solid fa-gear"></i>
                </button>

                {/* Кнопка уведомлений */}
                <button
                    onClick={toggleSidebar}
                    className={`btn btn-icon notification-toggle-btn ${isSidebarActive ? 'active' : ''} ${isOrganizerPage ? 'disabled' : ''}`}
                    title="Журнал событий"
                    disabled={isOrganizerPage}
                >
                    <i className="fa-solid fa-bell"></i>
                </button>
            </div>
        </header>
    );
};

export default Header;

