import React from 'react';
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import SortableFile from './SortableFile';

// DroppableRow - строка Excel, drop-зона
const DroppableRow = ({ item, hoveredRow }) => {
    const { setNodeRef, isOver } = useDroppable({ id: String(item.number) });
    const activeHighlight = isOver || String(hoveredRow) === String(item.number);

    let statusIcon;
    let listItemClass = `matched-file-item ${activeHighlight ? 'drop-over' : ''}`;

    switch (item.status) {
        case 'empty':
            statusIcon = '❌';
            listItemClass += ' empty';
            break;
        case 'ready':
            statusIcon = '🟡';
            break;
        case 'check':
            statusIcon = '⚠️';
            break;
        case 'renamed':
            statusIcon = '✅';
            break;
        case 'renamed-now':
            statusIcon = '✅';
            listItemClass += ' renamed-now';
            break;
        default:
            statusIcon = '';
            break;
    }

    return (
        <li ref={setNodeRef} className={listItemClass}>
            <div className="status-indicator">{statusIcon}</div>
            <span className="file-number">{String(item.number).padStart(3, '0')}</span>
            <div className="file-items-wrapper">
                <SortableContext items={item.matchedFiles.map(f => f.id)} strategy={verticalListSortingStrategy}>
                    {item.matchedFiles.map(file => (
                        <SortableFile key={file.id} id={file.id} content={file.content} containerId={String(item.number)} />
                    ))}
                </SortableContext>
            </div>
        </li>
    );
};

export default DroppableRow;