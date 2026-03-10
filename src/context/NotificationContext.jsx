// src/context/NotificationContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
    const [notifications, setNotifications] = useState([]);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [activeToasts, setActiveToasts] = useState([]);

    const formatTimestamp = (dateInput) => {
        const date = new Date(dateInput);
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        const now = new Date();
        const isToday = date.getDate() === now.getDate() &&
            date.getMonth() === now.getMonth() &&
            date.getFullYear() === now.getFullYear();

        if (isToday) {
            return `сегодня, ${timeStr}`;
        } else {
            const dateStr = date.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' });
            return `${dateStr}, ${timeStr}`;
        }
    };

    // Загрузка начальных логов из файла при монтировании
    useEffect(() => {
        const loadInitialLogs = async () => {
            try {
                const logs = await window.electronAPI.getInitialLogs(100);
                // Преобразуем формат лога из файла в формат уведомления
                const history = logs.map((log, index) => ({
                    id: `history-${index}-${log.timestamp}`,
                    type: log.level, // 'info', 'success', 'error', 'warning'
                    message: log.message,
                    timestamp: formatTimestamp(log.timestamp),
                    fullDate: new Date(log.timestamp),
                    context: log.context,
                    isHistory: true
                }));
                // Сортировка от новых к старым
                setNotifications(history.sort((a, b) => b.fullDate - a.fullDate));
            } catch (error) {
                console.error('Failed to load initial logs:', error);
            }
        };

        loadInitialLogs();
    }, []);

    const addNotification = useCallback(async (type, message, context = '', shouldLog = true) => {
        const now = new Date();
        const id = now.getTime();
        const timestamp = formatTimestamp(now);

        // Преобразуем React-элементы в строку для записи в лог, если нужно
        const plainMessage = React.isValidElement(message)
            ? renderToStaticMarkup(message)
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<[^>]*>?/gm, '')
            : message;

        const newNotification = {
            id,
            type,
            message, // Здесь сохраняем оригинал (может быть React-элементом для UI)
            timestamp,
            fullDate: now,
            context
        };

        // 1. Обновляем локальный стейт всех уведомлений (для сайдбара)
        // Новое уведомление всегда идет первым (от новых к старым)
        setNotifications(prev => [newNotification, ...prev].slice(0, 200)); // Ограничиваем список 200 записями

        // 2. Добавляем в активные тосты (для всплывающих окон)
        setActiveToasts(prev => [...prev, newNotification]);

        // 3. Отправляем в Main процесс для записи в файл
        if (shouldLog) {
            try {
                await window.electronAPI.logMessage(type, plainMessage, context);
            } catch (error) {
                console.error('Failed to log message to file:', error);
            }
        }

        // 4. Автоматическое удаление тоста через 5 секунд
        setTimeout(() => {
            setActiveToasts(prev => prev.filter(t => t.id !== id));
        }, 5000);
    }, []);

    const removeToast = useCallback((id) => {
        setActiveToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const toggleSidebar = useCallback(() => {
        setIsSidebarOpen(prev => !prev);
    }, []);

    return (
        <NotificationContext.Provider value={{
            notifications,
            activeToasts,
            isSidebarOpen,
            addNotification,
            removeToast,
            toggleSidebar,
            setIsSidebarOpen
        }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return context;
};

