// src/StatusMessage.jsx
// Переиспользуемый компонент для отображения статусных сообщений

import React, { useState, useEffect } from 'react';

const StatusMessage = ({ message, type }) => {
    // Состояние 'show' и useEffect для таймера больше не нужны,
    // так как сообщение не будет автоматически скрываться.

    // Сообщение будет отображаться всегда, пока в пропсе 'message' есть текст.
    if (!message) {
        return null;
    }

    const statusClasses = `status-message ${type} show`; // Всегда добавляем 'show' класс, чтобы сообщение было видно

    return (
        <div className={statusClasses}>
            {message}
        </div>
    );
};

export default StatusMessage;
