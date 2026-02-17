// src/main/logger.js
import { app } from 'electron';
import path from 'path';
import fs from 'fs';

const LOG_FILE_NAME = 'app.log';
const OLD_LOG_FILE_NAME = 'app.old.log';
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5MB

class Logger {
    constructor() {
        this.logDir = path.join(app.getPath('userData'), 'logs');
        this.logPath = path.join(this.logDir, LOG_FILE_NAME);
        this.oldLogPath = path.join(this.logDir, OLD_LOG_FILE_NAME);
        this.ensureLogDir();
    }

    ensureLogDir() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    rotateLogs() {
        try {
            if (fs.existsSync(this.logPath)) {
                const stats = fs.statSync(this.logPath);
                if (stats.size > MAX_LOG_SIZE) {
                    if (fs.existsSync(this.oldLogPath)) {
                        fs.unlinkSync(this.oldLogPath);
                    }
                    fs.renameSync(this.logPath, this.oldLogPath);
                }
            }
        } catch (error) {
            console.error('Failed to rotate logs:', error);
        }
    }

    log(level, message, context = '') {
        this.rotateLogs();
        const timestamp = new Date().toISOString();
        const logEntry = JSON.stringify({
            timestamp,
            level,
            message,
            context
        }) + '\n';

        try {
            fs.appendFileSync(this.logPath, logEntry, 'utf8');
        } catch (error) {
            console.error('Failed to write to log file:', error);
        }
    }

    getLogs(limit = 100) {
        try {
            let logs = [];
            if (fs.existsSync(this.oldLogPath)) {
                const oldContent = fs.readFileSync(this.oldLogPath, 'utf8');
                logs = oldContent.trim().split('\n').map(line => {
                    try { return JSON.parse(line); } catch (e) { return null; }
                }).filter(Boolean);
            }

            if (fs.existsSync(this.logPath)) {
                const currentContent = fs.readFileSync(this.logPath, 'utf8');
                const currentLogs = currentContent.trim().split('\n').map(line => {
                    try { return JSON.parse(line); } catch (e) { return null; }
                }).filter(Boolean);
                logs = logs.concat(currentLogs);
            }

            return logs.slice(-limit);
        } catch (error) {
            console.error('Failed to read logs:', error);
            return [];
        }
    }
}

export default new Logger();
