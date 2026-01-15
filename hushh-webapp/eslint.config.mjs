import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "react/no-unescaped-entities": "off",
      // Ban direct fetch() in components - must use service layer for tri-flow architecture
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.name='fetch']",
          message:
            "Direct fetch() is banned in components. Use ApiService or VaultService instead. Native platforms (iOS/Android) have no Next.js server. See docs/PROJECT_CONTEXT_MAP.md for tri-flow architecture.",
        },
      ],
    },
  },
  {
    // Allow fetch() only in API routes and tests
    files: ["app/api/**/*.ts", "**/*.test.ts", "**/*.spec.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
];

export default eslintConfig;
