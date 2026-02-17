// src/components/PdfViewer.jsx
import React from "react";


const PdfViewer = ({ selectedFile }) => {
    return (
        <div className="pdf-viewer-panel">
            <iframe
                id="pdf-viewer"
                className="pdf-viewer-iframe"
                src={selectedFile ? `pdf-viewer://${encodeURIComponent(selectedFile.path)}` : ''}
            ></iframe>
        </div>
    );
};

export default PdfViewer;