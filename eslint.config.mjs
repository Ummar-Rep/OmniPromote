import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Images come from Supabase Storage and external URLs; plain <img> keeps setup simple.
      "@next/next/no-img-element": "off",
    },
  },
  { ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts"] },
];

export default eslintConfig;
