import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { UserSettingsModal } from "../UserSettingsModal";

describe("Phase 5 user settings modal", () => {
  it("wires tab controls and preference callbacks", async () => {
    const user = userEvent.setup();
    const onToggleTheme = vi.fn();
    const onToggleMessageDensity = vi.fn();
    const onSetNotificationsEnabled = vi.fn();
    const onSetMentionsOnlyNotifications = vi.fn();
    const onSetKeybindsEnabled = vi.fn();
    const onSetComposerEnterToSend = vi.fn();
    const onSetComposerSpellcheck = vi.fn();
    const onSetReducedMotion = vi.fn();
    const onSetHighContrast = vi.fn();
    const onSetFontScale = vi.fn();
    const onSetProfileDisplayName = vi.fn();
    const onSetProfileAbout = vi.fn();
    const onSetProfileAvatarDataUrl = vi.fn();
    const onClose = vi.fn();

    render(
      <UserSettingsModal
        onClose={onClose}
        theme="dark"
        onToggleTheme={onToggleTheme}
        messageDensity="cozy"
        onToggleMessageDensity={onToggleMessageDensity}
        notificationsEnabled={true}
        mentionsOnlyNotifications={false}
        onSetNotificationsEnabled={onSetNotificationsEnabled}
        onSetMentionsOnlyNotifications={onSetMentionsOnlyNotifications}
        keybindsEnabled={true}
        onSetKeybindsEnabled={onSetKeybindsEnabled}
        composerEnterToSend={true}
        composerSpellcheck={true}
        onSetComposerEnterToSend={onSetComposerEnterToSend}
        onSetComposerSpellcheck={onSetComposerSpellcheck}
        reducedMotion={false}
        highContrast={false}
        fontScale={1}
        onSetReducedMotion={onSetReducedMotion}
        onSetHighContrast={onSetHighContrast}
        onSetFontScale={onSetFontScale}
        profileDisplayName="nyte"
        profileAbout="building Fray"
        profileAvatarDataUrl="data:image/png;base64,abc"
        onSetProfileDisplayName={onSetProfileDisplayName}
        onSetProfileAbout={onSetProfileAbout}
        onSetProfileAvatarDataUrl={onSetProfileAvatarDataUrl}
      />
    );

    await user.clear(screen.getByLabelText("Display name"));
    await user.type(screen.getByLabelText("Display name"), "nytemode");
    const aboutField = screen.getByPlaceholderText("Tell your server what you are building");
    await user.clear(aboutField);
    await user.type(aboutField, "discord-like shell");
    await user.click(screen.getByRole("button", { name: "Remove Avatar" }));
    expect(onSetProfileDisplayName).toHaveBeenCalled();
    expect(onSetProfileAbout).toHaveBeenCalled();
    expect(onSetProfileAvatarDataUrl).toHaveBeenCalledWith(null);

    await user.click(screen.getByRole("button", { name: "Appearance" }));
    await user.click(screen.getByRole("button", { name: "Theme: Dark" }));
    await user.click(screen.getByRole("button", { name: "Density: Cozy" }));
    expect(onToggleTheme).toHaveBeenCalledTimes(1);
    expect(onToggleMessageDensity).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Notifications" }));
    await user.click(screen.getByLabelText("Enable desktop notifications"));
    await user.click(screen.getByLabelText("Notify only when mentioned"));
    expect(onSetNotificationsEnabled).toHaveBeenCalledWith(false);
    expect(onSetMentionsOnlyNotifications).toHaveBeenCalledWith(true);

    await user.click(screen.getByRole("button", { name: "Keybinds" }));
    expect(screen.getByText("Cmd/Ctrl + R")).toBeInTheDocument();
    expect(screen.getByText("Refresh app and install updates")).toBeInTheDocument();
    await user.click(screen.getByLabelText("Enable keyboard shortcuts"));
    expect(onSetKeybindsEnabled).toHaveBeenCalledWith(false);

    await user.click(screen.getByRole("button", { name: "Text/Input" }));
    await user.click(screen.getByLabelText("Enter sends message (Shift+Enter for newline)"));
    await user.click(screen.getByLabelText("Enable spellcheck in composer"));
    expect(onSetComposerEnterToSend).toHaveBeenCalledWith(false);
    expect(onSetComposerSpellcheck).toHaveBeenCalledWith(false);

    await user.click(screen.getByRole("button", { name: "Accessibility" }));
    await user.click(screen.getByLabelText("Reduce motion"));
    await user.click(screen.getByLabelText("High contrast mode"));
    await user.selectOptions(screen.getByLabelText("Font scale"), "1.2");
    expect(onSetReducedMotion).toHaveBeenCalledWith(true);
    expect(onSetHighContrast).toHaveBeenCalledWith(true);
    expect(onSetFontScale).toHaveBeenCalledWith(1.2);

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("uploads avatar images and forwards data url callback", async () => {
    const user = userEvent.setup();
    const onSetProfileAvatarDataUrl = vi.fn();

    class MockFileReader {
      result: string | ArrayBuffer | null = "data:image/png;base64,test-avatar";
      onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;
      onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;
      readAsDataURL() {
        this.onload?.call(
          this as unknown as FileReader,
          new ProgressEvent("load") as unknown as ProgressEvent<FileReader>
        );
      }
    }

    vi.stubGlobal("FileReader", MockFileReader as unknown as typeof FileReader);

    const { container } = render(
      <UserSettingsModal
        onClose={vi.fn()}
        theme="dark"
        onToggleTheme={vi.fn()}
        messageDensity="cozy"
        onToggleMessageDensity={vi.fn()}
        notificationsEnabled={true}
        mentionsOnlyNotifications={false}
        onSetNotificationsEnabled={vi.fn()}
        onSetMentionsOnlyNotifications={vi.fn()}
        keybindsEnabled={true}
        onSetKeybindsEnabled={vi.fn()}
        composerEnterToSend={true}
        composerSpellcheck={true}
        onSetComposerEnterToSend={vi.fn()}
        onSetComposerSpellcheck={vi.fn()}
        reducedMotion={false}
        highContrast={false}
        fontScale={1}
        onSetReducedMotion={vi.fn()}
        onSetHighContrast={vi.fn()}
        onSetFontScale={vi.fn()}
        profileDisplayName="nyte"
        profileAbout=""
        profileAvatarDataUrl={null}
        onSetProfileDisplayName={vi.fn()}
        onSetProfileAbout={vi.fn()}
        onSetProfileAvatarDataUrl={onSetProfileAvatarDataUrl}
      />
    );

    const fileInput = container.querySelector("input[type='file']") as HTMLInputElement;
    const file = new File(["avatar"], "avatar.png", { type: "image/png" });
    await user.upload(fileInput, file);

    expect(onSetProfileAvatarDataUrl).toHaveBeenCalledWith("data:image/png;base64,test-avatar");
    vi.unstubAllGlobals();
  });
});
