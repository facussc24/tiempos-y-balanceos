/**
 * Seeded Pseudo-Random Number Generator
 * 
 * Uses Linear Congruential Generator (LCG) algorithm for reproducible
 * random sequences. Essential for experiment replication.
 * 
 * @module seededRandom
 */

export class SeededRandom {
    private seed: number;

    /**
     * Create a new seeded random generator.
     * @param seed - Initial seed value (default: current timestamp)
     */
    constructor(seed: number = Date.now()) {
        // Ensure seed is within valid range for LCG
        this.seed = seed % 2147483647;
        if (this.seed <= 0) this.seed += 2147483646;
    }

    /**
     * Get next random number in [0, 1) range.
     * Uses Park-Miller LCG algorithm.
     */
    next(): number {
        // LCG: seed = (seed * a) % m
        // Park-Miller constants: a = 16807, m = 2^31 - 1
        this.seed = (this.seed * 16807) % 2147483647;
        return (this.seed - 1) / 2147483646;
    }

    /**
     * Generate random number from normal distribution using Box-Muller transform.
     * @param mean - The mean of the distribution
     * @param stdDev - The standard deviation (must be > 0 for variability)
     * @returns A random value from N(mean, stdDev), clamped to minimum 0.1
     */
    nextGaussian(mean: number, stdDev: number): number {
        // Guard: If no valid variability, return deterministic mean
        if (!stdDev || stdDev <= 0 || Number.isNaN(stdDev)) {
            return mean;
        }

        // Box-Muller transform
        const u = Math.max(1e-10, 1 - this.next());
        const v = this.next();
        const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);

        // Prevent negative times, min 0.1
        return Math.max(0.1, z * stdDev + mean);
    }

    /**
     * Generate random number from exponential distribution.
     * Used for MTBF (Mean Time Between Failures) modeling.
     * 
     * @param mean - The mean value (expected time between events)
     * @returns A random value from Exponential(mean), always > 0
     */
    nextExponential(mean: number): number {
        if (mean <= 0 || !isFinite(mean)) return Infinity; // No failures
        const u = Math.max(1e-10, 1 - this.next());
        return -mean * Math.log(u);
    }

    /**
     * Get current seed (for debugging/reproducibility)
     */
    getSeed(): number {
        return this.seed;
    }

    /**
     * Reset to a new seed
     */
    setSeed(seed: number): void {
        this.seed = seed % 2147483647;
        if (this.seed <= 0) this.seed += 2147483646;
    }
}

/**
 * Create a new SeededRandom instance
 */
export function createSeededRandom(seed?: number): SeededRandom {
    return new SeededRandom(seed);
}
