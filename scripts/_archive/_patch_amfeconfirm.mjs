import { readFileSync, writeFileSync } from 'fs';

const filePath = 'modules/amfe/useAmfeConfirm.ts';
let content = readFileSync(filePath, 'utf-8');

// 1. Add requireTextConfirm to interface
content = content.replace(
    "    confirmText: string;\n}",
    "    confirmText: string;\n    /** If set, user must type this exact text to enable the confirm button */\n    requireTextConfirm?: string;\n}"
);

// 2. Add to INITIAL_STATE
content = content.replace(
    "    confirmText: 'Confirmar',\n};",
    "    confirmText: 'Confirmar',\n    requireTextConfirm: undefined,\n};"
);

// 3. Add requireTextConfirm to requestConfirm options
content = content.replace(
    "        confirmText?: string;\n    }): Promise<boolean> => {",
    "        confirmText?: string;\n        requireTextConfirm?: string;\n    }): Promise<boolean> => {"
);

// 4. Pass requireTextConfirm to state
content = content.replace(
    "                confirmText: options.confirmText || 'Confirmar',\n            });",
    "                confirmText: options.confirmText || 'Confirmar',\n                requireTextConfirm: options.requireTextConfirm,\n            });"
);

writeFileSync(filePath, content, 'utf-8');
console.log('useAmfeConfirm patched with requireTextConfirm support');
