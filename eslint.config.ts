import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";

export default [
  // Base JS rules
  js.configs.recommended,

  // TypeScript rules
  ...tseslint.configs.recommended,

  // React rules (flat config)
  react.configs.flat.recommended,

  // Project-specific settings
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser
      }
    },
    rules: {
      "react/react-in-jsx-scope": "off" // React 17+
    },
    settings: {
      react: {
        version: "detect"
      }
    }
  }
];
