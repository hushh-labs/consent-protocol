import { dirname } from "path";
import { fileURLToPath } from "url";
import nextConfig from "eslint-config-next/core-web-vitals";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default [
  {
    ignores: [
      ".next/**",
      ".next/**/*",
      "out/**",
      "node_modules/**",
      "dist/**",
      "build/**",
      "android/**",
      "ios/**",
      "*.config.js",
      "*.config.mjs",
      "**/*.config.js",
      "**/*.config.mjs",
      "scripts/**/*.cjs",
      "**/*.cjs",
    ],
  },
  ...nextConfig,
  {
    rules: {
      "react/no-unescaped-entities": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/incompatible-library": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/triple-slash-reference": "off", // Next.js uses triple-slash references
      // Custom BYOK/Tri-Flow rules preserved from .eslintrc.json
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.name='fetch']",
          message:
            "Direct fetch() is banned in components. Use ApiService or VaultService instead. Native platforms (iOS/Android) have no Next.js server.",
        },
        {
          selector:
            "CallExpression[callee.object.name='localStorage'][callee.property.name='getItem'][arguments.0.value='vault_key']",
          message:
            "BYOK VIOLATION: Reading vault_key from localStorage is insecure. Use useVault().getVaultKey() instead.",
        },
        {
          selector:
            "CallExpression[callee.object.name='sessionStorage'][callee.property.name='getItem'][arguments.0.value='vault_key']",
          message:
            "BYOK VIOLATION: Reading vault_key from sessionStorage is insecure. Use useVault().getVaultKey() instead.",
        },
        {
          selector:
            "CallExpression[callee.object.name='localStorage'][callee.property.name='setItem'][arguments.0.value='vault_key']",
          message:
            "BYOK VIOLATION: Storing vault_key in localStorage is insecure. Use VaultContext.unlockVault() instead.",
        },
        {
          selector:
            "CallExpression[callee.object.name='sessionStorage'][callee.property.name='setItem'][arguments.0.value='vault_key']",
          message:
            "BYOK VIOLATION: Storing vault_key in sessionStorage is insecure. Use VaultContext.unlockVault() instead.",
        },
      ],
    },
  },
  // Override for config files
  {
    files: ["*.config.ts", "*.config.js", "*.config.mjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off", // Config files use require()
    },
  },
  // Override for API routes, services, and plugins (fetch allowed)
  {
    files: [
      "app/api/**/*.ts",
      "**/*.test.ts",
      "**/*.spec.ts",
      "lib/capacitor/plugins/**/*",
      "lib/services/**/*",
      "lib/api/**/*",
      "lib/auth/**/*",
    ],
    rules: {
      "no-restricted-syntax": "off",
      "@typescript-eslint/no-unsafe-function-type": "off", // Test files use Function for mocks
    },
  },
  // Special override for auth and vault contexts (limited fetch ban)
  {
    files: [
      "lib/firebase/auth-context.tsx",
      "lib/vault/vault-context.tsx",
      "app/logout/**/*",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.name='fetch']",
          message:
            "Direct fetch() is banned in components. Use ApiService or VaultService instead.",
        },
      ],
    },
  },
];
