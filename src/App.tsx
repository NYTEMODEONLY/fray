import { useEffect, useMemo, useRef, useState } from "react";
import { EventType } from "matrix-js-sdk";
import { AuthScreen } from "./components/AuthScreen";
import { CallDock } from "./components/CallDock";
import { ChannelList } from "./components/ChannelList";
import { CommandPalette } from "./components/CommandPalette";
import { MemberList } from "./components/MemberList";
import { MessageComposer } from "./components/MessageComposer";
import { MessageList } from "./components/MessageList";
import { NotificationTray } from "./components/NotificationTray";
import { OnboardingOverlay } from "./components/OnboardingOverlay";
import { PinnedPanel } from "./components/PinnedPanel";
import { RoomHeader } from "./components/RoomHeader";
import { ServerSettingsModal } from "./components/ServerSettingsModal";
import { ServerRail } from "./components/ServerRail";
import { ThreadPanel } from "./components/ThreadPanel";
import { UnreadFeed } from "./components/UnreadFeed";
import { UserSettingsModal } from "./components/UserSettingsModal";
import {
  buildSearchResultIds,
  buildThreadSummaries,
  RoomSearchFilter
} from "./services/messagePresentationService";
import {
  checkForDesktopUpdateAvailability,
  isRefreshShortcut,
  refreshWithDesktopUpdate
} from "./services/appUpdateService";
import { trackLocalMetricEvent } from "./services/localMetricsService";
import {
  buildPermissionSnapshot,
  canDeleteChannelsAndCategories,
  canRedactMessage,
  parsePowerLevels
} from "./services/permissionService";
import { useAppStore } from "./store/appStore";
import { notify } from "./platform/notifications";
import type { NotificationActionId } from "./types";

const defaultRoleSettings = {
  adminLevel: 100,
  moderatorLevel: 50,
  defaultLevel: 0
};
const LOCAL_MODE_KEY = "fray.local.mode";

const toMembership = (value: string | undefined) => {
  if (value === "join" || value === "invite" || value === "leave" || value === "ban" || value === "knock") {
    return value;
  }
  return "unknown";
};

const loadLocalModePreference = () => {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get("mode") === "local") return true;
  return localStorage.getItem(LOCAL_MODE_KEY) === "true";
};

