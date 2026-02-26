// main.js - Основной процесс Electron

import { app, BrowserWindow, ipcMain, dialog, protocol, net, globalShortcut, session, nativeTheme, screen, shell } from 'electron';

//import { autoUpdater } from "electron-updater";
import pkg from 'electron-updater';
const { autoUpdater } = pkg;

import path from 'path';
import fs from 'fs';
import xlsx from 'xlsx';
import logger from './src/main/logger.js';
import watcher from './src/main/watcher.js';

let mainWindow;

const isDev = process.env.NODE_ENV === 'development';

// Функция для проверки обновлений
function checkUpdates(manual = false) {
    if (isDev) {
        autoUpdater.forceDevUpdateConfig = true;
    }
    autoUpdater.logger = console;

    autoUpdater.removeAllListeners("update-available");
    autoUpdater.removeAllListeners("update-not-available");
    autoUpdater.removeAllListeners("update-downloaded");
    autoUpdater.removeAllListeners("error");

    autoUpdater.on("update-available", (info) => {
        if (mainWindow) mainWindow.webContents.send('updater:status', { status: 'available', info });
    });

    autoUpdater.on("update-not-available", () => {
        if (mainWindow) mainWindow.webContents.send('updater:status', { status: 'not-available' });
    });

    autoUpdater.on("update-downloaded", (info) => {
        if (mainWindow) mainWindow.webContents.send('updater:status', { status: 'downloaded', info });
    });

    autoUpdater.on("error", (err) => {
        if (mainWindow) mainWindow.webContents.send('updater:status', { status: 'error', message: err.message });
    });

    autoUpdater.checkForUpdatesAndNotify();
}

// IPC обработчики обновлений
ipcMain.handle('updater:check', () => {
    checkUpdates(true);
});

ipcMain.handle('updater:quit-and-install', () => {
    autoUpdater.quitAndInstall();
});

ipcMain.handle('get-app-version', () => {
    return app.getVersion();
});

// Настройки по умолчанию
const settingsPath = path.join(app.getPath('userData'), 'config.json');
const defaultSettings = {
    baseDrive: '',
    companies: [],
    docTypes: ["УПД", "Акт", "Договор", "Спецификация", "Счет-фактура", "ТН", "ТТН"],
    legalForms: ["ооо", "оао", "зао", "пао", "ао", "ип", "нко", "одо", "пк", "спк", "кфх", "гуп", "муп", "тсж", "снт", "оно", "фгуп", "чуп", "ан", "пт", "птк"]
};

const monthMap = {
    'январь': 1, 'февраль': 2, 'март': 3, 'апрель': 4, 'май': 5, 'июнь': 6,
    'июль': 7, 'август': 8, 'сентябрь': 9, 'октябрь': 10, 'ноябрь': 11, 'декабрь': 12
};

function getSortScore(relativePath) {
    const parts = relativePath.toLowerCase().split(/[\\/]/);
    let year = 0;
    let month = 0;
    for (const part of parts) {
        // Ищем 4 цифры года
        const yearMatch = part.match(/\b(20\d{2})\b/);
        if (yearMatch) year = parseInt(yearMatch[1]);

        // Ищем название месяца
        for (const [name, num] of Object.entries(monthMap)) {
            if (part.includes(name)) {
                month = num;
                break;
            }
        }

        // Если месяц не найден текстом, ищем числовой префикс (типа "01", "12")
        if (month === 0) {
            const monthNumMatch = part.match(/\b(0[1-9]|1[0-2])\b/);
            if (monthNumMatch) month = parseInt(monthNumMatch[1]);
        }
    }

    // Возвращаем число для сравнения: Год * 100 + Месяц (например, 202310 для октября 23-го)
    return year * 100 + month;
}

let currentSettings = (() => {
    try {
        if (fs.existsSync(settingsPath)) {
            // Merge loaded settings with defaults, allowing new default properties to be added
            return { ...defaultSettings, ...JSON.parse(fs.readFileSync(settingsPath, 'utf8')) };
        }
    } catch (e) {
        console.error('Failed to load settings:', e);
    }
    return defaultSettings;
})();

function createWindow() {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    mainWindow = new BrowserWindow({
        width,
        height,
        minWidth: 900,
        minHeight: 600,
        backgroundColor: '#121212',
        show: false,
        webPreferences: {
            preload: path.join(app.getAppPath(), 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: true
        }
    });

    mainWindow.setMenuBarVisibility(false);
    //mainWindow.maximize();

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        mainWindow.maximize();
        watcher.setMainWindow(mainWindow);
    });

    if (isDev) {
        mainWindow.loadURL('http://localhost:3000');
        //mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'));
    }

    // Отправка текущей темы при старте
    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.send('theme-changed', nativeTheme.shouldUseDarkColors);
    });

    // отправляем событие при изменении темы
    nativeTheme.on('updated', () => {
        if (mainWindow) {
            mainWindow.webContents.send('theme-changed', nativeTheme.shouldUseDarkColors);
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
        watcher.setMainWindow(null);
    });
}

