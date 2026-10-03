import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
export default defineConfig([...nextVitals, ...nextTs, { rules: { "@typescript-eslint/no-explicit-any": "off", "react-hooks/set-state-in-effect": "off", "@next/next/no-img-element": "off", "@typescript-eslint/no-unused-expressions": "off" } }, globalIgnores([".next/**", "node_modules/**", "data/**", "coverage/**"])]);
