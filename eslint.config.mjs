import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
  {
    // Strict React Compiler rules from eslint-plugin-react-hooks 7: they flag the
    // read-localStorage/session-in-effect pattern the app relies on. Working code,
    // so these stay off rather than rewriting auth/UI state handling for a linter.
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/immutability": "off",
    },
  },
  {
    // Local dev script, not shipped code.
    files: ["scripts/**"],
    rules: { "@typescript-eslint/no-explicit-any": "off", "@typescript-eslint/no-unused-vars": "off" },
  },
]);

export default eslintConfig;