app.whenReady().then(() => {
    protocol.handle('pdf-viewer', (request) => {
        const filePath = decodeURIComponent(request.url.slice('pdf-viewer://'.length));
        return net.fetch(path.normalize(filePath));
    });

    createWindow();

    // Регистрация открытия dev tools по клавише F10
    globalShortcut.register('F10', () => {
        if (mainWindow.webContents.isDevToolsOpened()) {
            mainWindow.webContents.closeDevTools();
        } else {
            mainWindow.webContents.openDevTools();
        }
    });


    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    watcher.unwatchAll();
});

// ответ на запрос "какая тема сейчас"
ipcMain.handle('get-dark-mode', () => nativeTheme.shouldUseDarkColors);

// --- Логирование ---
ipcMain.handle('api:log-message', (event, { level, message, context }) => {
    logger.log(level, message, context);
});

ipcMain.handle('api:get-initial-logs', (event, limit) => {
    return logger.getLogs(limit);
});

// --- Watcher ---
ipcMain.handle('watcher:watch', (event, { key, path, options }) => {
    watcher.watch(key, path, options);
});

ipcMain.handle('watcher:unwatch', (event, key) => {
    watcher.unwatch(key);
});

ipcMain.handle('open-path', async (event, path) => {
    if (path) {
        shell.openPath(path);
    }
});

// Обработчики настроек
ipcMain.handle('get-settings', () => currentSettings);
ipcMain.handle('save-settings', (event, newSettings) => {
    try {
        fs.writeFileSync(settingsPath, JSON.stringify(newSettings, null, 2));
        currentSettings = newSettings; // Update runtime settings
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('select-folder', async (event, startPath) => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        defaultPath: startPath || undefined
    });

    if (result.canceled) {
        return null;
    } else {
        return result.filePaths[0];
    }
});

ipcMain.handle('find-reconciliation-files', async (event, companyName) => {
    if (!companyName) return [];
    try {
        const company = currentSettings.companies.find(c => c.name === companyName);
        const folderName = company ? company.folder : companyName;
        const companyPath = path.join(currentSettings.baseDrive, folderName);

        if (!fs.existsSync(companyPath)) return [];

        // Получаем все папки в директории компании для поиска подходящих под шаблоны
        const topLevelEntries = await fs.promises.readdir(companyPath, { withFileTypes: true });
        const results = [];

        const scan = async (dir, baseDir, type) => {
            const entries = await fs.promises.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    await scan(fullPath, baseDir, type);
                } else if (entry.isFile()) {
                    const ext = path.extname(entry.name).toLowerCase();
                    // Игнорируем временные файлы Excel (начинающиеся на ~$)
                    if ((ext === '.xlsx' || ext === '.xls') && !entry.name.startsWith('~$')) {
                        const stats = await fs.promises.stat(fullPath);
                        const relativePath = path.relative(baseDir, fullPath);
                        // Убираем первую папку (Поступления/Реализации) и само имя файла
                        const pathParts = relativePath.split(path.sep);
                        let label = "";

                        if (pathParts.length > 2) {
                            // Если есть подпапки (напр. "ПОСТУПЛЕНИЯ/2023/Декабрь/файл.xlsx")
                            // Берем всё между первой папкой и файлом
                            label = pathParts.slice(1, -1).join(' ');
                        } else {
                            // Если файл лежит прямо в "ПОСТУПЛЕНИЯ/файл.xlsx"
                            label = "В корне";
                        }

                        results.push({
                            name: entry.name,
                            fullPath: fullPath,
                            relativePath: relativePath,
                            mtime: stats.mtimeMs,
                            type: type, // 'income' или 'outcome'
                            label: label
                        });
                    }
                }
            }
        };

        for (const entry of topLevelEntries) {
            if (!entry.isDirectory()) continue;

            const upperName = entry.name.toUpperCase();
            let type = null;

            if (upperName.includes('ПОСТУПЛЕНИЯ')) {
                type = 'income';
            } else if (upperName.includes('РЕАЛИЗАЦИИ')) {
                type = 'outcome';
            }

            if (type) {
                const folderPath = path.join(companyPath, entry.name);
                await scan(folderPath, companyPath, type);
            }
        }

        // Умная сортировка: сначала по дате из пути (Год/Месяц), затем по mtime
        return results.sort((a, b) => {
            const scoreA = getSortScore(a.relativePath);
            const scoreB = getSortScore(b.relativePath);

            if (scoreA !== scoreB) {
                return scoreB - scoreA; // Новые периоды выше
            }

            // Если периоды одинаковые (или не определены), сортируем по дате изменения файла
            return b.mtime - a.mtime;
        });
    } catch (error) {
        console.error("Error finding reconciliation files:", error);
        return [];
    }
});

