import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  // tsconfig.json의 "@/*" 경로 별칭을 그대로 인식하게 해준다.
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    include: ["src/**/*.spec.ts"],
  },
});
