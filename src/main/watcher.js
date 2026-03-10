import chokidar from 'chokidar';
import path from 'path';
import logger from './logger.js';

class FileWatcher {
    constructor() {
        this.watchers = new Map(); // path -> watcher instance
        this.mainWindow = null;
    }

    setMainWindow(window) {
        this.mainWindow = window;
    }

    /**
     * Подписывается на изменения в указанной директории.
     * @param {string} key - Уникальный ключ для идентификации области (например, 'temp' или 'archive')
     * @param {string} dirPath - Полный путь к директории
     * @param {Object} options - Опции chokidar
     */
    watch(key, dirPath, options = {}) {
        if (!dirPath) return;

        // Если уже есть вотчер с таким ключом, закрываем его
        this.unwatch(key);

        const defaultOptions = {
            ignored: /(^|[\/\\])\../, // игнорировать скрытые файлы
            persistent: true,
            depth: 1, // по умолчанию следим только за верхним уровнем (для Temp)
            ignoreInitial: true, // не слать события для существующих файлов при старте
            awaitWriteFinish: {
                stabilityThreshold: 1000,
                pollInterval: 100
            }
        };

        const watcher = chokidar.watch(dirPath, { ...defaultOptions, ...options });

        watcher
            .on('add', filePath => this.sendEvent('file-added', key, filePath))
            .on('change', filePath => this.sendEvent('file-changed', key, filePath))
            .on('unlink', filePath => this.sendEvent('file-deleted', key, filePath))
            .on('addDir', dirPath => this.sendEvent('dir-added', key, dirPath))
            .on('unlinkDir', dirPath => this.sendEvent('dir-deleted', key, dirPath))
            .on('error', error => logger.error(`Watcher error (${key}): ${error}`));

        this.watchers.set(key, watcher);
        //logger.log('info', `Started watching ${key}: ${dirPath}`);
    }

    unwatch(key) {
        if (this.watchers.has(key)) {
            this.watchers.get(key).close();
            this.watchers.delete(key);
            //logger.log('info', `Stopped watching ${key}`);
        }
    }

    unwatchAll() {
        for (const key of this.watchers.keys()) {
            this.unwatch(key);
        }
    }

    sendEvent(event, key, filePath) {
        if (this.mainWindow) {
            const fileName = path.basename(filePath);
            const relativePath = path.dirname(filePath); // или можно передать полный путь, renderer решит

            this.mainWindow.webContents.send('watcher:change', {
                event,     // 'file-added', 'file-deleted', etc.
                key,       // 'temp', 'archive', etc.
                filePath,  // полный путь
                fileName,
                timestamp: Date.now()
            });
        }
    }
}

export default new FileWatcher();
