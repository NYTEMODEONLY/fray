import { useEffect, useMemo, useRef } from "react";
import { CallDock } from "./components/CallDock";
import { ChannelList } from "./components/ChannelList";
import { MemberList } from "./components/MemberList";
import { MessageComposer } from "./components/MessageComposer";
import { MessageList } from "./components/MessageList";
import { NotificationTray } from "./components/NotificationTray";
import { OnboardingOverlay } from "./components/OnboardingOverlay";
import { PinnedPanel } from "./components/PinnedPanel";
import { RoomHeader } from "./components/RoomHeader";
import { ServerRail } from "./components/ServerRail";
import { ThreadPanel } from "./components/ThreadPanel";
import { UnreadFeed } from "./components/UnreadFeed";
import { useAppStore } from "./store/appStore";
import { notify } from "./platform/notifications";

const App = () => {
  const {
    me,
    users,
    spaces,
    rooms,
    messages,
    currentSpaceId,
    currentRoomId,
    threadRootId,
    replyToId,
    showMembers,
    showThread,
    showPins,
    searchQuery,
    theme,
    isOnline,
    onboardingStep,
    notifications,
    selectSpace,
    selectRoom,
    toggleMembers,
    toggleThread,
    togglePins,
    setSearchQuery,
    setTheme,
    setOnline,
    dismissNotification,
    sendMessage,
    toggleReaction,
    togglePin,
    startReply,
    clearReply,
    simulateIncoming,
    completeOnboarding
  } = useAppStore();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const lastNotificationCount = useRef(0);

  useEffect(() => {
    if (notifications.length > lastNotificationCount.current) {
      const newest = notifications[0];
      if (newest) {
        notify(newest.title, newest.body);
      }
    }
    lastNotificationCount.current = notifications.length;
  }, [notifications]);

  const currentSpace = spaces.find((space) => space.id === currentSpaceId) ?? spaces[0];
  const spaceRooms = rooms.filter((room) => room.spaceId === currentSpaceId);
  const currentRoom = rooms.find((room) => room.id === currentRoomId);

  const roomMessages = useMemo(
    () => messages.filter((message) => message.roomId === currentRoomId && !message.threadRootId),
    [messages, currentRoomId]
  );

  const pinnedMessages = useMemo(
    () => messages.filter((message) => message.roomId === currentRoomId && message.pinned),
    [messages, currentRoomId]
  );

  const threadMessages = useMemo(
    () => messages.filter((message) => message.threadRootId === threadRootId),
    [messages, threadRootId]
  );

  const threadRootMessage = messages.find((message) => message.id === threadRootId);

  return (
    <div className="app-shell">
      <ServerRail
        spaces={spaces}
        currentSpaceId={currentSpaceId}
        onSelect={selectSpace}
      />

      <ChannelList
        rooms={spaceRooms}
        currentRoomId={currentRoomId}
        onSelect={selectRoom}
        spaceName={currentSpace?.name ?? "Fray"}
      />

      <main className="chat-panel">
        <RoomHeader
          room={currentRoom}
          searchQuery={searchQuery}
          onSearch={setSearchQuery}
          onToggleMembers={toggleMembers}
          onTogglePins={togglePins}
          onSimulate={simulateIncoming}
          isOnline={isOnline}
          onToggleOnline={() => setOnline(!isOnline)}
          theme={theme}
          onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
        />

        <div className="chat-body">
          <div className="message-column">
            <UnreadFeed rooms={spaceRooms} onSelect={selectRoom} />
            <MessageList
              messages={roomMessages}
              users={users}
              meId={me.id}
              onReact={toggleReaction}
              onReply={startReply}
              onThread={(messageId) => toggleThread(messageId)}
              onPin={togglePin}
              searchQuery={searchQuery}
            />
            <MessageComposer
              replyToId={replyToId}
              onClearReply={clearReply}
              onSend={(payload) => sendMessage(payload)}
              placeholder={`Message #${currentRoom?.name ?? ""}`}
            />
          </div>

          <div className="right-stack">
            {showPins && (
              <PinnedPanel pinned={pinnedMessages} users={users} onClose={togglePins} />
            )}
            {showThread && (
              <ThreadPanel
                rootMessage={threadRootMessage}
                threadMessages={threadMessages}
                users={users}
                onSend={(body) =>
                  sendMessage({ body, threadRootId: threadRootId ?? undefined })
                }
                onClose={() => toggleThread(null)}
              />
            )}
          </div>
        </div>

        <CallDock />
      </main>

      {showMembers && <MemberList users={users} />}

      <NotificationTray notifications={notifications} onDismiss={dismissNotification} />
      <OnboardingOverlay step={onboardingStep} onComplete={completeOnboarding} />
    </div>
  );
};

export default App;
