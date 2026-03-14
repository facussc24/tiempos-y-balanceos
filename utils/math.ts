export const calculateStandardDeviation = (values: (number | null)[]): number => {
    const validValues = values.filter(v => v !== null && v > 0) as number[];
    if (validValues.length < 2) return 0;

    const mean = validValues.reduce((a, b) => a + b, 0) / validValues.length;
    const variance = validValues.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / (validValues.length - 1); // Sample variance
    return Math.sqrt(variance);
};

// Calculates N (Sample Size) for 95.45% Confidence (k=2 -> ~40 factor) and 5% Error
export const calculateRequiredSampleSize = (mean: number, stdDev: number, count: number): number => {
    if (count < 3 || mean === 0) return 0;

    // General Electric Formula / Statistical Standard: N = (40 * s / x_bar)^2
    // Where 40 represents 2 * 20 (k=2 for 95.45%, e=5% -> 1/0.05=20)

    const term = (40 * stdDev) / mean;
    const n = Math.pow(term, 2);

    // FIX: Guard against NaN/Infinity propagation from corrupted input
    return Number.isFinite(n) ? Math.ceil(n) : 0;
};

// Outlier Detection (Values outside Mean +/- 2 * StdDev)
export const isOutlier = (value: number, mean: number, stdDev: number): boolean => {
    if (value <= 0) return false;
    const lower = mean - (2 * stdDev);
    const upper = mean + (2 * stdDev);
    return value < lower || value > upper;
};

