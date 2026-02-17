// src/reconciliation/components/FileItem.jsx
import React from 'react';
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const FileItem = ({ file, containerId, isDraggable, isDragging }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({
        id: file.id,
        data: { containerId: containerId },
        disabled: !isDraggable, // Отключаем перетаскивание, если файл - копия
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 10 : 1,
        cursor: isDraggable ? 'grab' : 'default',
    };

    const itemClass = `file-item file-item--${file.type}`;

    if (isDraggable) {
        return (
            <div
                ref={setNodeRef}
                style={style}
                {...attributes}
                {...listeners}
                className={itemClass}
            >
                {file.content}
            </div>
        );
    }

    return (
        <li className={`${itemClass} copy-item`}>
            {file.content}
        </li>
    );
};

export default FileItem;