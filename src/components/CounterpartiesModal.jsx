import React, { useState, useEffect, useMemo } from 'react';

const CounterpartiesModal = ({ isOpen, onClose }) => {
    const [counterparties, setCounterparties] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [newCounterparty, setNewCounterparty] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen) {
            loadCounterparties();
        }
    }, [isOpen]);

    const loadCounterparties = async () => {
        const data = await window.electronAPI.getCounterparties();
        setCounterparties(data.sort());
        setLoading(false);
    };

    const handleAdd = async () => {
        if (!newCounterparty.trim()) return;
        if (counterparties.includes(newCounterparty.trim())) {
            alert('Такой контрагент уже существует');
            return;
        }

        const newList = [...counterparties, newCounterparty.trim()].sort();
        const result = await window.electronAPI.saveCounterparties(newList);
        if (result.success) {
            setCounterparties(newList);
            setNewCounterparty('');
        }
    };

    const handleDelete = async (name) => {
        if (!window.confirm(`Удалить контрагента "${name}"?`)) return;

        const newList = counterparties.filter(c => c !== name);
        const result = await window.electronAPI.saveCounterparties(newList);
        if (result.success) {
            setCounterparties(newList);
        }
    };

    const handleImport = async () => {
        try {
            const imported = await window.electronAPI.importCounterpartiesFromFile();
            if (!imported) return;

            const combined = Array.from(new Set([...counterparties, ...imported])).sort();
            const result = await window.electronAPI.saveCounterparties(combined);
            if (result.success) {
                setCounterparties(combined);
                alert(`Импортировано новых контрагентов: ${combined.length - counterparties.length}`);
            }
        } catch (e) {
            alert('Ошибка при импорте: ' + e.message);
        }
    };

    const filteredCounterparties = useMemo(() => {
        return counterparties.filter(c => 
            c.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [counterparties, searchQuery]);

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content counterparties-modal">
                <div className="modal-header">
                    <h3>Справочник контрагентов ({counterparties.length})</h3>
                    <button className="close-btn" onClick={onClose}>&times;</button>
                </div>

                <div className="modal-body">
                    <div className="cp-controls">
                        <div className="cp-add-section">
                            <input 
                                type="text" 
                                className="input-field" 
                                placeholder="Новый контрагент..."
                                value={newCounterparty}
                                onChange={(e) => setNewCounterparty(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                            />
                            <button className="btn btn-primary" onClick={handleAdd}>
                                <i className="fa-solid fa-plus"></i> Добавить
                            </button>
                        </div>
                        
                        <div className="cp-actions">
                            <button className="btn btn-secondary" onClick={handleImport}>
                                <i className="fa-solid fa-file-import"></i> Импорт из TXT
                            </button>
                            <div className="cp-search">
                                <i className="fa-solid fa-magnifying-glass"></i>
                                <input 
                                    type="text" 
                                    placeholder="Поиск..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="cp-list-container">
                        {loading ? (
                            <div className="loading">Загрузка...</div>
                        ) : (
                            <table className="cp-table">
                                <thead>
                                    <tr>
                                        <th>Название</th>
                                        <th style={{ width: '50px' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredCounterparties.map((name, index) => (
                                        <tr key={index}>
                                            <td>{name}</td>
                                            <td>
                                                <button 
                                                    className="btn btn-danger btn-icon btn-small"
                                                    onClick={() => handleDelete(name)}
                                                >
                                                    <i className="fa-solid fa-trash"></i>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                        {!loading && filteredCounterparties.length === 0 && (
                            <div className="no-results">Ничего не найдено</div>
                        )}
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Закрыть</button>
                </div>
            </div>
        </div>
    );
};

export default CounterpartiesModal;

