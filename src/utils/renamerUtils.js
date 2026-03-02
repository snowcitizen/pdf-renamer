/**
 * src/utils/renamerUtils.js
 * Универсальные функции для парсинга и формирования имен файлов
 */

/**
 * Парсит имя файла и возвращает объект с полями документа
 */
export const parseFileName = (fileName, docTypes = [], legalForms = [], loadedCounterparties = []) => {
    if (!fileName) {
        return {
            docDate: '',
            docType: '',
            docNumber: '',
            counterparty: '',
            originalCopy: ''
        };
    }

    let raw = fileName.replace(/\.pdf$/i, "")
        .replace(/\u00A0/g, " ")
        .trim()
        .replace(/\s+/g, " ");

    let parsedDate = "";
    let parsedType = "";
    let parsedNumber = "";
    let parsedCounterparty = "";
    let parsedOriginalCopy = "";

    // 1) О/К надёжнее
    let m = raw.match(/\s*-\s*([ОК])\s*$/i);
    if (m) {
        parsedOriginalCopy = m[1].toUpperCase();
        raw = raw.slice(0, m.index).trim().replace(/\s+/g, " ");
    } else {
        m = raw.match(/\s([ОК])\s*$/i);
        if (m) {
            parsedOriginalCopy = m[1].toUpperCase();
            raw = raw.slice(0, m.index).trim().replace(/\s+/g, " ");
        }
    }

    // 2) Разбиваем
    let parts = raw.length ? raw.split(" ") : [];

    // 3) Поиск даты
    const months = {
        "января": "01", "январь": "01", "февраля": "02", "февраль": "02",
        "марта": "03", "март": "03", "апреля": "04", "апрель": "04",
        "мая": "05", "май": "05", "июня": "06", "июнь": "06",
        "июля": "07", "июль": "07", "августа": "08", "август": "08",
        "сентября": "09", "сентябрь": "09", "октября": "10", "октябрь": "10",
        "ноября": "11", "ноябрь": "11", "декабря": "12", "декабрь": "12"
    };
    const digitalRegex = /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})(г|г\.|года)?$/i;

    for (let i = 0; i < parts.length; i++) {
        const match = parts[i].match(digitalRegex);
        if (match) {
            const day = match[1].padStart(2, "0");
            const month = match[2].padStart(2, "0");
            let year = match[3];
            if (year.length === 2) year = "20" + year;
            parsedDate = `${year}-${month}-${day}`;
            parts.splice(i, 1);
            break;
        }
    }

    if (!parsedDate) {
        for (let i = 0; i < parts.length - 2; i++) {
            let day = parts[i].padStart(2, "0");
            let mon = parts[i + 1].toLowerCase();
            let month = months[mon];
            if (!month) continue;

            let yearRaw = parts[i + 2].toLowerCase();
            let yearMatch = yearRaw.match(/^(\d{2}|\d{4})(г|г\.|года)?$/);
            if (!yearMatch) continue;

            let year = yearMatch[1];
            if (year.length === 2) year = "20" + year;

            parsedDate = `${year}-${month}-${day}`;
            parts.splice(i, 3);
            break;
        }
    }

    // 4) Тип документа
    for (let i = 0; i < parts.length; i++) {
        const found = docTypes.find(dt => dt.toLowerCase() === parts[i].toLowerCase());
        if (found) {
            parsedType = found;
            parts.splice(i, 1);
            break;
        }
    }

    // 5) Номер
    let numberIndex = parts.findIndex(p => p === "№");
    if (numberIndex !== -1 && parts[numberIndex + 1]) {
        parsedNumber = parts[numberIndex + 1].replace(/[.,;:]$/, "");
        parts.splice(numberIndex, 2);
    } else {
        const compactIndex = parts.findIndex(p => /^№\S+/i.test(p));
        if (compactIndex !== -1) {
            parsedNumber = parts[compactIndex].slice(1).replace(/[.,;:]$/, "");
            parts.splice(compactIndex, 1);
        }
    }

    // 6) Контрагент
    let candidate = parts.join(" ").trim().replace(/\s+/g, " ");

    if (candidate && loadedCounterparties.length > 0) {
        const normCandidateWords = candidate
            .toLowerCase()
            .split(" ")
            .filter(w => w && !legalForms.includes(w));

        let bestMatch = "";
        let bestScorePercent = 0;

        for (let c of loadedCounterparties) {
            const normCWords = String(c)
                .toLowerCase()
                .split(" ")
                .filter(w => w && !legalForms.includes(w));

            const commonCount = normCandidateWords.filter(w => normCWords.includes(w)).length;
            const scorePercent = (commonCount / normCandidateWords.length) * 100;

            if (scorePercent > bestScorePercent) {
                bestScorePercent = scorePercent;
                bestMatch = c;
            }
        }
        if (bestScorePercent > 50) {
            parsedCounterparty = bestMatch;
        }
    }

    return {
        docDate: parsedDate,
        docType: parsedType,
        docNumber: parsedNumber,
        counterparty: parsedCounterparty,
        originalCopy: parsedOriginalCopy
    };
};

/**
 * Формирует новое имя файла на основе полей
 */
export const generateNewFileName = (fields) => {
    const { docDate, docType, docNumber, counterparty, originalCopy } = fields;
    
    let newNameParts = [];

    if (docDate) {
        const date = new Date(docDate);
        if (!isNaN(date)) {
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            newNameParts.push(`${day}.${month}.${year}`);
        }
    }

    if (docType) {
        newNameParts.push(docType);
    }
    
    if (docNumber && docNumber.trim()) {
        newNameParts.push(`№${docNumber.trim()}`);
    }
    
    if (counterparty && counterparty.trim()) {
        newNameParts.push(counterparty.trim());
    }
    
    if (originalCopy) {
        newNameParts.push(`- ${originalCopy}`);
    }

    let newName = newNameParts.join(' ');
    return newName ? (newName + '.pdf') : '';
};
