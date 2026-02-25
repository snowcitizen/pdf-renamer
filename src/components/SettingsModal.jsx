import React, { useState, useEffect } from 'react';
import CounterpartiesModal from './CounterpartiesModal.jsx';
import { useSettings } from '../context/SettingsContext.jsx';

const TagEditor = ({ tags, onChange, placeholder }) => {
    const [inputValue, setInputValue] = useState('');

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addTag();
        } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
            removeTag(tags.length - 1);
        }
    };

    const addTag = () => {
        const value = inputValue.trim().replace(/,$/, '');
        if (value && !tags.includes(value)) {
            // Добавляем и сразу сортируем по алфавиту
            const newTags = [...tags, value].sort((a, b) => a.localeCompare(b, 'ru'));
            onChange(newTags);
            setInputValue('');
        }
    };

    const removeTag = (index) => {
        onChange(tags.filter((_, i) => i !== index));
    };

    return (
        <div className="tags-container" onClick={() => document.getElementById(`tag-input-${placeholder}`).focus()}>
            {tags.map((tag, index) => (
                <div key={index} className="tag-item">
                    {tag}
                    <span className="tag-remove" onClick={(e) => { e.stopPropagation(); removeTag(index); }}>&times;</span>
                </div>
            ))}
            <input
                id={`tag-input-${placeholder}`}
                type="text"
                className="tag-input"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={addTag}
                placeholder={tags.length === 0 ? placeholder : ''}
            />
        </div>
    );
};

