// src/components/notifications/ToastContainer.jsx
import React from 'react';
import { useNotifications } from '../../context/NotificationContext.jsx';
import Toast from './Toast.jsx';
import './notifications.css';

const ToastContainer = () => {
    const { activeToasts, removeToast } = useNotifications();

    // Показываем только последние 3 тоста
    const displayToasts = activeToasts.slice(-3);

    return (
        <div className="toast-container">
            {displayToasts.map((toast) => (
                <Toast 
                    key={toast.id} 
                    notification={toast} 
                    onRemove={() => removeToast(toast.id)} 
                />
            ))}
        </div>
    );
};

export default ToastContainer;
