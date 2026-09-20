import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Layer fences (guideline §2). Dependencies point inward only; enforced from day one,
  // because a fence added later is a refactor rather than a rule.
  {
    files: ["src/features/**"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          group: ["@/features/*/**"],
          message: "A feature must not import another feature. Lift the shared piece into api/, server/ or lib/.",
        }],
      }],
    },
  },
  {
    files: ["src/design-system/**"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          group: ["@/features/**", "@/server/**", "@/api/**"],
          message: "design-system/ is a leaf: it renders props and imports nothing above it.",
        }],
      }],
    },
  },
  {
    files: ["src/**"],
    ignores: ["src/server/**"],
    rules: {
      "no-restricted-imports": ["error", {
        paths: [{
          name: "@prisma/client",
          message: "Import the shared client from '@/server/db' so there is one connection pool.",
        }],
      }],
    },
  },

  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/generated/**",
  ]),
]);

export default eslintConfig;
