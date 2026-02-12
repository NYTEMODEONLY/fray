import { useMemo, useRef, useState } from "react";

type UserSettingsTab =
  | "profiles"
  | "appearance"
  | "notifications"
  | "keybinds"
  | "input"
  | "accessibility";

interface UserSettingsModalProps {
  onClose: () => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  messageDensity: "cozy" | "compact";
  onToggleMessageDensity: () => void;
  notificationsEnabled: boolean;
  mentionsOnlyNotifications: boolean;
  onSetNotificationsEnabled: (value: boolean) => void;
  onSetMentionsOnlyNotifications: (value: boolean) => void;
  keybindsEnabled: boolean;
  onSetKeybindsEnabled: (value: boolean) => void;
  composerEnterToSend: boolean;
  composerSpellcheck: boolean;
  onSetComposerEnterToSend: (value: boolean) => void;
  onSetComposerSpellcheck: (value: boolean) => void;
  reducedMotion: boolean;
  highContrast: boolean;
  fontScale: 1 | 1.1 | 1.2;
  onSetReducedMotion: (value: boolean) => void;
  onSetHighContrast: (value: boolean) => void;
  onSetFontScale: (value: 1 | 1.1 | 1.2) => void;
  profileDisplayName: string;
  profileAbout: string;
  profileAvatarDataUrl: string | null;
  onSetProfileDisplayName: (value: string) => void;
  onSetProfileAbout: (value: string) => void;
  onSetProfileAvatarDataUrl: (value: string | null) => void;
}

const tabs: Array<{ id: UserSettingsTab; label: string }> = [
  { id: "profiles", label: "Profiles" },
  { id: "appearance", label: "Appearance" },
  { id: "notifications", label: "Notifications" },
  { id: "keybinds", label: "Keybinds" },
  { id: "input", label: "Text/Input" },
  { id: "accessibility", label: "Accessibility" }
];

const keybindRows = [
  { combo: "Cmd/Ctrl + K", action: "Open command palette" },
  { combo: "Cmd/Ctrl + ,", action: "Open user settings" },
  { combo: "Cmd/Ctrl + R", action: "Refresh app and install updates" },
  { combo: "Cmd/Ctrl + Shift + M", action: "Toggle member panel" },
  { combo: "Cmd/Ctrl + Shift + P", action: "Toggle pinned panel" }
];

const MAX_ABOUT_LENGTH = 190;
const MAX_AVATAR_SIZE_BYTES = 4 * 1024 * 1024;

