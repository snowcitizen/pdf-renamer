// src/utils.js
// Вспомогательные функции

export const getMonthName = (monthNumber) => {
    const months = [
        "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
        "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
    ];
    return months[monthNumber - 1];
};
