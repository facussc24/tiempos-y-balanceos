// STRICT ALPHABETIC VERSIONING (Rev A -> Rev B ... Rev Z -> Rev AA)
export const incrementVersion = (current: string): string => {
    // If it's empty, numeric, or doesn't contain "Rev", restart cycle at Rev A
    if (!current || !current.toLowerCase().includes("rev") || !isNaN(parseFloat(current))) {
        return "Rev A";
    }

    // Clean input ("Rev. A" -> "A")
    const clean = current.replace(/Rev\.?/i, "").trim().toUpperCase();

    // Helper to increment alpha string
    const nextAlpha = (str: string): string => {
        const chars = str.split('');
        let i = chars.length - 1;
        while (i >= 0) {
            if (chars[i] !== 'Z') {
                chars[i] = String.fromCharCode(chars[i].charCodeAt(0) + 1);
                return chars.join('');
            } else {
                chars[i] = 'A';
                i--;
            }
        }
        return 'A' + chars.join('');
    };

    // Check if it looks like a letter sequence (A, B, AA, AB...)
    if (/^[A-Z]+$/.test(clean)) {
        return `Rev ${nextAlpha(clean)}`;
    }

    // Fallback
    return "Rev A";
};