const App = () => {
  const {
    me,
    users,
    spaces,
    rooms,
    messagesByRoomId,
    currentSpaceId,
    currentRoomId,
    threadRootId,
    replyToId,
    showMembers,
    showThread,
    showPins,
    showServerSettings,
    serverSettingsTab,
    searchQuery,
    composerEnterToSend,
    messageDensity,
    notificationsEnabled,
    mentionsOnlyNotifications,
    keybindsEnabled,
    composerSpellcheck,
    reducedMotion,
    highContrast,
    fontScale,
    theme,
    isOnline,
    onboardingStep,
    profileDisplayName,
    profileAbout,
    profileAvatarDataUrl,
    notifications,
    categoriesBySpaceId,
    serverSettingsBySpaceId,
    permissionOverridesBySpaceId,
    moderationAuditBySpaceId,
    roomLastReadTsByRoomId,
    threadLastViewedTsByRoomId,
    historyLoadingByRoomId,
    historyHasMoreByRoomId,
    matrixClient,
    matrixStatus,
    matrixError,
    matrixSession,
    callState,
    bootstrapMatrix,
    login,
    register,
    logout,
    selectSpace,
    selectRoom,
    createRoom,
    toggleMembers,
    toggleThread,
    togglePins,
    openServerSettings,
    closeServerSettings,
    setServerSettingsTab,
    setSearchQuery,
    setComposerEnterToSend,
    setMessageDensity,
    setNotificationsEnabled,
    setMentionsOnlyNotifications,
    setKeybindsEnabled,
    setComposerSpellcheck,
    setReducedMotion,
    setHighContrast,
    setFontScale,
    setProfileDisplayName,
    setProfileAbout,
    setProfileAvatarDataUrl,
    setTheme,
    setOnline,
    dismissNotification,
    pushNotification,
    sendMessage,
    toggleReaction,
    togglePin,
    redactMessage,
    copyMessageLink,
    deleteRoom,
    createSpace,
    renameSpace,
    saveServerSettings,
    setCategoryPermissionRule,
    setRoomPermissionRule,
    createCategory,
    renameCategory,
    deleteCategory,
    moveCategoryByStep,
    reorderCategory,
    moveRoomByStep,
    moveRoomToCategory,
    reorderRoom,
    paginateCurrentRoomHistory,
    markRoomRead,
    startReply,
    clearReply,
    simulateIncoming,
    completeOnboarding,
    joinCall,
    leaveCall,
    toggleMic,
    toggleVideo,
    toggleScreenShare
  } = useAppStore();
  const [searchFilter, setSearchFilter] = useState<RoomSearchFilter>("all");
  const [activeSearchResultIndex, setActiveSearchResultIndex] = useState(0);
  const [focusMessageId, setFocusMessageId] = useState<string | null>(null);
  const [composerFocusSignal, setComposerFocusSignal] = useState(0);
  const [showUserSettings, setShowUserSettings] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [forceLocalMode, setForceLocalMode] = useState(loadLocalModePreference);
  const refreshInFlightRef = useRef(false);
  const updateNoticeCheckedRef = useRef(false);
  const isLocalMode = forceLocalMode && !matrixClient;

  const runRefreshUpdateFlow = () => {
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    void refreshWithDesktopUpdate({ notify: pushNotification }).finally(() => {
      refreshInFlightRef.current = false;
    });
  };

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.motion = reducedMotion ? "reduced" : "full";
  }, [reducedMotion]);

  useEffect(() => {
    document.documentElement.dataset.contrast = highContrast ? "high" : "normal";
  }, [highContrast]);

  useEffect(() => {
    document.documentElement.style.setProperty("--font-scale", String(fontScale));
  }, [fontScale]);

  useEffect(() => {
    bootstrapMatrix();
  }, [bootstrapMatrix]);

  const lastNotificationCount = useRef(0);

  useEffect(() => {
    if (!notificationsEnabled) {
      lastNotificationCount.current = notifications.length;
      return;
    }
    if (notifications.length > lastNotificationCount.current) {
      const newest = notifications[0];
      if (newest) {
        const shouldNotify =
          !mentionsOnlyNotifications ||
          newest.title.toLowerCase().includes("mention") ||
          newest.body.toLowerCase().includes(`@${me.name.toLowerCase()}`);
        if (!shouldNotify) {
          lastNotificationCount.current = notifications.length;
          return;
        }
        notify(newest.title, newest.body);
      }
    }
    lastNotificationCount.current = notifications.length;
  }, [mentionsOnlyNotifications, me.name, notifications, notificationsEnabled]);

  useEffect(() => {
    if (updateNoticeCheckedRef.current) return;
    updateNoticeCheckedRef.current = true;
    void checkForDesktopUpdateAvailability().then((availableUpdate) => {
      if (!availableUpdate) return;
      pushNotification(
        "Update available",
        `Fray ${availableUpdate.version} is available.`,
        { action: { id: "install-update", label: "Update now" } }
      );
    });
  }, [pushNotification]);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (!keybindsEnabled) return;
      const isCmd = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (isRefreshShortcut(event)) {
        event.preventDefault();
        runRefreshUpdateFlow();
        return;
      }

      if (isCmd && key === "k") {
        event.preventDefault();
        setShowCommandPalette(true);
        return;
      }

      if (isCmd && event.key === ",") {
        event.preventDefault();
        setShowUserSettings(true);
        return;
      }

      if (isCmd && event.shiftKey && key === "m") {
        event.preventDefault();
        toggleMembers();
        return;
      }

      if (isCmd && event.shiftKey && key === "p") {
        event.preventDefault();
        togglePins();
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [keybindsEnabled, pushNotification, toggleMembers, togglePins]);

  const handleNotificationAction = (notificationId: string, actionId: NotificationActionId) => {
    dismissNotification(notificationId);
    if (actionId === "install-update") {
      runRefreshUpdateFlow();
    }
  };

  const currentSpace = spaces.find((space) => space.id === currentSpaceId) ?? spaces[0];
  const spaceRooms = rooms.filter((room) => room.spaceId === currentSpaceId);
  const currentCategories = categoriesBySpaceId[currentSpaceId] ?? [];
  const currentServerSettings = serverSettingsBySpaceId[currentSpaceId];
  const currentPermissionOverrides = permissionOverridesBySpaceId[currentSpaceId];
  const currentModerationAudit = moderationAuditBySpaceId[currentSpaceId] ?? [];
  const currentRoom = rooms.find((room) => room.id === currentRoomId);
  const callMode = callState.joined
    ? callState.mode
    : currentRoom?.type === "voice"
      ? "voice"
      : currentRoom?.type === "video"
        ? "video"
        : null;
  const currentMatrixRoom = matrixClient?.getRoom(currentRoomId);

  const permissionSnapshot = useMemo(() => {
    const powerLevelContent = currentMatrixRoom
      ?.currentState.getStateEvents(EventType.RoomPowerLevels, "")
      ?.getContent();
    const parsed = parsePowerLevels(powerLevelContent);
    const powerLevels = isLocalMode
      ? {
          ...parsed,
          users: {
            ...parsed.users,
            [me.id]: 100
          },
          redact: 50
        }
      : parsed;
    const membership = isLocalMode
      ? "join"
      : toMembership(currentMatrixRoom?.getMember(me.id)?.membership);
    const categoryRules =
      currentPermissionOverrides?.categories[currentRoom?.category ?? "channels"];
    const roomRules = currentRoom ? currentPermissionOverrides?.rooms[currentRoom.id] : undefined;
    return buildPermissionSnapshot({
      userId: me.id,
      membership,
      powerLevels,
      roleSettings: currentServerSettings?.roles ?? defaultRoleSettings,
      categoryRules,
      roomRules
    });
  }, [currentMatrixRoom, currentPermissionOverrides, currentRoom, currentServerSettings, isLocalMode, me.id]);

  const canManageChannels = permissionSnapshot.actions.manageChannels;
  const canDeleteChannels = useMemo(() => {
    const powerLevelContent = currentMatrixRoom
      ?.currentState.getStateEvents(EventType.RoomPowerLevels, "")
      ?.getContent();
    const parsed = parsePowerLevels(powerLevelContent);
    const powerLevels = isLocalMode
      ? {
          ...parsed,
          users: {
            ...parsed.users,
            [me.id]: 100
          },
          redact: 50
        }
      : parsed;
    const membership = isLocalMode
      ? "join"
      : toMembership(currentMatrixRoom?.getMember(me.id)?.membership);

    return canDeleteChannelsAndCategories({
      userId: me.id,
      membership,
      powerLevels,
      roleSettings: currentServerSettings?.roles ?? defaultRoleSettings
    });
  }, [currentMatrixRoom, currentServerSettings, isLocalMode, me.id]);
  const canViewInfrastructureHealth =
    permissionSnapshot.membership === "join" &&
    (permissionSnapshot.role === "owner" || permissionSnapshot.powerLevel >= 90);
  const canInviteMembers = permissionSnapshot.actions.invite;
  const roomAllMessages = messagesByRoomId[currentRoomId] ?? [];

  const roomMessages = useMemo(() => {
    return roomAllMessages.filter((message) => !message.threadRootId);
  }, [roomAllMessages]);

  const pinnedMessages = useMemo(
    () => roomAllMessages.filter((message) => message.pinned),
    [roomAllMessages]
  );

  const threadMessages = useMemo(
    () => roomAllMessages.filter((message) => message.threadRootId === threadRootId),
    [roomAllMessages, threadRootId]
  );

  const threadRootMessage = roomAllMessages.find(
    (message) => message.id === threadRootId
  );

  const historyLoading = historyLoadingByRoomId[currentRoomId] ?? false;
  const historyHasMore = historyHasMoreByRoomId[currentRoomId] ?? true;
  const welcomeRoom = useMemo(
    () =>
      spaceRooms.find((room) => room.isWelcome) ??
      spaceRooms.find((room) => room.name.toLowerCase() === "welcome"),
    [spaceRooms]
  );
  const recommendedChannels = useMemo(
    () =>
      spaceRooms
        .filter((room) => room.type === "text")
        .filter((room) => room.id !== welcomeRoom?.id)
        .slice(0, 3)
        .map((room) => ({ id: room.id, name: room.name })),
    [spaceRooms, welcomeRoom?.id]
  );
  const recommendedRoles = useMemo(
    () =>
      Array.from(
        new Set(
          users
            .flatMap((user) => user.roles)
            .filter((role) => role && role.toLowerCase() !== "member")
        )
      ).slice(0, 4),
    [users]
  );
  const roomLastReadTs = roomLastReadTsByRoomId[currentRoomId] ?? 0;
  const threadViewedByRootId = threadLastViewedTsByRoomId[currentRoomId];
  const threadSummaryByRootId = useMemo(
    () => buildThreadSummaries(roomAllMessages, roomLastReadTs, threadViewedByRootId),
    [roomAllMessages, roomLastReadTs, threadViewedByRootId]
  );
  const searchResultIds = useMemo(
    () =>
      buildSearchResultIds(roomMessages, {
        query: searchQuery,
        filter: searchFilter,
        meId: me.id,
        meName: me.name
      }),
    [roomMessages, searchQuery, searchFilter, me.id, me.name]
  );
  const activeSearchResultId =
    searchResultIds.length > 0
      ? searchResultIds[
          ((activeSearchResultIndex % searchResultIds.length) + searchResultIds.length) %
            searchResultIds.length
        ]
      : null;

  useEffect(() => {
    setActiveSearchResultIndex(0);
  }, [searchQuery, searchFilter, currentRoomId]);

  useEffect(() => {
    if (!searchResultIds.length) return;
    if (activeSearchResultIndex < searchResultIds.length) return;
    setActiveSearchResultIndex(0);
  }, [searchResultIds, activeSearchResultIndex]);

  useEffect(() => {
    if (!activeSearchResultId) return;
    setFocusMessageId(activeSearchResultId);
  }, [activeSearchResultId]);

  const handleSearchNavigate = (direction: "next" | "prev") => {
    if (!searchResultIds.length) return;
    setActiveSearchResultIndex((currentIndex) => {
      const delta = direction === "next" ? 1 : -1;
      const nextIndex = (currentIndex + delta + searchResultIds.length) % searchResultIds.length;
      setFocusMessageId(searchResultIds[nextIndex] ?? null);
      return nextIndex;
    });
  };

  const handleJumpToLatest = () => {
    const latest = roomMessages[roomMessages.length - 1];
    if (latest) {
      setFocusMessageId(latest.id);
    }
    markRoomRead(currentRoomId);
  };

  const parseMatrixToMessageLink = (href: string) => {
    try {
      const url = new URL(href);
      if (url.hostname !== "matrix.to") return null;
      const hash = url.hash.startsWith("#/") ? url.hash.slice(2) : url.hash.startsWith("#") ? url.hash.slice(1) : "";
      const segments = hash
        .split("/")
        .filter(Boolean)
        .map((segment) => decodeURIComponent(segment));
      const target = segments[0];
      const eventId = segments[1];
      if (!target || !eventId) return null;
      return { target, eventId };
    } catch {
      return null;
    }
  };

  const resolveRoomIdFromMatrixTarget = (target: string) => {
    if (target.startsWith("!")) return target;
    if (!matrixClient || !target.startsWith("#")) return null;
    const matchedRoom = matrixClient.getRooms().find((room) => {
      const canonicalAlias = room.getCanonicalAlias?.() ?? "";
      const altAliases = typeof room.getAltAliases === "function" ? room.getAltAliases() ?? [] : [];
      return canonicalAlias === target || altAliases.includes(target);
    });
    return matchedRoom?.roomId ?? null;
  };

  const handleOpenMessageLink = (href: string) => {
    const parsed = parseMatrixToMessageLink(href);
    if (!parsed) return false;
    const targetRoomId = resolveRoomIdFromMatrixTarget(parsed.target);
    if (!targetRoomId) return false;

    if (targetRoomId !== currentRoomId) {
      const roomInCurrentSpace = rooms.find((room) => room.id === targetRoomId);
      if (!roomInCurrentSpace) {
        pushNotification(
          "Message link",
          "Open the target server/channel first, then use the link again to jump to this message."
        );
        return true;
      }
      selectRoom(targetRoomId);
      window.setTimeout(() => setFocusMessageId(parsed.eventId), 0);
      return true;
    }

    setFocusMessageId(parsed.eventId);
    return true;
  };

  const handleReply = (messageId: string) => {
    startReply(messageId);
  };

  const handleQuickReply = (messageId: string) => {
    startReply(messageId);
    setComposerFocusSignal((value) => value + 1);
  };

  const handleJumpToThreadRoot = () => {
    if (!threadRootId) return;
    setFocusMessageId(threadRootId);
  };

  const handleFocusComposer = () => {
    setComposerFocusSignal((value) => value + 1);
  };

  const handleOpenWelcomeChannel = () => {
    if (!welcomeRoom) return;
    selectRoom(welcomeRoom.id);
  };

  const handleOpenRecommendedChannel = (roomId: string) => {
    selectRoom(roomId);
  };

  const handleOpenUserSettings = () => {
    setShowUserSettings(true);
  };

  const handleCloseUserSettings = () => {
    setShowUserSettings(false);
  };

  const handleUseOfflineDemo = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(LOCAL_MODE_KEY, "true");
      const url = new URL(window.location.href);
      url.searchParams.set("mode", "local");
      window.history.replaceState({}, "", url.toString());
    }
    setForceLocalMode(true);
  };

  const resolveSettingsSpaceId = () => {
    if (currentSpace?.id) {
      if (currentSpace.id !== "all") return currentSpace.id;
      if (spaceRooms.length > 0 || Boolean(currentRoomId)) return currentSpace.id;
    }
    if (currentRoom?.spaceId) return currentRoom.spaceId;
    return spaces[0]?.id;
  };

  const canOpenSpaceSettings = Boolean(resolveSettingsSpaceId());

  const handleCreateSpace = async () => {
    const name = window.prompt("Create server", "New Fray Server");
    if (!name?.trim()) return;
    await createSpace(name.trim());
  };

  const handleSpaceSettings = async () => {
    const settingsSpaceId = resolveSettingsSpaceId();
    if (!settingsSpaceId) {
      pushNotification("Server settings unavailable", "No configurable server was found.");
      return;
    }

    if (currentSpaceId !== settingsSpaceId) {
      selectSpace(settingsSpaceId);
    }

    openServerSettings("overview");
  };

  const handleInvite = async () => {
    if (!canInviteMembers) {
      pushNotification("Permission denied", "You do not have permission to create invites in this room.");
      trackLocalMetricEvent("dead_click", { source: "invite", reason: "permission_denied" });
      return;
    }
    if (!currentRoomId) {
      pushNotification("No channel selected", "Choose a channel before inviting.");
      trackLocalMetricEvent("dead_click", { source: "invite", reason: "no_room_selected" });
      return;
    }
    const room = matrixClient?.getRoom(currentRoomId);
    const target = room?.getCanonicalAlias() || currentRoomId;
    const link = `https://matrix.to/#/${encodeURIComponent(target)}`;

    if (!navigator.clipboard?.writeText) {
      pushNotification("Invite link", link);
      return;
    }

    try {
      await navigator.clipboard.writeText(link);
      pushNotification("Invite link copied", link);
    } catch {
      pushNotification("Invite link", link);
    }
  };

  if (!matrixClient && !isLocalMode) {
    return (
      <AuthScreen
        status={matrixStatus}
        error={matrixError}
        onLogin={login}
        onRegister={register}
        onUseOfflineDemo={handleUseOfflineDemo}
      />
    );
  }

  return (
    <div className={showMembers ? "app-shell with-members" : "app-shell without-members"}>
      <ServerRail
        spaces={spaces}
        currentSpaceId={currentSpaceId}
        onSelect={selectSpace}
        onCreateSpace={handleCreateSpace}
      />

      <ChannelList
        me={me}
        rooms={spaceRooms}
        categories={currentCategories}
        currentRoomId={currentRoomId}
        canManageChannels={canManageChannels}
        canDeleteChannels={canDeleteChannels}
        onSelect={selectRoom}
        spaceName={currentSpace?.name ?? "Fray"}
        isOnline={isOnline}
        onToggleOnline={() => setOnline(!isOnline)}
        onCreateRoom={createRoom}
        onCreateCategory={createCategory}
        onInvite={handleInvite}
        onOpenSpaceSettings={handleSpaceSettings}
        spaceSettingsEnabled={canOpenSpaceSettings}
        onOpenUserSettings={handleOpenUserSettings}
        onMoveCategoryByStep={moveCategoryByStep}
        onReorderCategory={reorderCategory}
        onMoveRoomByStep={moveRoomByStep}
        onMoveRoomToCategory={moveRoomToCategory}
        onReorderRoom={reorderRoom}
        onDeleteCategory={deleteCategory}
        onDeleteRoom={deleteRoom}
      />

      <main className="chat-panel">
        <RoomHeader
          room={currentRoom}
          searchQuery={searchQuery}
          onSearch={setSearchQuery}
          searchFilter={searchFilter}
          onSearchFilterChange={setSearchFilter}
          searchResultCount={searchResultIds.length}
          activeSearchResultIndex={searchResultIds.length ? activeSearchResultIndex + 1 : 0}
          onSearchPrev={() => handleSearchNavigate("prev")}
          onSearchNext={() => handleSearchNavigate("next")}
          onJumpToSearchResult={() => activeSearchResultId && setFocusMessageId(activeSearchResultId)}
          onToggleMembers={toggleMembers}
          onTogglePins={togglePins}
          onSimulate={simulateIncoming}
          isOnline={isOnline}
          onToggleOnline={() => setOnline(!isOnline)}
          enterToSend={composerEnterToSend}
          onToggleEnterToSend={() => setComposerEnterToSend(!composerEnterToSend)}
          messageDensity={messageDensity}
          onToggleMessageDensity={() =>
            setMessageDensity(messageDensity === "cozy" ? "compact" : "cozy")
          }
          theme={theme}
          onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
          onOpenUserSettings={handleOpenUserSettings}
          onOpenCommandPalette={() => setShowCommandPalette(true)}
          onLogout={logout}
        />

        <div className="chat-body">
          <div className="message-column">
            <UnreadFeed rooms={spaceRooms} onSelect={selectRoom} />
            {currentRoom ? (
              <>
                <MessageList
                  messages={roomMessages}
                  users={users}
                  meId={me.id}
                  meName={me.name}
                  messageDensity={messageDensity}
                  permissionSnapshot={permissionSnapshot}
                  onReact={toggleReaction}
                  onReply={handleReply}
                  onQuickReply={handleQuickReply}
                  onThread={(messageId) => toggleThread(messageId)}
                  onPin={togglePin}
                  onRedact={redactMessage}
                  onCopyLink={copyMessageLink}
                  canRedactMessage={(authorId) => canRedactMessage(permissionSnapshot, authorId, me.id)}
                  searchQuery={searchQuery}
                  searchFilter={searchFilter}
                  searchResultIds={searchResultIds}
                  activeSearchResultId={activeSearchResultId}
                  focusMessageId={focusMessageId}
                  onFocusHandled={() => setFocusMessageId(null)}
                  threadSummaryByRootId={threadSummaryByRootId}
                  unreadCount={currentRoom?.unreadCount ?? 0}
                  roomLastReadTs={roomLastReadTs}
                  onJumpToLatest={handleJumpToLatest}
                  onOpenMessageLink={handleOpenMessageLink}
                  onLoadOlder={paginateCurrentRoomHistory}
                  isLoadingHistory={historyLoading}
                  canLoadMoreHistory={historyHasMore}
                />
                <MessageComposer
                  replyToId={replyToId}
                  onClearReply={clearReply}
                  onSend={(payload) => sendMessage(payload)}
                  enterToSend={composerEnterToSend}
                  spellCheckEnabled={composerSpellcheck}
                  focusSignal={composerFocusSignal}
                  placeholder={`Message #${currentRoom?.name ?? ""}`}
                />
              </>
            ) : (
              <div className="empty-state">No rooms yet. Create or join a room to start.</div>
            )}
          </div>

          <div className="right-stack">
            {showPins && (
              <PinnedPanel
                pinned={pinnedMessages}
                users={users}
                onJump={(messageId) => {
                  setFocusMessageId(messageId);
                  togglePins();
                }}
                onClose={togglePins}
              />
            )}
            {showThread && (
              <ThreadPanel
                rootMessage={threadRootMessage}
                threadMessages={threadMessages}
                users={users}
                unreadReplies={threadRootId ? threadSummaryByRootId[threadRootId]?.unreadReplies ?? 0 : 0}
                onJumpToRoot={handleJumpToThreadRoot}
                onSend={(body) =>
                  sendMessage({ body, threadRootId: threadRootId ?? undefined })
                }
                enterToSend={composerEnterToSend}
                composerSpellcheck={composerSpellcheck}
                onClose={() => toggleThread(null)}
              />
            )}
            {callMode && (
              <CallDock
                mode={callMode}
                joined={callState.joined}
                micMuted={callState.micMuted}
                videoMuted={callState.videoMuted}
                screenSharing={callState.screenSharing}
                localStream={callState.localStream}
                remoteStreams={callState.remoteStreams}
                screenStreams={callState.screenshareStreams}
                onJoin={joinCall}
                onLeave={leaveCall}
                onToggleMic={toggleMic}
                onToggleVideo={toggleVideo}
                onToggleScreen={toggleScreenShare}
              />
            )}
          </div>
        </div>
      </main>

      {showMembers && <MemberList users={users} />}

      {showServerSettings && currentSpace && (
        <ServerSettingsModal
          space={currentSpace}
          rooms={spaceRooms}
          categories={currentCategories}
          matrixBaseUrl={matrixSession?.baseUrl ?? null}
          canViewInfrastructureHealth={canViewInfrastructureHealth}
          settings={currentServerSettings}
          permissionOverrides={currentPermissionOverrides}
          moderationAudit={currentModerationAudit}
          canManageChannels={canManageChannels}
          canDeleteChannels={canDeleteChannels}
          users={users}
          activeTab={serverSettingsTab}
          onTabChange={setServerSettingsTab}
          onClose={closeServerSettings}
          onRenameSpace={(name) => renameSpace(currentSpace.id, name)}
          onSaveSettings={(settings) => saveServerSettings(currentSpace.id, settings)}
          onSetCategoryPermissionRule={setCategoryPermissionRule}
          onSetRoomPermissionRule={setRoomPermissionRule}
          onCreateCategory={createCategory}
          onRenameCategory={renameCategory}
          onDeleteCategory={deleteCategory}
          onMoveCategoryByStep={moveCategoryByStep}
          onReorderCategory={reorderCategory}
          onMoveRoomByStep={moveRoomByStep}
          onMoveRoomToCategory={moveRoomToCategory}
          onReorderRoom={reorderRoom}
        />
      )}

      {showUserSettings && (
        <UserSettingsModal
          onClose={handleCloseUserSettings}
          theme={theme}
          onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
          messageDensity={messageDensity}
          onToggleMessageDensity={() =>
            setMessageDensity(messageDensity === "cozy" ? "compact" : "cozy")
          }
          notificationsEnabled={notificationsEnabled}
          mentionsOnlyNotifications={mentionsOnlyNotifications}
          onSetNotificationsEnabled={setNotificationsEnabled}
          onSetMentionsOnlyNotifications={setMentionsOnlyNotifications}
          keybindsEnabled={keybindsEnabled}
          onSetKeybindsEnabled={setKeybindsEnabled}
          composerEnterToSend={composerEnterToSend}
          composerSpellcheck={composerSpellcheck}
          onSetComposerEnterToSend={setComposerEnterToSend}
          onSetComposerSpellcheck={setComposerSpellcheck}
          reducedMotion={reducedMotion}
          highContrast={highContrast}
          fontScale={fontScale}
          onSetReducedMotion={setReducedMotion}
          onSetHighContrast={setHighContrast}
          onSetFontScale={setFontScale}
          profileDisplayName={profileDisplayName}
          profileAbout={profileAbout}
          profileAvatarDataUrl={profileAvatarDataUrl}
          onSetProfileDisplayName={setProfileDisplayName}
          onSetProfileAbout={setProfileAbout}
          onSetProfileAvatarDataUrl={setProfileAvatarDataUrl}
        />
      )}

      <CommandPalette
        isOpen={showCommandPalette}
        spaces={spaces}
        rooms={rooms}
        currentSpaceId={currentSpaceId}
        currentRoomId={currentRoomId}
        onClose={() => setShowCommandPalette(false)}
        onSelectSpace={selectSpace}
        onSelectRoom={selectRoom}
        onOpenUserSettings={handleOpenUserSettings}
        onOpenServerSettings={handleSpaceSettings}
        onToggleMembers={toggleMembers}
        onTogglePins={togglePins}
        onJumpToLatest={handleJumpToLatest}
      />

      <NotificationTray
        notifications={notifications}
        onDismiss={dismissNotification}
        onAction={handleNotificationAction}
      />
      <OnboardingOverlay
        step={onboardingStep}
        spaceName={currentSpace?.name ?? "Fray"}
        welcomeChannelName={welcomeRoom?.name}
        recommendedChannels={recommendedChannels}
        recommendedRoles={recommendedRoles}
        onOpenWelcome={handleOpenWelcomeChannel}
        onOpenChannel={handleOpenRecommendedChannel}
        onFocusComposer={handleFocusComposer}
        onComplete={completeOnboarding}
      />
    </div>
  );
};

export default App;
