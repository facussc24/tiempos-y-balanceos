
import { describe, it, expect } from 'vitest';
import { parseDemand } from '../utils/validation';

describe('Daily Demand Input UX Logic', () => {
    // The user complains they "cannot change" the daily demand.
    // This usually happens when a controlled input forces a value (like 0) 
    // immediately upon clearing, preventing the user from typing a new number.

    it('force-validates empty string to 0, preventing empty input state', () => {
        const input = "";
        // User deletes content to type new number
        const result = parseDemand(input);

        // If this returns 0, the input value snaps back to "0" immediately.
        // The user then has to delete "0" again, which snaps back to "0", loop.
        expect(result).toBe(0);
    });

    it('parses valid integers correctly', () => {
        expect(parseDemand("200")).toBe(200);
    });
});
