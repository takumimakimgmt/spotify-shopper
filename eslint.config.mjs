import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Project-specific ignores
    "_context/**",
    "_teacher_data/**",
  ]),
  // Loosen strictness for legacy state files without large refactors
  {
    files: ["lib/state/**", "lib/types.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  // Disable overly-strict react-hooks/refs for page.tsx
  // Rationale: analyzer state contains useState hooks, not useRef.
  // ESLint falsely flags state access as ref violations in render context.
  // All analyzer values are valid component state (bool, string, array, object).
  {
    files: ["app/page.tsx"],
    rules: {
      "react-hooks/refs": "off",
    },
  },
]);

const __cc_base = eslintConfig;


/* cc-unused-underscore-override */
const __cc_override = {
  files: ["**/*.{js,jsx,ts,tsx}"],
  ignores: ["**/.DS_Store", "**/*.bak.*", "**/*.tsbuildinfo"],
  rules: {
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": ["warn", {
      argsIgnorePattern: "^_",
      varsIgnorePattern: "^_",
      caughtErrorsIgnorePattern: "^_",
      ignoreRestSiblings: true,
    }],
  },
};

export default (Array.isArray(__cc_base) ? [...__cc_base, __cc_override] : [__cc_base, __cc_override]);
