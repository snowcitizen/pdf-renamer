const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getDark: () => ipcRenderer.invoke('get-dark-mode'),
    onThemeChange: (cb) => ipcRenderer.on('theme-changed', (_, isDark) => cb(isDark)),

    getCounterparties: () => ipcRenderer.invoke('get-counterparties'),
    saveCounterparties: (list) => ipcRenderer.invoke('save-counterparties', list),
    importCounterpartiesFromFile: () => ipcRenderer.invoke('import-counterparties-from-file'),

    getPdfFiles: (folderPath) => ipcRenderer.invoke('get-pdf-files', folderPath),
    readArchive: (options) => ipcRenderer.invoke('read-archive', options),

    getCompanyArchivePath: (companyName) => ipcRenderer.invoke('get-company-archive-path', companyName),
    getCompanyTempPath: (company) => ipcRenderer.invoke("get-company-temp-path", company),
    getSourceDataForReconciliation: (excelFilePath) => ipcRenderer.invoke("get-source-data-for-reconciliation", excelFilePath),

    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
    selectFolder: (startPath) => ipcRenderer.invoke('select-folder', startPath), // Added line
    findReconciliationFiles: (companyName) => ipcRenderer.invoke('find-reconciliation-files', companyName),

    renameFile: (oldPath, newName) => ipcRenderer.invoke('rename-file', oldPath, newName),
    deleteFile: (filePath) => ipcRenderer.invoke('delete-file', filePath),
    organizeFiles: (filesToMove) => ipcRenderer.invoke('organize-files', filesToMove),

    // Логирование
    logMessage: (level, message, context) => ipcRenderer.invoke('api:log-message', { level, message, context }),
    getInitialLogs: (limit) => ipcRenderer.invoke('api:get-initial-logs', limit),

    parsePath: (filePath) => ipcRenderer.invoke('parse-path', filePath),

    // Watcher
    watchPath: (key, path, options) => ipcRenderer.invoke('watcher:watch', { key, path, options }),
    unwatchPath: (key) => ipcRenderer.invoke('watcher:unwatch', key),
    openPath: (path) => ipcRenderer.invoke('open-path', path),

    // Обновления
    checkForUpdates: () => ipcRenderer.invoke('updater:check'),
    quitAndInstall: () => ipcRenderer.invoke('updater:quit-and-install'),
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),

    on: (channel, callback) => {
        const handle = (event, ...args) => callback(...args);
        ipcRenderer.on(channel, handle);
        return () => ipcRenderer.removeListener(channel, handle);
    }
});

