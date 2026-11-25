import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

export function isPlaceholderEnvValue(value: string | undefined): boolean {
  if (!value) return true;
  const trimmed = value.trim();
  return !trimmed || trimmed === "Xzx1@2@3xzX" || trimmed.startsWith("MY_");
}

export function hydrateEnvFromDotEnv(): void {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  try {
    const parsed = dotenv.parse(fs.readFileSync(envPath, "utf8"));
    for (const [key, val] of Object.entries(parsed)) {
      if (isPlaceholderEnvValue(process.env[key]) && !isPlaceholderEnvValue(val)) {
        process.env[key] = val;
      }
    }
  } catch {
    // Ignore malformed .env
  }
}

hydrateEnvFromDotEnv();
