// ============================================================
// 1. Constants: static values used across the app, e.g. for dropdown options, fixed settings, etc.
// ============================================================

export const SECURITY_QUESTIONS = [
    "What's my mother's first name?",
    "Where is my favourite spot in campus?",
    "What is the name of my first pet?",
];

export const ALLOWED_DOMAINS = ['@auckland.ac.nz', '@aucklanduni.ac.nz'];

export function isValidUniEmail(email) {
    return ALLOWED_DOMAINS.some((d) => email.toLowerCase().endsWith(d));
}

export function isValidPassword(password) {
    return (
        password.length >= 8 &&
        /[A-Z]/.test(password) &&
        /[a-z]/.test(password) &&
        /[0-9]/.test(password)
    );
}

export function isValidDob(dob) {
    // MM-DD-YYYY
    const re = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])-\d{4}$/;
    if (!re.test(dob)) return false;
    const [month, day, year] = dob.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}