export const UserSettingsModal = ({
  onClose,
  theme,
  onToggleTheme,
  messageDensity,
  onToggleMessageDensity,
  notificationsEnabled,
  mentionsOnlyNotifications,
  onSetNotificationsEnabled,
  onSetMentionsOnlyNotifications,
  keybindsEnabled,
  onSetKeybindsEnabled,
  composerEnterToSend,
  composerSpellcheck,
  onSetComposerEnterToSend,
  onSetComposerSpellcheck,
  reducedMotion,
  highContrast,
  fontScale,
  onSetReducedMotion,
  onSetHighContrast,
  onSetFontScale,
  profileDisplayName,
  profileAbout,
  profileAvatarDataUrl,
  onSetProfileDisplayName,
  onSetProfileAbout,
  onSetProfileAvatarDataUrl
}: UserSettingsModalProps) => {
  const [activeTab, setActiveTab] = useState<UserSettingsTab>("profiles");
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fontScalePercent = useMemo(() => `${Math.round(fontScale * 100)}%`, [fontScale]);
  const aboutCount = useMemo(() => profileAbout.length, [profileAbout]);
  const profileInitial = useMemo(
    () => (profileDisplayName.trim().slice(0, 1) || "?").toUpperCase(),
    [profileDisplayName]
  );

  const handleAvatarUpload = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setAvatarError("Select an image file.");
      return;
    }
    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      setAvatarError("Avatar must be 4MB or smaller.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const nextValue = typeof reader.result === "string" ? reader.result : null;
      if (!nextValue) {
        setAvatarError("Unable to read avatar file.");
        return;
      }
      setAvatarError(null);
      onSetProfileAvatarDataUrl(nextValue);
    };
    reader.onerror = () => {
      setAvatarError("Unable to read avatar file.");
    };
    reader.readAsDataURL(file);
  };

  return (
    <div
      className="settings-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="User settings"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <section className="settings-modal user-settings-modal">
        <aside className="settings-nav">
          <div className="settings-space-meta">
            <p className="eyebrow">Fray Profile</p>
            <h2>User Settings</h2>
          </div>
          <div className="settings-tab-list">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={activeTab === tab.id ? "settings-tab active" : "settings-tab"}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button className="ghost" onClick={onClose}>
            Close
          </button>
        </aside>

        <div className="settings-content">
          {activeTab === "profiles" && (
            <section className="settings-panel">
              <h3>Profiles</h3>
              <p>Customize your account card in Fray with an avatar, display name, and About Me.</p>
              <div className="settings-profile-card">
                <div className="settings-profile-avatar">
                  {profileAvatarDataUrl ? (
                    <img src={profileAvatarDataUrl} alt="Profile avatar preview" />
                  ) : (
                    <span>{profileInitial}</span>
                  )}
                </div>
                <div className="settings-profile-meta">
                  <p className="settings-profile-name">{profileDisplayName || "Set display name"}</p>
                  <small>PNG, JPG, WEBP, GIF up to 4MB</small>
                </div>
                <div className="settings-row">
                  <button
                    className="pill"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {profileAvatarDataUrl ? "Change Avatar" : "Upload Avatar"}
                  </button>
                  <button
                    className="ghost"
                    onClick={() => {
                      onSetProfileAvatarDataUrl(null);
                      setAvatarError(null);
                    }}
                    disabled={!profileAvatarDataUrl}
                  >
                    Remove Avatar
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  hidden
                  accept="image/*"
                  onChange={(event) => handleAvatarUpload(event.target.files?.[0] ?? null)}
                />
                {avatarError && <p className="settings-error">{avatarError}</p>}
              </div>

              <label className="settings-field">
                Display name
                <input
                  value={profileDisplayName}
                  placeholder="Your display name"
                  maxLength={32}
                  onChange={(event) => onSetProfileDisplayName(event.target.value)}
                />
              </label>
              <label className="settings-field">
                About Me
                <textarea
                  value={profileAbout}
                  placeholder="Tell your server what you are building"
                  maxLength={MAX_ABOUT_LENGTH}
                  rows={4}
                  onChange={(event) => onSetProfileAbout(event.target.value)}
                />
                <small className="settings-helper">{aboutCount}/{MAX_ABOUT_LENGTH}</small>
              </label>
            </section>
          )}

          {activeTab === "appearance" && (
            <section className="settings-panel">
              <h3>Appearance</h3>
              <p>Control how Fray looks and how dense conversation feels.</p>
              <div className="settings-row">
                <button className="pill" onClick={onToggleTheme}>
                  Theme: {theme === "dark" ? "Dark" : "Light"}
                </button>
                <button className="pill" onClick={onToggleMessageDensity}>
                  Density: {messageDensity === "compact" ? "Compact" : "Cozy"}
                </button>
              </div>
            </section>
          )}

          {activeTab === "notifications" && (
            <section className="settings-panel">
              <h3>Notifications</h3>
              <p>Choose how often Fray should alert you while you work.</p>
              <label className="settings-checkbox-row">
                <input
                  type="checkbox"
                  checked={notificationsEnabled}
                  onChange={(event) => onSetNotificationsEnabled(event.target.checked)}
                />
                Enable desktop notifications
              </label>
              <label className="settings-checkbox-row">
                <input
                  type="checkbox"
                  checked={mentionsOnlyNotifications}
                  onChange={(event) => onSetMentionsOnlyNotifications(event.target.checked)}
                  disabled={!notificationsEnabled}
                />
                Notify only when mentioned
              </label>
            </section>
          )}

          {activeTab === "keybinds" && (
            <section className="settings-panel">
              <h3>Keybinds</h3>
              <p>Keep keyboard shortcuts enabled for fast switching and control.</p>
              <label className="settings-checkbox-row">
                <input
                  type="checkbox"
                  checked={keybindsEnabled}
                  onChange={(event) => onSetKeybindsEnabled(event.target.checked)}
                />
                Enable keyboard shortcuts
              </label>
              <div className="settings-shortcut-list">
                {keybindRows.map((row) => (
                  <div key={row.combo} className="settings-shortcut-row">
                    <kbd>{row.combo}</kbd>
                    <span>{row.action}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {activeTab === "input" && (
            <section className="settings-panel">
              <h3>Text/Input</h3>
              <p>Tune message composer behavior to match your typing style.</p>
              <label className="settings-checkbox-row">
                <input
                  type="checkbox"
                  checked={composerEnterToSend}
                  onChange={(event) => onSetComposerEnterToSend(event.target.checked)}
                />
                Enter sends message (Shift+Enter for newline)
              </label>
              <label className="settings-checkbox-row">
                <input
                  type="checkbox"
                  checked={composerSpellcheck}
                  onChange={(event) => onSetComposerSpellcheck(event.target.checked)}
                />
                Enable spellcheck in composer
              </label>
            </section>
          )}

          {activeTab === "accessibility" && (
            <section className="settings-panel">
              <h3>Accessibility</h3>
              <p>Adjust motion, contrast, and type size for comfortable reading.</p>
              <label className="settings-checkbox-row">
                <input
                  type="checkbox"
                  checked={reducedMotion}
                  onChange={(event) => onSetReducedMotion(event.target.checked)}
                />
                Reduce motion
              </label>
              <label className="settings-checkbox-row">
                <input
                  type="checkbox"
                  checked={highContrast}
                  onChange={(event) => onSetHighContrast(event.target.checked)}
                />
                High contrast mode
              </label>
              <label className="settings-field">
                Font scale
                <select
                  value={fontScale}
                  onChange={(event) => onSetFontScale(Number(event.target.value) as 1 | 1.1 | 1.2)}
                >
                  <option value={1}>100%</option>
                  <option value={1.1}>110%</option>
                  <option value={1.2}>120%</option>
                </select>
              </label>
              <p>Current font scale: {fontScalePercent}</p>
            </section>
          )}
        </div>
      </section>
    </div>
  );
};
