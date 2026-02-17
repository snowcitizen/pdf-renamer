import React from 'react';
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import FileItem from './FileItem';

const UnmatchedFilesList = ({ files, hoveredRow }) => {
    const { setNodeRef, isOver } = useDroppable({ id: "unmatched-files" });

    const activeHighlight = isOver || String(hoveredRow) === 'unmatched-files';
    const fileIds = files.map(file => file.id);

    return (
        <SortableContext items={fileIds} strategy={verticalListSortingStrategy}>
            <ul ref={setNodeRef} className={`reconciliation-file-list reconciliation-file-list--unmatched ${activeHighlight ? 'drop-over' : ''}`}>
                {files.map((file) => (
                    <FileItem key={file.id} file={file} containerId="unmatched-files" isDraggable={true} />
                ))}
            </ul>
        </SortableContext>
    );
};

export default UnmatchedFilesList;