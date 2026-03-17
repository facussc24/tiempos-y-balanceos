/**
 * Crypto Utilities
 * 
 * Shared cryptographic functions used across modules.
 * H-07 Fix: Centralized to avoid code duplication across modules
 * 
 * @module crypto
 */

/**
 * Generate SHA-256 checksum of content
 * @param content - String content to hash
 * @returns Hex string of SHA-256 hash
 */
export async function generateChecksum(content: string): Promise<string> {
    const msgBuffer = new TextEncoder().encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify checksum matches expected value
 * @param content - String content to verify
 * @param expected - Expected checksum hex string
 * @returns true if checksums match
 */
export async function verifyChecksum(content: string, expected: string): Promise<boolean> {
    const actual = await generateChecksum(content);
    return actual === expected;
}
