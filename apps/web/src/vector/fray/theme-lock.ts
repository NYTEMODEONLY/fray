/*
Copyright 2026 Fray contributors

SPDX-License-Identifier: Apache-2.0
*/

import { logger } from "matrix-js-sdk/src/logger";

import SettingsStore from "../../settings/SettingsStore";
import ThemeWatcher from "../../settings/watchers/ThemeWatcher";

const FORCED_THEME = "dark";

type ThemeWatcherWithFrayPatch = ThemeWatcher & {
    __frayThemeLockInstalled__?: boolean;
};

export function installFrayThemeLock(): void {
    const prototype = ThemeWatcher.prototype as ThemeWatcherWithFrayPatch;
    if (prototype.__frayThemeLockInstalled__) {
        return;
    }

    prototype.getEffectiveTheme = function frayGetEffectiveTheme(): string {
        if (SettingsStore.getValue("theme") !== FORCED_THEME) {
            logger.log("Fray theme lock forcing dark theme");
        }
        return FORCED_THEME;
    };

    prototype.isSystemThemeSupported = function frayIsSystemThemeSupported(): boolean {
        return false;
    };

    prototype.__frayThemeLockInstalled__ = true;
}
