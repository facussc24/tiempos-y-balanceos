// Mock browser environment for Node.js execution
if (typeof window === 'undefined') {
    (global as any).window = {};
}
if (typeof localStorage === 'undefined') {
    (global as any).localStorage = {
        getItem: () => null,
        setItem: () => { },
        removeItem: () => { }
    };
}

import { sanitizeName } from '../utils/pathManager';

console.log("--- TEST REPRODUCTION: sanitizeName Traversal Vulnerability ---");

const dangerousInputs = [
    "..",
    "../",
    "../../Windows",
    ".",
    "CON"
];

let failed = false;

dangerousInputs.forEach(input => {
    const sanitized = sanitizeName(input);
    console.log(`Input: "${input}" -> Sanitized: "${sanitized}"`);

    if (sanitized === ".." || sanitized === ".") {
        console.error("  [FAIL] Security Bypass: Sanitizer allowed traversal characters!");
        failed = true;
    } else if (sanitized.includes("..")) {
        console.error("  [FAIL] Security Bypass: Sanitizer preserved '..' sequence!");
        failed = true;
    }
});

const benign = "Valid Name";
const sBenign = sanitizeName(benign);
console.log(`Input: "${benign}" -> Sanitized: "${sBenign}"`);

if (failed) {
    console.log("\nVERDICT: VULNERABLE. The sanitizeName function allows directory traversal.");
    process.exit(1);
} else {
    console.log("\nVERDICT: SAFE.");
    process.exit(0);
}
