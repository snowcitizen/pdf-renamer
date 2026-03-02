// src/components/RenamerSection.jsx
import React from "react";
import StatusMessage from './StatusMessage.jsx';
import { useSettings } from '../context/SettingsContext.jsx';

const RenamerSection = ({
    selectedFile,
    docDate,
    setDocDate,
    docType,
    setDocType,
    docNumber,
    setDocNumber,
    counterparty,
    setCounterparty,
    originalCopy,
    setOriginalCopy,
    newFileNamePreview,
            handleRenameFile,
    handleDeleteFile,
    docDateInputRef,
    loadedCounterparties
}) => {
    const { settings } = useSettings();

    return (
        <div className="renamer-section">
            <div className="form-group">
                <label htmlFor="doc-date">Дата документа:</label>
                <div className="input-wrapper">
                    <input
                        type="date"
                        id="doc-date"
                        ref={docDateInputRef}
                        className={`form-control ${!docDate ? 'input-error' : ''}`}
                        value={docDate}
                        onChange={(e) => setDocDate(e.target.value)}
                    />
                </div>
            </div>
            <div className="form-group">
                <label htmlFor="doc-type">Тип документа:</label>
                <div className="input-wrapper">
                    <select
                        id="doc-type"
                        className={`form-control ${!docType ? 'input-error' : ''}`}
                        value={docType}
                        onChange={(e) => setDocType(e.target.value)}
                    >
                        <option value="">Выберите тип</option>
                        {settings.docTypes.map(type => (
                            <option key={type} value={type}>{type}</option>
                        ))}
                    </select>
                </div>
            </div>
            <div className="form-group">
                <label htmlFor="doc-number">Номер документа:</label>
                <div className="input-wrapper">
                    <input
                        type="text"
                        id="doc-number"
                        className={`form-control ${!docNumber ? 'input-error' : ''}`}
                        placeholder="Например, 678"
                        value={docNumber}
                        onChange={(e) => setDocNumber(e.target.value)}
                    />
                </div>
            </div>
            <div className="form-group">
                <label htmlFor="counterparty">Контрагент:</label>
                <div className="input-wrapper">
                    <input
                        type="text"
                        id="counterparty"
                        className={`form-control ${!counterparty ? 'input-error' : ''}`}
                        placeholder="Например, ИП Журба И.С."
                        list="counterparty-suggestions"
                        value={counterparty}
                        onChange={(e) => setCounterparty(e.target.value)}
                    />
                    <datalist id="counterparty-suggestions">
                        {loadedCounterparties.map((cp) => (
                            <option key={cp} value={cp} />
                        ))}
                    </datalist>
                </div>
            </div>
            <div className="form-group">
                <label htmlFor="original-copy">Отметка:</label>
                <div className="input-wrapper">
                    <select
                        id="original-copy"
                        className={`form-control ${!originalCopy ? 'input-error' : ''}`}
                        value={originalCopy}
                        onChange={(e) => setOriginalCopy(e.target.value)}
                    >
                        <option value="">Выберите отметку</option>
                        <option value="О">Оригинал</option>
                        <option value="К">Копия</option>
                    </select>
                </div>
            </div>

            <div className="rename-button-wrapper">
                <button
                    onClick={handleRenameFile}
                    id="rename-btn"
                    className="btn btn-success"
                    disabled={
                        !selectedFile ||
                        !docDate ||
                        !docType ||
                        !docNumber ||
                        !counterparty ||
                        !originalCopy
                    }
                >
                    Переименовать
                </button>
                <button
                    className="btn btn-danger"
                    onClick={handleDeleteFile}
                    disabled={!selectedFile}
                    tabIndex="-1"
                    title="Удалить выбранный файл"
                >
                    Удалить
                </button>
            </div>

            <div className="preview-group">
                <label>Предварительный просмотр:</label>
                <span className="new-file-name-preview">
                    {newFileNamePreview}
                </span>
            </div>
        </div>
    );
}

export default RenamerSection;