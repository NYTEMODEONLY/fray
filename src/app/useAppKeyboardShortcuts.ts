import { useEffect } from "react";
import { isRefreshShortcut } from "../services/appUpdateService";

interface AppKeyboardShortcutsOptions {
  keybindsEnabled: boolean;
  onRefresh: () => void;
  onOpenCommandPalette: () => void;
  onOpenUserSettings: () => void;
  onToggleMembers: () => void;
  onTogglePins: () => void;
}

export const useAppKeyboardShortcuts = ({
  keybindsEnabled,
  onRefresh,
  onOpenCommandPalette,
  onOpenUserSettings,
  onToggleMembers,
  onTogglePins
}: AppKeyboardShortcutsOptions) => {
  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (!keybindsEnabled) return;
      const isCmd = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (isRefreshShortcut(event)) {
        event.preventDefault();
        onRefresh();
        return;
      }

      if (isCmd && key === "k") {
        event.preventDefault();
        onOpenCommandPalette();
        return;
      }

      if (isCmd && event.key === ",") {
        event.preventDefault();
        onOpenUserSettings();
        return;
      }

      if (isCmd && event.shiftKey && key === "m") {
        event.preventDefault();
        onToggleMembers();
        return;
      }

      if (isCmd && event.shiftKey && key === "p") {
        event.preventDefault();
        onTogglePins();
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [
    keybindsEnabled,
    onOpenCommandPalette,
    onOpenUserSettings,
    onRefresh,
    onToggleMembers,
    onTogglePins
  ]);
};
