// src/components/notifications/Toast.jsx
import React, { useEffect, useState } from 'react';

const Toast = ({ notification, onRemove }) => {
    const [isClosing, setIsClosing] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsClosing(true);
            setTimeout(onRemove, 300); // Даем время на анимацию закрытия
        }, 5000);

        return () => clearTimeout(timer);
    }, [onRemove]);

    const getIcon = () => {
        switch (notification.type) {
            case 'success': return <i className="fas fa-check-circle"></i>;
            case 'error': return <i className="fas fa-exclamation-circle"></i>;
            case 'warning': return <i className="fas fa-exclamation-triangle"></i>;
            default: return <i className="fas fa-info-circle"></i>;
        }
    };

    const handleContextMenu = (e) => {
        e.preventDefault(); // Предотвращаем появление стандартного контекстного меню
        setIsClosing(true);
        setTimeout(onRemove, 300);
    };

    return (
        <div
            className={`toast-item ${notification.type} ${isClosing ? 'closing' : ''}`}
            onContextMenu={handleContextMenu}
        >
            <div className="toast-icon">
                {getIcon()}
            </div>
            <div className="toast-content">
                <div className="toast-message">{notification.message}</div>
                {notification.context && (
                    <div className="toast-context">{notification.context}</div>
                )}
            </div>
            <button className="toast-close" onClick={() => {
                setIsClosing(true);
                setTimeout(onRemove, 300);
            }}>
                <i className="fas fa-times"></i>
            </button>
            <div className="toast-progress-bar"></div>
        </div>
    );
};

export default Toast;

