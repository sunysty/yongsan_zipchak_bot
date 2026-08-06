import { readFile, writeFile } from "node:fs/promises";
import { CONFIG } from "./config.js";
import type { StateFile } from "./types.js";

export async function loadState(): Promise<StateFile> {
  try {
    const raw = await readFile(CONFIG.stateFilePath, "utf-8");
    return JSON.parse(raw) as StateFile;
  } catch {
    return {};
  }
}

export async function saveState(state: StateFile): Promise<void> {
  await writeFile(CONFIG.stateFilePath, JSON.stringify(state, null, 2) + "\n", "utf-8");
}
