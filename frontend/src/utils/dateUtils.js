/**
 * Formats a date string or Date object to DD/MM/YYYY.
 * @param {string|Date} dateValue - The date to format.
 * @returns {string} - The formatted date string (e.g., "25/12/2023"). Returns original value or empty string if invalid.
 */
export const formatDate = (dateValue) => {
    if (!dateValue) return '';
    try {
        const d = new Date(dateValue);
        if (isNaN(d.getTime())) return dateValue; // Return original if invalid date

        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();

        return `${day}/${month}/${year}`;
    } catch (err) {
        return dateValue;
    }
};

/**
 * Formats a date string or Date object to DD/MM/YYYY HH:MM.
 * @param {string|Date} dateValue 
 * @returns {string}
 */
export const formatDateTime = (dateValue) => {
    if (!dateValue) return '';
    try {
        const d = new Date(dateValue);
        if (isNaN(d.getTime())) return dateValue;

        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');

        return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch (err) {
        return dateValue;
    }
};