const SettingsModal = ({ isOpen, onClose, onSettingsSaved }) => {
    const { settings: globalSettings, updateSettings } = useSettings();
    const [settings, setSettings] = useState({
        baseDrive: '',
        companies: [],
        docTypes: [],
        legalForms: []
    });
        const [isCounterpartiesOpen, setIsCounterpartiesOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('general');
    const [appVersion, setAppVersion] = useState('');
    const [updateStatus, setUpdateStatus] = useState({ status: 'idle' });

    useEffect(() => {
        if (isOpen) {
            window.electronAPI.getAppVersion().then(setAppVersion);
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        const cleanup = window.electronAPI.on('updater:status', (data) => {
            setUpdateStatus(data);
        });

        return cleanup;
    }, [isOpen]);

    const handleCheckUpdates = () => {
        setUpdateStatus({ status: 'checking' });
        window.electronAPI.checkForUpdates();
    };

    const handleInstallUpdate = () => {
        window.electronAPI.quitAndInstall();
    };

    useEffect(() => {
        if (isOpen && globalSettings) {
            // При открытии сортируем списки тегов по алфавиту
            const sortedSettings = {
                ...globalSettings,
                docTypes: [...(globalSettings.docTypes || [])].sort((a, b) => a.localeCompare(b, 'ru')),
                legalForms: [...(globalSettings.legalForms || [])].sort((a, b) => a.localeCompare(b, 'ru'))
            };
            setSettings(sortedSettings);
        }
    }, [isOpen, globalSettings]);

    const handleSave = async () => {
        const result = await updateSettings(settings);
        if (result.success) {
            if (onSettingsSaved) onSettingsSaved(settings);
            onClose();
        } else {
            alert('Ошибка при сохранении настроек: ' + result.error);
        }
    };

    const handleSelectBaseDrive = async () => {
        const path = await window.electronAPI.selectFolder();
        if (path) {
            setSettings({ ...settings, baseDrive: path });
        }
    };

    const handleClearBaseDrive = () => {
        if (window.confirm('Вы уверены, что хотите очистить основной путь? Это также удалит все добавленные компании из настроек.')) {
            setSettings({
                ...settings,
                baseDrive: '',
                companies: []
            });
        }
    };

    const handleSelectCompanyFolder = async (index) => {
        if (!settings.baseDrive) {
            alert('Сначала выберите основной путь');
            return;
        }
        const path = await window.electronAPI.selectFolder(settings.baseDrive);
        if (path) {
            // Проверяем, что папка находится внутри baseDrive
            if (!path.startsWith(settings.baseDrive)) {
                alert('Папка компании должна находиться внутри основного пути');
                return;
            }

            // Получаем только название папки
            let folderName = path.substring(settings.baseDrive.length);
            if (folderName.startsWith('\\') || folderName.startsWith('/')) {
                folderName = folderName.substring(1);
            }

            updateCompany(index, 'folder', folderName);
        }
    };

    const addCompany = () => {
        setSettings({
            ...settings,
            companies: [...settings.companies, { name: '', folder: '' }]
        });
    };

    const removeCompany = (index) => {
        const newCompanies = settings.companies.filter((_, i) => i !== index);
        setSettings({ ...settings, companies: newCompanies });
    };

    const updateCompany = (index, field, value) => {
        const newCompanies = [...settings.companies];
        newCompanies[index] = { ...newCompanies[index], [field]: value };
        setSettings({ ...settings, companies: newCompanies });
    };

    const handleTagChange = (field, newTags) => {
        setSettings({ ...settings, [field]: newTags });
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content settings-modal">
                <div className="modal-header">
                    <h3>Настройки</h3>
                    <button className="close-btn" onClick={onClose}>&times;</button>
                </div>

                <div className="settings-tabs">
                    <button
                        className={`tab-btn ${activeTab === 'general' ? 'active' : ''}`}
                        onClick={() => setActiveTab('general')}
                    >
                        Основные
                    </button>
                                        <button
                        className={`tab-btn ${activeTab === 'renamer' ? 'active' : ''}`}
                        onClick={() => setActiveTab('renamer')}
                    >
                        Переименование
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'updates' ? 'active' : ''}`}
                        onClick={() => setActiveTab('updates')}
                    >
                        Обновления
                    </button>
                </div>

                <div className="modal-body">
                    {activeTab === 'general' && (
                        <div className="tab-content">
                            <div className="settings-group">
                                <label>Основной путь:</label>
                                <div className="path-selection">
                                    <div className="path-display">{settings.baseDrive || 'Путь не выбран'}</div>
                                    <button className="btn btn-secondary" onClick={handleSelectBaseDrive}>
                                        <i className="fa-solid fa-folder-open"></i> Выбрать
                                    </button>
                                    {settings.baseDrive && (
                                        <button
                                            className="btn btn-danger btn-icon"
                                            onClick={handleClearBaseDrive}
                                            title="Очистить основной путь"
                                        >
                                            <i className="fa-solid fa-xmark"></i>
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="settings-group">
                                <div className="group-header">
                                    <label>Компании:</label>
                                    <button
                                        className="btn btn-secondary btn-small"
                                        onClick={addCompany}
                                        disabled={!settings.baseDrive}
                                        title={!settings.baseDrive ? "Сначала выберите основной путь" : ""}
                                    >
                                        <i className="fa-solid fa-plus"></i> Добавить
                                    </button>
                                </div>

                                <div className="companies-list">
                                    {settings.companies.map((company, index) => (
                                        <div key={index} className="company-card">
                                            <div className="company-field">
                                                <span>Название:</span>
                                                <input
                                                    type="text"
                                                    placeholder="Напр: ООО Стройэлемент"
                                                    value={company.name}
                                                    onChange={(e) => updateCompany(index, 'name', e.target.value)}
                                                />
                                            </div>
                                            <div className="company-field">
                                                <span>Папка:</span>
                                                <div className="path-selection">
                                                    <div className="path-display">{company.folder || 'Папка не выбрана'}</div>
                                                    <button className="btn btn-secondary btn-icon" onClick={() => handleSelectCompanyFolder(index)}>
                                                        <i className="fa-solid fa-folder-open"></i>
                                                    </button>
                                                </div>
                                            </div>
                                            <button
                                                className="btn btn-danger btn-icon btn-remove"
                                                onClick={() => removeCompany(index)}
                                                title="Удалить компанию"
                                            >
                                                <i className="fa-solid fa-xmark"></i>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'renamer' && (
                        <div className="tab-content">
                            <div className="settings-group">
                                <label>Справочник:</label>
                                <button className="btn btn-secondary" onClick={() => setIsCounterpartiesOpen(true)}>
                                    <i className="fa-solid fa-users"></i> Открыть справочник контрагентов
                                </button>
                                <small className="help-text">Список контрагентов для быстрого выбора при переименовании.</small>
                            </div>

                            <div className="settings-group">
                                <label>Типы документов:</label>
                                <TagEditor
                                    tags={settings.docTypes}
                                    onChange={(newTags) => handleTagChange('docTypes', newTags)}
                                    placeholder="Напр: УПД (нажмите Enter для добавления)"
                                />
                                <small className="help-text">Эти типы будут доступны в выпадающем списке при переименовании.</small>
                            </div>

                                                        <div className="settings-group">
                                <label>Формы собственности:</label>
                                <TagEditor
                                    tags={settings.legalForms}
                                    onChange={(newTags) => handleTagChange('legalForms', newTags)}
                                    placeholder="Напр: ооо (нажмите Enter для добавления)"
                                />
                                <small className="help-text">Используются для очистки имен контрагентов при автоматическом распознавании.</small>
                            </div>
                        </div>
                    )}

                    {activeTab === 'updates' && (
                        <div className="tab-content">
                            <div className="update-info">
                                <div className="info-row">
                                    <span className="info-label">Текущая версия:</span>
                                    <span className="info-value">{appVersion}</span>
                                </div>
                                
                                <div className="update-status-box">
                                    {updateStatus.status === 'idle' && (
                                        <p>Проверьте наличие новой версии программы.</p>
                                    )}
                                    {updateStatus.status === 'checking' && (
                                        <p><i className="fa-solid fa-spinner fa-spin"></i> Проверка обновлений...</p>
                                    )}
                                    {updateStatus.status === 'available' && (
                                        <div className="status-msg success">
                                            <p><i className="fa-solid fa-circle-info"></i> Доступна новая версия: <strong>{updateStatus.info?.version}</strong></p>
                                            <p className="small">Загрузка началась автоматически...</p>
                                        </div>
                                    )}
                                    {updateStatus.status === 'not-available' && (
                                        <div className="status-msg">
                                            <p><i className="fa-solid fa-circle-check"></i> У вас установлена актуальная версия.</p>
                                        </div>
                                    )}
                                    {updateStatus.status === 'downloaded' && (
                                        <div className="status-msg success">
                                            <p><i className="fa-solid fa-circle-check"></i> Версия <strong>{updateStatus.info?.version}</strong> готова к установке.</p>
                                            <button className="btn btn-primary" onClick={handleInstallUpdate}>
                                                Перезагрузить и обновить
                                            </button>
                                        </div>
                                    )}
                                    {updateStatus.status === 'error' && (
                                        <div className="status-msg error">
                                            <p><i className="fa-solid fa-circle-exclamation"></i> Ошибка при проверке обновлений:</p>
                                            <p className="small">{updateStatus.message}</p>
                                        </div>
                                    )}
                                </div>

                                <button 
                                    className="btn btn-secondary" 
                                    onClick={handleCheckUpdates}
                                    disabled={updateStatus.status === 'checking'}
                                >
                                    <i className="fa-solid fa-rotate"></i> Проверить сейчас
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Отмена</button>
                    <button className="btn btn-primary" onClick={handleSave}>Сохранить</button>
                </div>
            </div>

            <CounterpartiesModal
                isOpen={isCounterpartiesOpen}
                onClose={() => setIsCounterpartiesOpen(false)}
            />
        </div>
    );
};

export default SettingsModal;