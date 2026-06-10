import { FlatCompat } from "@eslint/eslintrc";

// next lint 在 Next 16 移除,迁移到 ESLint CLI;
// eslint-config-next 仍是 legacy 格式,经 FlatCompat 桥接
const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const eslintConfig = [
  ...compat.extends("next/core-web-vitals"),
  {
    ignores: [".next/**", "node_modules/**", ".data/**"]
  }
];

export default eslintConfig;
