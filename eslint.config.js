import js from "@eslint/js";
import ts from "typescript-eslint";

export default ts.config(js.configs.recommended, ...ts.configs.recommended, {
  ignores: ["**/dist/**", "**/node_modules/**", "**/*.js"],
  rules: {
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unused-vars": [
      "warn",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
  },
  languageOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
});
