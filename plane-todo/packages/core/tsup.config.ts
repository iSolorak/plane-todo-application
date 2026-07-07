import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  target: "node18",
  platform: "neutral",
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: false,
});