ipcMain.handle('get-pdf-files', async (event, folderPath) => {
    if (!folderPath) {
        return [];
    }
    try {
        const files = await fs.promises.readdir(folderPath);
        const pdfFiles = files
            .filter(file => file.toLowerCase().endsWith('.pdf'))
            .map(file => ({ name: file, path: path.join(folderPath, file) }));
        return pdfFiles;
    } catch (error) {
        console.error("Не удалось прочитать директорию:", error);
        return [];
    }
});

ipcMain.handle('rename-file', async (event, oldPath, newName) => {
    try {
        const dir = path.dirname(oldPath);
        const newPath = path.join(dir, newName);

        if (fs.existsSync(newPath)) {
            return { success: false, message: 'Файл с таким именем уже существует в этой папке.' };
        }

        await fs.promises.rename(oldPath, newPath);
        return { success: true, newPath: newPath, message: `Файл успешно переименован в ${newName}` };
    } catch (error) {
        console.error("Не удалось переименовать файл:", error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('organize-files', async (event, filesToOrganize) => {
    const results = [];
    let overallSuccess = true;

    for (const file of filesToOrganize) {
        const { path: oldPath, suggestedPath: newDirPath } = file;
        const fileName = path.basename(oldPath);
        const newPath = path.join(newDirPath, fileName);

        try {
            await fs.promises.mkdir(newDirPath, { recursive: true });

            if (fs.existsSync(newPath)) {
                results.push({ oldPath, success: false, message: `Файл уже существует в целевой папке.` });
                overallSuccess = false;
                continue;
            }

            await fs.promises.rename(oldPath, newPath);
            results.push({ oldPath, success: true, message: `Файл успешно перемещен в ${newDirPath}` });
        } catch (error) {
            console.error("Не удалось упорядочить файл:", error);
            results.push({ oldPath, success: false, message: `Ошибка перемещения: ${error.message}` });
            overallSuccess = false;
        }
    }
    return { success: overallSuccess, results };
});

ipcMain.handle('get-counterparties', async () => {
    try {
        const filePath = path.join(app.getPath('userData'), 'counterparties.json');

        // Если файла нет в userData, создаем пустой список
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, JSON.stringify([], null, 2));
        }
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error("Failed to load counterparties:", error);
        return [];
    }
});

ipcMain.handle('save-counterparties', async (event, counterparties) => {
    try {
        const filePath = path.join(app.getPath('userData'), 'counterparties.json');
        fs.writeFileSync(filePath, JSON.stringify(counterparties, null, 2));
        return { success: true };
    } catch (error) {
        console.error("Failed to save counterparties:", error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('import-counterparties-from-file', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [{ name: 'Text Files', extensions: ['txt'] }]
    });

    if (result.canceled) return null;
    try {
        const content = fs.readFileSync(result.filePaths[0], 'utf8');
        const newCounterparties = content
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(line => line.length > 0);

        return newCounterparties;
    } catch (error) {
        console.error("Failed to import counterparties:", error);
        throw error;
    }
});

ipcMain.handle('parse-path', async (event, filePath) => {
    try {
        return path.parse(filePath);
    } catch (error) {
        console.error("Ошибка парсинга пути:", error);
        return null;
    }
});

ipcMain.handle('read-archive', async (event, options = { recursive: false, parentPath: '' }) => {
    try {
        if (!currentSettings.baseDrive) {
            return { error: 'Базовый путь не настроен. Перейдите в настройки.' };
        }
        // универсальная функция построения узла (файл или папка)
        const buildNode = async (entry, dir, parentPath) => {
            if (entry.name.startsWith('.')) return null; // исключаем скрытые

            const fullPath = path.join(dir, entry.name);
            const relativePath = path.join(parentPath, entry.name);

            if (entry.isDirectory()) {
                const children = options.recursive
                    ? await readDir(fullPath, relativePath)
                    : [];

                return {
                    id: relativePath,
                    name: entry.name,
                    type: 'folder',
                    hasChildren: true,
                    children,
                };
            }

            return {
                id: relativePath,
                name: entry.name,
                type: 'file',
            };
        };

        // чтение директории
        const readDir = async (dir, parentPath = '') => {
            const entries = await fs.promises.readdir(dir, { withFileTypes: true });
            const nodes = await Promise.all(entries.map((entry) => buildNode(entry, dir, parentPath)));

            return nodes
                .filter(Boolean)
                .sort((a, b) => {
                    if (a.type === b.type) {
                        return a.name.localeCompare(b.name, 'ru', { numeric: true, sensitivity: 'base' });
                    }
                    return a.type === 'folder' ? -1 : 1;
                });
        };

        const rootPath = options.parentPath && options.parentPath.trim()
            ? path.resolve(currentSettings.baseDrive, options.parentPath)
            : currentSettings.baseDrive;

        const rootRelativeId = options.parentPath && options.parentPath.trim()
            ? options.parentPath
            : '';

        return {
            id: rootRelativeId,
            name: rootPath === currentSettings.baseDrive ? 'Архив' : path.basename(rootPath),
            type: 'folder',
            children: await readDir(rootPath, rootRelativeId),
        };
    } catch (error) {
        console.log(error);
        return { error: error.message || 'Archive reading error' };
    }
});

ipcMain.handle('get-company-archive-path', async (event, companyName) => {
    if (!companyName || typeof companyName !== 'string') {
        return null;
    }

    // Находим папку компании по её имени в настройках
    const company = currentSettings.companies.find(c => c.name === companyName);
    const folderName = company ? company.folder : companyName; // Use configured folder or fallback to companyName

    const basePath = currentSettings.baseDrive;
    const companyPath = path.join(basePath, folderName);
    return companyPath;
});

ipcMain.handle("get-company-temp-path", (event, companyName) => {
    if (!currentSettings.baseDrive) return null;

    // Find the company's configured folder name, or fallback to "Temp" if no companyName
    const company = currentSettings.companies.find(c => c.name === companyName);
    const folderName = company ? company.folder : (companyName || "Temp");

    if (!companyName) {
        // If no company name is provided, return the general "Temp" path
        return path.join(currentSettings.baseDrive, "Temp");
    }
    // For specific companies, use the "Temp <CompanyFolder>" structure
    return path.join(currentSettings.baseDrive, '- Текущие документы -', `Temp ${folderName}`);
});

// Получение исходных данных: Excel + список PDF
ipcMain.handle('get-source-data-for-reconciliation', async (event, excelFilePath) => {
    try {
        const folderPath = path.dirname(excelFilePath);

        const workbook = xlsx.readFile(excelFilePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // 1. Читаем все данные с сохранением пустых ячеек
        const rawRows = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

        // 2. Ищем строку заголовка
        let headerIndex = -1;
        let colIndices = {
            number: -1,
            date: -1,
            docNumber: -1,
            amount: -1,
            counterparty: -1,
            original: -1
        };

        for (let i = 0; i < rawRows.length; i++) {
            const row = rawRows[i];
            if (!row || !Array.isArray(row)) continue;

            const idxNum = row.indexOf("№ п/п");
            const idxDate = row.indexOf("Дата");
            const idxAmount = row.indexOf("Сумма");
            const idxInfo = row.indexOf("Информация");
            const idxDoc = row.findIndex(h => h && h.toString().includes("Номер"));
            const idxOrig = row.indexOf("Оригинал");

            if (idxNum !== -1 && idxDate !== -1 && idxAmount !== -1 && idxInfo !== -1 && idxDoc !== -1) {
                headerIndex = i;
                colIndices = {
                    number: idxNum,
                    date: idxDate,
                    docNumber: idxDoc,
                    amount: idxAmount,
                    counterparty: idxInfo,
                    original: idxOrig
                };
                break;
            }
        }

        if (headerIndex === -1) {
            return { success: false, message: 'Не удалось найти строку заголовка с необходимыми колонками (№ п/п, Дата, Номер, Сумма, Информация).' };
        }

        // 3. Формируем чистый массив данных
        const dataRows = rawRows.slice(headerIndex + 1);
        const cleanedData = [];

        for (const row of dataRows) {
            // Проверяем на наличие "Итого" в любой ячейке
            const hasTotal = row.some(cell => cell && cell.toString().includes("Итого"));
            if (hasTotal) break;

            // Пропускаем совсем пустые строки (где нет ни номера, ни контрагента)
            if (!row[colIndices.number] && !row[colIndices.counterparty]) continue;

            cleanedData.push({
                number: row[colIndices.number] || '',
                date: row[colIndices.date] || '',
                docNumber: row[colIndices.docNumber] || '',
                amount: row[colIndices.amount] || '',
                counterparty: row[colIndices.counterparty] || '',
                original: colIndices.original !== -1 ? (row[colIndices.original] || '') : ''
            });
        }

        // 4. Получаем список PDF
        const files = await fs.promises.readdir(folderPath);
        const pdfFiles = files.filter(file => file.toLowerCase().endsWith('.pdf'));

        return { success: true, excelRows: cleanedData, pdfFiles };
    } catch (error) {
        console.error('Failed to get source data:', error);
        return { success: false, message: error.message };
    }
});


