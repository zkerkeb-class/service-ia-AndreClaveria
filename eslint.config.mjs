import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jest
      },
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        project: "./tsconfig.json"
      }
    },
    rules: {
      // Style rules
      quotes: ["error", "double"],
      semi: ["error", "always"],
      indent: ["error", 2],
      "object-curly-spacing": ["error", "always"],
      "comma-dangle": ["error", "never"],
      "no-trailing-spaces": "error",
      "space-before-blocks": ["error", "always"],
      "keyword-spacing": ["error", { before: true, after: true }],
      "arrow-spacing": ["error", { before: true, after: true }],

      // Best practices
      eqeqeq: ["error", "always"],
      curly: ["error", "all"],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" }
      ],
      "prefer-const": "error",
      "no-var": "error",
      "no-console": "warn",

      // TypeScript specific
      "@typescript-eslint/explicit-function-return-type": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-non-null-assertion": "warn",

      // MongoDB related (optional)
      "no-undef": "error"
    },
    files: [
      "**/*.ts",
      "**/*.mts",
      "**/*.cts",
      "**/*.js",
      "**/*.mjs",
      "**/*.cjs"
    ],
    ignores: ["node_modules/**", "dist/**", "build/**", "coverage/**"]
  },
  // Overrides for test files
  {
    files: [
      "**/*.test.ts",
      "**/*.spec.ts",
      "**/*.test.js",
      "**/*.spec.js",
      "**/__tests__/**"
    ],
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/explicit-function-return-type": "off"
    }
  }
);
