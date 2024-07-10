import globals from "globals";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default [...compat.extends("airbnb-base"), {
    languageOptions: {
        globals: {
            ...globals.browser,
        },

        ecmaVersion: "latest",
        sourceType: "module",
    },

    rules: {
        "no-console": "off",
        camelcase: "off",
        "new-cap": "off",
        "no-await-in-loop": "off",
        "import/extensions": "off",
        "import/prefer-default-export": "off",
        "no-unused-vars": "off",
        "max-classes-per-file": "off",
        "no-restricted-syntax": "off",
        "no-case-declarations": "off",
        "no-useless-escape": "off",
        "no-eval": "off",
        "import/no-relative-packages": "off",
        "no-promise-executor-return": "off",
        "no-alert": "off",
        "no-tabs": 0,
        indent: ["error", 4],
        "no-restricted-globals": "off",
        "import/no-unresolved": "off",
        "no-underscore-dangle": "off",
	    "no-bitwise": "off"
    },
}];
