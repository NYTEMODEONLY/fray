import { isTauri } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";

type ShortcutEvent = Pick<KeyboardEvent, "metaKey" | "ctrlKey" | "shiftKey" | "altKey" | "key">;

export interface RefreshAppOptions {
  notify?: (title: string, body: string) => void;
  reload?: () => void;
}

export interface AvailableDesktopUpdate {
  version: string;
  date?: string;
  body?: string;
}

const defaultReload = () => {
  if (typeof window !== "undefined") {
    window.location.reload();
  }
};

export const isRefreshShortcut = (event: ShortcutEvent) => {
  const isCommand = event.metaKey || event.ctrlKey;
  return isCommand && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "r";
};

export const checkForDesktopUpdateAvailability = async (): Promise<AvailableDesktopUpdate | null> => {
  if (!isTauri()) return null;
  try {
    const update = await check();
    if (!update) return null;
    const available = {
      version: update.version,
      date: update.date,
      body: update.body
    };
    await update.close().catch(() => undefined);
    return available;
  } catch {
    return null;
  }
};

export const refreshWithDesktopUpdate = async ({
  notify,
  reload = defaultReload
}: RefreshAppOptions = {}): Promise<"updated" | "reloaded"> => {
  if (!isTauri()) {
    reload();
    return "reloaded";
  }

  try {
    const update = await check();
    if (!update) {
      reload();
      return "reloaded";
    }

    notify?.("Installing update", `Downloading Fray ${update.version}...`);
    await update.downloadAndInstall();
    await update.close().catch(() => undefined);
    notify?.("Update installed", "Restarting Fray...");
    await relaunch();
    return "updated";
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown updater error";
    notify?.("Update check failed", `${message}. Refreshing app instead.`);
    reload();
    return "reloaded";
  }
};
