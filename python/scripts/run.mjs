import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const python =
  process.platform === "win32"
    ? join(root, ".venv", "Scripts", "python.exe")
    : join(root, ".venv", "bin", "python");

if (!existsSync(python)) {
  console.error(
    "Python virtual environment not found at python/.venv\n" +
      "Run from backend: npm run py:install",
  );
  process.exit(1);
}

const result = spawnSync(python, ["-m", "app"], {
  cwd: root,
  env: process.env,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
