// reconciliationUtils.js

/**
 * "Умная" нормализация:
 * 1. Сохраняет пробелы и символ № (приводит N и # к №).
 * 2. Делает транслитерацию похожих букв.
 * 3. Убирает лишние спецсимволы, заменяя их на пробелы.
 */
const normalize = (str) => {
    if (!str) return '';
    let s = str.toString().toLowerCase();

    // Транслитерация латиницы в кириллицу (похожие по начертанию)
    const translitMap = {
        a: 'а', b: 'в', c: 'с', e: 'е', h: 'н', k: 'к', m: 'м',
        o: 'о', p: 'р', r: 'р', s: 'с', t: 'т', x: 'х', y: 'у'
    };
    s = s.replace(/[a-z]/g, (char) => translitMap[char] || char);

    // Унификация символа номера
    s = s.replace(/[n#]/g, '№');

    // Оставляем только буквы, цифры, пробелы, точки (для дат) и №.
    // Всё остальное превращаем в пробел.
    s = s.replace(/[^a-zа-я0-9\s№.]/gi, ' ');

    // Схлопываем множественные пробелы
    s = s.replace(/\s+/g, ' ').trim();
    return s;
};

const stripPrefix = (fileName) => {
    // Регулярное выражение для префикса "000 - " в начале строки
    const renameRegex = /^(\d{3} - )/;
    return fileName.replace(renameRegex, '');
};

// Функция для определения статуса строки
const getReconciliationStatus = (matchedFiles, rowNumber) => {
    const filesCount = matchedFiles.length;
    if (filesCount === 0) {
        return 'empty';
    }
    if (filesCount === 1) {
        const fileName = matchedFiles[0];
        const match = fileName.match(/^(\d{3})\b/);

        // Проверяем наличие номера и его соответствие номеру строки
        const isRenamedAndMatchesRow = match && parseInt(match[1], 10) === parseInt(rowNumber, 10);

        return isRenamedAndMatchesRow ? 'renamed' : 'ready';
    }
    return 'check';
};

const reconcileData = (excelRows, pdfFiles) => {
    // Теперь excelRows — это массив объектов, уже очищенный в main.js
    if (!excelRows || excelRows.length === 0) return { reconciledData: [], unmatchedFiles: pdfFiles, copies: [] };

    const reconciliationResults = [];
    const unmatchedFiles = new Set(pdfFiles);
    const copies = [];

    // Предварительный поиск копий (О/К)
    const originalsSet = new Set();
    pdfFiles.forEach(file => {
        if (file.endsWith(' - О.pdf')) {
            let baseName = file.replace(' - О.pdf', '');
            baseName = stripPrefix(baseName);
            originalsSet.add(baseName);
        }
    });

    pdfFiles.forEach(file => {
        if (file.endsWith(' - К.pdf')) {
            let baseName = file.replace(' - К.pdf', '');
            baseName = stripPrefix(baseName);
            if (originalsSet.has(baseName)) {
                copies.push(file);
                unmatchedFiles.delete(file);
            }
        }
    });

    // Основной цикл сверки
    excelRows.forEach((row, index) => {
        const { number, date, docNumber, counterparty, amount, original } = row;
        const parts = [date, '№' + docNumber, counterparty].filter(part => part);
        const newFileName = parts.join(' ');

        let candidates = Array.from(unmatchedFiles);

        const normCounterparty = normalize(counterparty);
        const normDate = normalize(date);
        const normDocNumber = normalize(docNumber);

        // Фильтрация
        if (normCounterparty) {
        candidates = candidates.filter(fileName => normalize(fileName).includes(normCounterparty));
        }
        if (normDate) {
        candidates = candidates.filter(fileName => normalize(fileName).includes(normDate));
        }
        if (normDocNumber) {
        candidates = candidates.filter(fileName => normalize(fileName).includes(normDocNumber));
        }
        candidates.forEach(file => unmatchedFiles.delete(file));

        reconciliationResults.push({
            number,
            newFileName,
            amount,
            original,
            status: getReconciliationStatus(candidates, number),
            matchedFiles: candidates
        });
    });

    return {
        reconciledData: reconciliationResults,
        unmatchedFiles: Array.from(unmatchedFiles),
        copies
    };
};

export { normalize, reconcileData, getReconciliationStatus };