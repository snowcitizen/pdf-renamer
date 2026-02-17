// src/components/notifications/NotificationSidebar.jsx
import React, { useRef, useEffect } from 'react';
import { useNotifications } from '../../context/NotificationContext.jsx';
import { useLocation } from 'react-router-dom';
import './notifications.css';

const NotificationSidebar = () => {
    const { notifications, isSidebarOpen, toggleSidebar, setIsSidebarOpen } = useNotifications();
    const location = useLocation();
    const scrollRef = useRef(null);
    const sidebarRef = useRef(null);

    const isOrganizerPage = location.pathname === '/organizer';
    
    // Закрывать панель при смене маршрута (если это не страница органайзера)
    useEffect(() => {
        if (!isOrganizerPage) {
            setIsSidebarOpen(false);
        }
    }, [location.pathname, setIsSidebarOpen, isOrganizerPage]);

    // Автоматический скролл вниз при новых уведомлениях
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = 0; // Новые уведомления вверху
        }
    }, [notifications]);

    // Закрытие при клике вне панели (только для плавающего режима)
    useEffect(() => {
        if (!isSidebarOpen || isOrganizerPage) return;

        const handleClickOutside = (event) => {
            if (sidebarRef.current && !sidebarRef.current.contains(event.target)) {
                // Проверяем, не является ли целью клика кнопка открытия панели (если она есть в Header или где-то еще)
                // Чтобы избежать мгновенного закрытия при попытке открытия
                const isToggleBtn = event.target.closest('.notification-toggle-btn');
                if (!isToggleBtn) {
                    setIsSidebarOpen(false);
                }
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isSidebarOpen, isOrganizerPage, setIsSidebarOpen]);

    // Если мы не в органайзере и панель закрыта — не рендерим (или скрываем через CSS)
    if (!isOrganizerPage && !isSidebarOpen) return null;

    const getIcon = (type) => {
        switch (type) {
            case 'success': return <i className="fas fa-check-circle text-success"></i>;
            case 'error': return <i className="fas fa-exclamation-circle text-error"></i>;
            case 'warning': return <i className="fas fa-exclamation-triangle text-warning"></i>;
            default: return <i className="fas fa-info-circle text-info"></i>;
        }
    };

    const sidebarClass = isOrganizerPage
        ? "notification-sidebar embedded"
        : "notification-sidebar floating";

    return (
        <aside className={sidebarClass} ref={sidebarRef}>
            <div className="sidebar-header">
                <h3><i className="fas fa-list-ul"></i> Журнал событий</h3>
                <div className="header-actions">
                    {!isOrganizerPage && (
                        <button className="icon-btn close-btn" onClick={toggleSidebar}>
                            <i className="fas fa-times"></i>
                        </button>
                    )}
                </div>
            </div>
            
            <div className="sidebar-content custom-scrollbar" ref={scrollRef}>
                {notifications.length === 0 ? (
                    <div className="empty-logs">Журнал пуст</div>
                ) : (
                    notifications.map((notif) => (
                        <div key={notif.id} className={`log-entry ${notif.type}`}>
                            <div className="log-icon">{getIcon(notif.type)}</div>
                            <div className="log-body">
                                <div className="log-meta">
                                    <span className="log-time">{notif.timestamp}</span>
                                    {notif.isHistory && <span className="log-badge">история</span>}
                                </div>
                                <div className="log-message">{notif.message}</div>
                                {notif.context && <div className="log-context">{notif.context}</div>}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </aside>
    );
};

export default NotificationSidebar;

