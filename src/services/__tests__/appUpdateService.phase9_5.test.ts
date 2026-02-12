import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: vi.fn()
}));

vi.mock("@tauri-apps/plugin-updater", () => ({
  check: vi.fn()
}));

vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch: vi.fn()
}));

import { isTauri } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";
import {
  checkForDesktopUpdateAvailability,
  isRefreshShortcut,
  refreshWithDesktopUpdate
} from "../appUpdateService";

const mockedIsTauri = vi.mocked(isTauri);
const mockedCheck = vi.mocked(check);
const mockedRelaunch = vi.mocked(relaunch);

describe("Phase 9.5 app update service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("detects Cmd/Ctrl+R refresh shortcuts", () => {
    expect(isRefreshShortcut({ metaKey: true, ctrlKey: false, shiftKey: false, altKey: false, key: "r" })).toBe(true);
    expect(isRefreshShortcut({ metaKey: false, ctrlKey: true, shiftKey: false, altKey: false, key: "R" })).toBe(true);
    expect(isRefreshShortcut({ metaKey: true, ctrlKey: false, shiftKey: true, altKey: false, key: "r" })).toBe(false);
    expect(isRefreshShortcut({ metaKey: true, ctrlKey: false, shiftKey: false, altKey: false, key: "k" })).toBe(false);
  });

  it("falls back to browser reload when not running in tauri", async () => {
    mockedIsTauri.mockReturnValue(false);
    const reload = vi.fn();

    const result = await refreshWithDesktopUpdate({ reload });

    expect(result).toBe("reloaded");
    expect(reload).toHaveBeenCalledTimes(1);
    expect(mockedCheck).not.toHaveBeenCalled();
  });

  it("reloads when tauri has no available update", async () => {
    mockedIsTauri.mockReturnValue(true);
    mockedCheck.mockResolvedValue(null);
    const reload = vi.fn();

    const result = await refreshWithDesktopUpdate({ reload });

    expect(result).toBe("reloaded");
    expect(mockedCheck).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(mockedRelaunch).not.toHaveBeenCalled();
  });

  it("downloads, installs, and relaunches when update is available", async () => {
    mockedIsTauri.mockReturnValue(true);
    const update = {
      version: "0.2.0",
      downloadAndInstall: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined)
    };
    mockedCheck.mockResolvedValue(update as never);
    const reload = vi.fn();
    const notify = vi.fn();

    const result = await refreshWithDesktopUpdate({ notify, reload });

    expect(result).toBe("updated");
    expect(update.downloadAndInstall).toHaveBeenCalledTimes(1);
    expect(update.close).toHaveBeenCalledTimes(1);
    expect(mockedRelaunch).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith("Installing update", "Downloading Fray 0.2.0...");
  });

  it("returns update availability metadata in desktop mode", async () => {
    mockedIsTauri.mockReturnValue(true);
    const update = {
      version: "0.3.0",
      date: "2026-02-11",
      body: "Release notes",
      close: vi.fn().mockResolvedValue(undefined)
    };
    mockedCheck.mockResolvedValue(update as never);

    const found = await checkForDesktopUpdateAvailability();

    expect(found).toEqual({
      version: "0.3.0",
      date: "2026-02-11",
      body: "Release notes"
    });
    expect(update.close).toHaveBeenCalledTimes(1);
  });
});
