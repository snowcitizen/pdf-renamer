import React from 'react';
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import SortableFile from './SortableFile';

// FileContainer - компонент для несопоставленных файлов
const FileContainer = ({ files, containerId, hoveredRow }) => {
    const { setNodeRef, isOver } = useDroppable({ id: containerId });
    const activeHighlight = isOver || String(hoveredRow) === String(containerId);

    return (
        <li
            ref={setNodeRef}
            className={`matched-file-item ${files.length === 0 ? 'empty' : ''} ${activeHighlight ? 'drop-over' : ''}`}
        >
            <div className="file-items-wrapper">
                <SortableContext items={files.map(f => f.id)} strategy={verticalListSortingStrategy}>
                    {files.map(file => (
                        <SortableFile key={file.id} id={file.id} content={file.content} containerId={containerId} />
                    ))}
                </SortableContext>
            </div>
        </li>
    );
};

export default FileContainer;