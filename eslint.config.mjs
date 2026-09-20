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

  // shadcn primitives and its generated hook are vendored upstream source. We don't author
  // them, and `shadcn add` would overwrite an edit — so the exemption is scoped to these files
  // rather than the rule being weakened everywhere.
  {
    files: ["src/design-system/ui/**", "src/lib/hooks/use-mobile.ts"],
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
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
