import type { AppState, AppStateGet, AppStateSet, Message, Room, Space, SpaceLayout } from "../shared";
import {
  AUDIT_LOG_EVENT,
  DEFAULT_CATEGORY_ID,
  DEFAULT_CATEGORY_NAME,
  DEFAULT_SPACE,
  PERMISSION_OVERRIDES_EVENT,
  Preset,
  ROOM_TYPE_EVENT,
  SERVER_META_EVENT,
  SERVER_SETTINGS_EVENT,
  SPACE_LAYOUT_EVENT,
  applyLayoutToRooms,
  applyLayoutToSpaceRooms,
  applyProfileToUser,
  applyProfileToUsers,
  buildSpaceIndex,
  canCurrentUserDeleteChannelsInSpace,
  createDefaultLayout,
  createDefaultPermissionOverrides,
  createDefaultServerSettings,
  defaultRoomLastReadTsByRoomId,
  getDirectRoomIds,
  getLatestMessageTimestamp,
  getOrderedRoomIdsByCategory,
  getSpaceRooms,
  hydrateLayoutForRooms,
  isRoomDeleted,
  layoutToCategories,
  loadRoomMessagesWithBackfill,
  mapEventsToMessages,
  mapMatrixRoom,
  mapMembers,
  mockRooms,
  mockSpaces,
  moveItem,
  normalizeAuditEvents,
  normalizeCategoryName,
  normalizeLayoutCategories,
  normalizePermissionOverrides,
  normalizeServerSettings,
  parseModerationAudit,
  parsePermissionOverrides,
  parseServerMetaName,
  parseServerSettings,
  parseSpaceLayout,
  requestSynapseHardDelete,
  reconcilePendingRedactionsForRoom,
  resolveSpaceStateHostRoomId,
  resolveTimelineMessages,
  setRoomOrderForCategory,
  toCategoryId,
  uid,
  withAppliedServerRoles
} from "../shared";

export type RoomsSliceState = Pick<
  AppState,
  | "spaces"
  | "rooms"
  | "currentSpaceId"
  | "currentRoomId"
  | "categoriesBySpaceId"
  | "spaceLayoutsBySpaceId"
  | "spaceStateHostRoomIdBySpaceId"
  | "roomLastReadTsByRoomId"
  | "threadLastViewedTsByRoomId"
  | "historyLoadingByRoomId"
  | "historyHasMoreByRoomId"
  | "selectSpace"
  | "selectRoom"
  | "createRoom"
  | "deleteRoom"
  | "createSpace"
  | "renameSpace"
  | "createCategory"
  | "renameCategory"
  | "deleteCategory"
  | "moveCategoryByStep"
  | "reorderCategory"
  | "moveRoomByStep"
  | "moveRoomToCategory"
  | "reorderRoom"
  | "paginateCurrentRoomHistory"
  | "markRoomRead"
>;

export const createRoomsSliceState = (
  set: AppStateSet,
  get: AppStateGet
): RoomsSliceState => ({
  spaces: mockSpaces,
  rooms: mockRooms,
  currentSpaceId: mockSpaces[0]?.id ?? DEFAULT_SPACE.id,
  currentRoomId: mockRooms[0]?.id ?? "",
  categoriesBySpaceId: {},
  spaceLayoutsBySpaceId: {},
  spaceStateHostRoomIdBySpaceId: {},
  roomLastReadTsByRoomId: defaultRoomLastReadTsByRoomId,
  threadLastViewedTsByRoomId: {},
  historyLoadingByRoomId: {},
  historyHasMoreByRoomId: {},
  selectSpace: (spaceId) => {
    const client = get().matrixClient;
    if (!client) {
      set((state) => {
        const nextRoomId = state.rooms.find((room) => room.spaceId === spaceId)?.id ?? state.currentRoomId;
        const nextRoomMessages = state.messagesByRoomId[nextRoomId] ?? [];
        const normalizedServerSettings = normalizeServerSettings(
          state.serverSettingsBySpaceId[spaceId] ?? null
        );
        const nextUsers = withAppliedServerRoles(state.users, normalizedServerSettings);
        const nextMe = nextUsers.find((user) => user.id === state.me.id) ?? state.me;
        return {
          currentSpaceId: spaceId,
          currentRoomId: nextRoomId,
          users: nextUsers,
          me: nextMe,
          spaceStateHostRoomIdBySpaceId: {
            ...state.spaceStateHostRoomIdBySpaceId,
            [spaceId]: nextRoomId
          },
          categoriesBySpaceId: {
            ...state.categoriesBySpaceId,
            [spaceId]: layoutToCategories(
              hydrateLayoutForRooms(
                state.spaceLayoutsBySpaceId[spaceId] ?? null,
                state.rooms.filter((room) => room.spaceId === spaceId)
              )
            )
          },
          spaceLayoutsBySpaceId: {
            ...state.spaceLayoutsBySpaceId,
            [spaceId]: hydrateLayoutForRooms(
              state.spaceLayoutsBySpaceId[spaceId] ?? null,
              state.rooms.filter((room) => room.spaceId === spaceId)
            )
          },
          serverSettingsBySpaceId: {
            ...state.serverSettingsBySpaceId,
            [spaceId]: normalizedServerSettings
          },
          permissionOverridesBySpaceId: {
            ...state.permissionOverridesBySpaceId,
            [spaceId]: normalizePermissionOverrides(state.permissionOverridesBySpaceId[spaceId] ?? null)
          },
          moderationAuditBySpaceId: {
            ...state.moderationAuditBySpaceId,
            [spaceId]: normalizeAuditEvents(state.moderationAuditBySpaceId[spaceId] ?? [])
          },
          roomLastReadTsByRoomId: {
            ...state.roomLastReadTsByRoomId,
            [nextRoomId]: getLatestMessageTimestamp(nextRoomMessages)
          },
          rooms: state.rooms.map((room) =>
            room.id === nextRoomId ? { ...room, unreadCount: 0 } : room
          )
        };
      });
      return;
    }

    const { spaces, children } = buildSpaceIndex(client, DEFAULT_SPACE);
    const directRoomIds = getDirectRoomIds(client);
    const availableSpaces = spaces.length ? spaces : [DEFAULT_SPACE];
    const targetSpace = availableSpaces.find((space) => space.id === spaceId) ?? availableSpaces[0];
    const mappedRooms = client
      .getRooms()
      .filter((room) => room.getType() !== "m.space")
      .filter((room) => {
        const currentUserId = client.getUserId() ?? "";
        const membership =
          typeof room.getMyMembership === "function"
            ? room.getMyMembership()
            : typeof room.getMember === "function"
              ? room.getMember(currentUserId)?.membership
              : undefined;
        return membership === "join" || membership === "invite";
      })
      .filter((room) => !isRoomDeleted(room))
      .filter((room) => {
        if (targetSpace.id === DEFAULT_SPACE.id && spaces.length === 0) return true;
        const allowed = children.get(targetSpace.id);
        if (!allowed || allowed.size === 0) return true;
        return allowed.has(room.roomId);
      })
      .map((room) => mapMatrixRoom(client, room, targetSpace.id, directRoomIds));

    const spaceStateHostRoomId =
      targetSpace.id === DEFAULT_SPACE.id
        ? mappedRooms.find((room) => room.type !== "dm")?.id ?? mappedRooms[0]?.id ?? null
        : targetSpace.id;
    const spaceStateHostRoom = spaceStateHostRoomId ? client.getRoom(spaceStateHostRoomId) : null;

    const parsedLayout = parseSpaceLayout(spaceStateHostRoom);
    const hydratedLayout = hydrateLayoutForRooms(parsedLayout, mappedRooms);
    const parsedServerSettings = parseServerSettings(spaceStateHostRoom);
    const parsedPermissionOverrides = parsePermissionOverrides(spaceStateHostRoom);
    const parsedModerationAudit = parseModerationAudit(spaceStateHostRoom);
    const parsedServerMetaName = parseServerMetaName(spaceStateHostRoom);
    const rooms = applyLayoutToRooms(mappedRooms, hydratedLayout);
    const categories = layoutToCategories(hydratedLayout);
    const serverSettings = normalizeServerSettings(
      parsedServerSettings ?? get().serverSettingsBySpaceId[targetSpace.id] ?? null
    );
    const permissionOverrides = normalizePermissionOverrides(
      parsedPermissionOverrides ?? get().permissionOverridesBySpaceId[targetSpace.id] ?? null
    );
    const moderationAudit = normalizeAuditEvents(
      parsedModerationAudit ?? get().moderationAuditBySpaceId[targetSpace.id] ?? []
    );
    const nextSpaces = availableSpaces.map((space) => {
      if (space.id !== targetSpace.id) return space;
      const nextName = parsedServerMetaName ?? space.name;
      return {
        ...space,
        name: nextName,
        icon: (nextName || space.icon || "S").slice(0, 1).toUpperCase()
      };
    });

    const nextRoomId = rooms[0]?.id ?? "";
    set((state) => ({
      spaces: nextSpaces,
      rooms,
      currentSpaceId: targetSpace.id,
      currentRoomId: nextRoomId,
      categoriesBySpaceId: {
        ...state.categoriesBySpaceId,
        [targetSpace.id]: categories
      },
      spaceLayoutsBySpaceId: {
        ...state.spaceLayoutsBySpaceId,
        [targetSpace.id]: hydratedLayout
      },
      spaceStateHostRoomIdBySpaceId: {
        ...state.spaceStateHostRoomIdBySpaceId,
        [targetSpace.id]: spaceStateHostRoomId ?? ""
      },
      serverSettingsBySpaceId: {
        ...state.serverSettingsBySpaceId,
        [targetSpace.id]: serverSettings
      },
      permissionOverridesBySpaceId: {
        ...state.permissionOverridesBySpaceId,
        [targetSpace.id]: permissionOverrides
      },
      moderationAuditBySpaceId: {
        ...state.moderationAuditBySpaceId,
        [targetSpace.id]: moderationAudit
      },
      roomLastReadTsByRoomId: nextRoomId
        ? {
            ...state.roomLastReadTsByRoomId,
            [nextRoomId]: getLatestMessageTimestamp(state.messagesByRoomId[nextRoomId] ?? [])
          }
        : state.roomLastReadTsByRoomId
    }));

    if (nextRoomId) {
      get().selectRoom(nextRoomId);
    }
  },
  selectRoom: (roomId) => {
    const client = get().matrixClient;
    if (!client) {
      set((state) => {
        const roomMessages = state.messagesByRoomId[roomId] ?? [];
        return {
          currentRoomId: roomId,
          replyToId: null,
          threadRootId: null,
          showThread: false,
          historyHasMoreByRoomId: {
            ...state.historyHasMoreByRoomId,
            [roomId]: true
          },
          roomLastReadTsByRoomId: {
            ...state.roomLastReadTsByRoomId,
            [roomId]: getLatestMessageTimestamp(roomMessages)
          },
          rooms: state.rooms.map((room) =>
            room.id === roomId ? { ...room, unreadCount: 0 } : room
          )
        };
      });
      return;
    }

    const room = client.getRoom(roomId);
    if (!room) return;

    const timelineMessages = mapEventsToMessages(client, room);
    const members = mapMembers(client, room);
    const meMember = members.find((member) => member.id === client.getUserId());

    set((state) => ({
      ...(() => {
        const fallbackMe = meMember ?? state.me;
        const nextMe = applyProfileToUser(
          fallbackMe,
          state.profileDisplayName,
          state.profileAvatarDataUrl
        );
        const nextUsers = applyProfileToUsers(
          members,
          nextMe.id,
          state.profileDisplayName,
          state.profileAvatarDataUrl
        );
        const roomSpaceId =
          state.rooms.find((roomItem) => roomItem.id === roomId)?.spaceId ?? state.currentSpaceId;
        const roomServerSettings = normalizeServerSettings(state.serverSettingsBySpaceId[roomSpaceId] ?? null);
        const nextUsersWithRoles = withAppliedServerRoles(nextUsers, roomServerSettings);
        const nextMeWithRoles = nextUsersWithRoles.find((user) => user.id === nextMe.id) ?? nextMe;
        return {
          users: nextUsersWithRoles,
          me: nextMeWithRoles
        };
      })(),
      currentRoomId: roomId,
      replyToId: null,
      threadRootId: null,
      showThread: false,
      messagesByRoomId: {
        ...state.messagesByRoomId,
        [roomId]: resolveTimelineMessages({
          existingMessages: state.messagesByRoomId[roomId] ?? [],
          timelineMessages
        })
      },
      historyHasMoreByRoomId: {
        ...state.historyHasMoreByRoomId,
        [roomId]: true
      },
      roomLastReadTsByRoomId: {
        ...state.roomLastReadTsByRoomId,
        [roomId]: getLatestMessageTimestamp(
          resolveTimelineMessages({
            existingMessages: state.messagesByRoomId[roomId] ?? [],
            timelineMessages
          })
        )
      },
      rooms: state.rooms.map((roomItem) =>
        roomItem.id === roomId ? { ...roomItem, unreadCount: 0 } : roomItem
      )
    }));
    reconcilePendingRedactionsForRoom({
      room,
      currentRoomId: roomId,
      redactMessage: get().redactMessage
    });

    if (timelineMessages.length === 0) {
      void (async () => {
        try {
          const { messages, hasMore } = await loadRoomMessagesWithBackfill(client, room);
          if (messages.length === 0) return;
          set((state) => {
            if (state.currentRoomId !== roomId) {
              return {};
            }
            return {
              messagesByRoomId: {
                ...state.messagesByRoomId,
                [roomId]: messages
              },
              historyHasMoreByRoomId: {
                ...state.historyHasMoreByRoomId,
                [roomId]: hasMore
              },
              roomLastReadTsByRoomId: {
                ...state.roomLastReadTsByRoomId,
                [roomId]: getLatestMessageTimestamp(messages)
              }
            };
          });
          reconcilePendingRedactionsForRoom({
            room,
            currentRoomId: get().currentRoomId,
            redactMessage: get().redactMessage
          });
        } catch (error) {
          console.warn("Failed to backfill room messages after empty timeline load", error);
        }
      })();
    }
  },
  markRoomRead: (roomId) =>
    set((state) => {
      const targetRoomId = roomId ?? state.currentRoomId;
      if (!targetRoomId) return {};
      const roomMessages = state.messagesByRoomId[targetRoomId] ?? [];
      const nextReadTs = getLatestMessageTimestamp(roomMessages);
      return {
        roomLastReadTsByRoomId: {
          ...state.roomLastReadTsByRoomId,
          [targetRoomId]: nextReadTs
        },
        rooms: state.rooms.map((room) =>
          room.id === targetRoomId ? { ...room, unreadCount: 0 } : room
        )
      };
    }),
  createRoom: async ({ name, type, category }) => {
    const client = get().matrixClient;
    if (!client) {
      set((state) => {
        const spaceId = state.currentSpaceId;
        const categoryId = category?.trim() || DEFAULT_CATEGORY_ID;
        const room: Room = {
          id: uid("r"),
          spaceId,
          name,
          type,
          category: categoryId,
          topic: type === "voice" ? "Drop in voice channel" : type === "video" ? "Video + screen share" : "New text channel",
          unreadCount: 0
        };
        const existingSpaceRooms = getSpaceRooms(state.rooms, spaceId);
        const nextLayout = hydrateLayoutForRooms(
          state.spaceLayoutsBySpaceId[spaceId] ?? null,
          [...existingSpaceRooms, room]
        );
        const usedOrders = Object.values(nextLayout.rooms)
          .filter((placement) => placement.categoryId === categoryId)
          .map((placement) => placement.order);
        const nextOrder = usedOrders.length ? Math.max(...usedOrders) + 1 : 0;
        nextLayout.rooms[room.id] = { categoryId, order: nextOrder };
        if (!nextLayout.categories.some((entry) => entry.id === categoryId)) {
          nextLayout.categories = normalizeLayoutCategories([
            ...nextLayout.categories,
            {
              id: categoryId,
              name: categoryId === DEFAULT_CATEGORY_ID ? DEFAULT_CATEGORY_NAME : categoryId,
              order: nextLayout.categories.length
            }
          ]);
        }
        const nextRooms = applyLayoutToSpaceRooms([...state.rooms, room], spaceId, nextLayout);

        return {
          rooms: nextRooms,
          categoriesBySpaceId: {
            ...state.categoriesBySpaceId,
            [spaceId]: layoutToCategories(nextLayout)
          },
          spaceLayoutsBySpaceId: {
            ...state.spaceLayoutsBySpaceId,
            [spaceId]: nextLayout
          },
          currentRoomId: room.id,
          replyToId: null,
          threadRootId: null,
          showThread: false
        };
      });
      return;
    }

    const { room_id } = await client.createRoom({
      name,
      preset: Preset.PublicChat
    });
    await client.sendStateEvent(room_id, ROOM_TYPE_EVENT as any, { type }, "");
    if (category?.trim()) {
      await client.setRoomTag(room_id, category.trim(), { order: 0 });
    }

    const state = get();
    const logicalSpaceId = state.currentSpaceId;
    const spaceStateHostRoomId = resolveSpaceStateHostRoomId(state, logicalSpaceId);
    if (logicalSpaceId && spaceStateHostRoomId) {
      const existingLayout = state.spaceLayoutsBySpaceId[logicalSpaceId] ?? createDefaultLayout();
      const nextLayout = {
        ...existingLayout,
        categories: [...existingLayout.categories],
        rooms: { ...existingLayout.rooms }
      };
      const categoryId = category?.trim() || DEFAULT_CATEGORY_ID;
      if (!nextLayout.categories.some((entry) => entry.id === categoryId)) {
        nextLayout.categories = normalizeLayoutCategories([
          ...nextLayout.categories,
          {
            id: categoryId,
            name: categoryId === DEFAULT_CATEGORY_ID ? DEFAULT_CATEGORY_NAME : categoryId,
            order: nextLayout.categories.length
          }
        ]);
      }
      const usedOrders = Object.values(nextLayout.rooms)
        .filter((placement) => placement.categoryId === categoryId)
        .map((placement) => placement.order);
      nextLayout.rooms[room_id] = {
        categoryId,
        order: usedOrders.length ? Math.max(...usedOrders) + 1 : 0
      };

      try {
        await client.sendStateEvent(spaceStateHostRoomId, SPACE_LAYOUT_EVENT as any, nextLayout, "");
        set((current) => ({
          spaceLayoutsBySpaceId: {
            ...current.spaceLayoutsBySpaceId,
            [logicalSpaceId]: nextLayout
          },
          categoriesBySpaceId: {
            ...current.categoriesBySpaceId,
            [logicalSpaceId]: layoutToCategories(nextLayout)
          },
          spaceStateHostRoomIdBySpaceId: {
            ...current.spaceStateHostRoomIdBySpaceId,
            [logicalSpaceId]: spaceStateHostRoomId
          }
        }));
      } catch (error) {
        get().pushNotification("Failed to update channel layout", (error as Error).message);
      }
    }
    get().selectSpace(logicalSpaceId);
  },
  deleteRoom: async (roomId) => {
    const state = get();
    const room = state.rooms.find((candidate) => candidate.id === roomId);
    if (!room || room.type === "dm") return;

    const spaceId = room.spaceId;
    if (!canCurrentUserDeleteChannelsInSpace(state, spaceId, roomId)) {
      get().pushNotification(
        "Channel delete unavailable",
        "Only server admins or roles explicitly granted Manage Channels can delete channels."
      );
      return;
    }
    const spaceStateHostRoomId = resolveSpaceStateHostRoomId(
      { ...state, currentRoomId: roomId },
      spaceId
    );
    if (!spaceId || !spaceStateHostRoomId) {
      get().pushNotification(
        "Channel delete unavailable",
        "Select a server context before deleting channels."
      );
      return;
    }

    const categoryId = room.category ?? DEFAULT_CATEGORY_ID;
    const remainingSpaceRooms = getSpaceRooms(state.rooms, spaceId).filter(
      (candidate) => candidate.id !== roomId
    );
    const baseLayout = hydrateLayoutForRooms(state.spaceLayoutsBySpaceId[spaceId] ?? null, remainingSpaceRooms);
    const nextLayout: SpaceLayout = {
      ...baseLayout,
      categories: [...baseLayout.categories],
      rooms: { ...baseLayout.rooms }
    };

    const remainingRoomIds = getOrderedRoomIdsByCategory(nextLayout, categoryId).filter(
      (candidateRoomId) => candidateRoomId !== roomId
    );
    setRoomOrderForCategory(nextLayout, categoryId, remainingRoomIds);
    delete nextLayout.rooms[roomId];
    const fallbackHostRoomId =
      remainingSpaceRooms.find((candidate) => candidate.type !== "dm")?.id ??
      remainingSpaceRooms[0]?.id ??
      "";
    const currentStateHostRoomId = state.spaceStateHostRoomIdBySpaceId[spaceId];
    const layoutHostRoomId =
      currentStateHostRoomId === roomId ? fallbackHostRoomId : spaceStateHostRoomId;

    const client = state.matrixClient;
    if (client) {
      const session = state.matrixSession;
      if (!session?.accessToken || !session.baseUrl) {
        get().pushNotification(
          "Failed to permanently delete channel",
          "Missing Matrix session credentials for Synapse admin deletion."
        );
        return;
      }

      try {
        await requestSynapseHardDelete({
          baseUrl: session.baseUrl,
          accessToken: session.accessToken,
          roomId,
          requesterUserId: state.me.id
        });
      } catch (error) {
        get().pushNotification(
          "Failed to permanently delete channel",
          (error as Error).message
        );
        return;
      }

      if (layoutHostRoomId) {
        await client
          .sendStateEvent(layoutHostRoomId, SPACE_LAYOUT_EVENT as any, nextLayout, "")
          .catch((error) => {
            get().pushNotification(
              "Channel deleted with layout warning",
              `Room was deleted, but layout sync failed: ${(error as Error).message}`
            );
          });
      }
    }

    set((current) => {
      const nextRooms = current.rooms.filter((candidate) => candidate.id !== roomId);
      const nextSpaceRooms = getSpaceRooms(nextRooms, spaceId);
      const appliedRooms = applyLayoutToSpaceRooms(nextRooms, spaceId, nextLayout);
      const fallbackRoomId = nextSpaceRooms[0]?.id ?? appliedRooms[0]?.id ?? "";
      const nextFallbackHostRoomId =
        nextSpaceRooms.find((candidate) => candidate.type !== "dm")?.id ?? fallbackRoomId;
      const nextCurrentRoomId =
        current.currentRoomId === roomId ? fallbackRoomId : current.currentRoomId;
      const currentRoomWasDeleted = current.currentRoomId === roomId;
      const fallbackRoom = appliedRooms.find((candidate) => candidate.id === nextCurrentRoomId);
      const nextCurrentSpaceId = currentRoomWasDeleted
        ? fallbackRoom?.spaceId ?? current.currentSpaceId
        : current.currentSpaceId;
      const currentHostRoomId = current.spaceStateHostRoomIdBySpaceId[spaceId];
      const nextStateHostRoomId =
        currentHostRoomId === roomId ? nextFallbackHostRoomId : currentHostRoomId;
      const nextMessagesByRoomId = { ...current.messagesByRoomId };
      const nextRoomLastReadTsByRoomId = { ...current.roomLastReadTsByRoomId };
      const nextThreadLastViewedTsByRoomId = { ...current.threadLastViewedTsByRoomId };
      const nextHistoryLoadingByRoomId = { ...current.historyLoadingByRoomId };
      const nextHistoryHasMoreByRoomId = { ...current.historyHasMoreByRoomId };
      delete nextMessagesByRoomId[roomId];
      delete nextRoomLastReadTsByRoomId[roomId];
      delete nextThreadLastViewedTsByRoomId[roomId];
      delete nextHistoryLoadingByRoomId[roomId];
      delete nextHistoryHasMoreByRoomId[roomId];

      return {
        rooms: appliedRooms,
        currentSpaceId: nextCurrentSpaceId,
        currentRoomId: nextCurrentRoomId,
        replyToId: currentRoomWasDeleted ? null : current.replyToId,
        threadRootId: currentRoomWasDeleted ? null : current.threadRootId,
        showThread: currentRoomWasDeleted ? false : current.showThread,
        messagesByRoomId: nextMessagesByRoomId,
        roomLastReadTsByRoomId: nextRoomLastReadTsByRoomId,
        threadLastViewedTsByRoomId: nextThreadLastViewedTsByRoomId,
        historyLoadingByRoomId: nextHistoryLoadingByRoomId,
        historyHasMoreByRoomId: nextHistoryHasMoreByRoomId,
        categoriesBySpaceId: {
          ...current.categoriesBySpaceId,
          [spaceId]: layoutToCategories(nextLayout)
        },
        spaceLayoutsBySpaceId: {
          ...current.spaceLayoutsBySpaceId,
          [spaceId]: nextLayout
        },
        spaceStateHostRoomIdBySpaceId: {
          ...current.spaceStateHostRoomIdBySpaceId,
          [spaceId]: nextStateHostRoomId ?? ""
        }
      };
    });

    if (client) {
      await client.leave(roomId).catch(() => undefined);
      await client.forget(roomId).catch(() => undefined);
    }

    get().pushNotification("Channel deleted", `${room.name} was permanently removed.`);
  },
  createSpace: async (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const client = get().matrixClient;
    if (!client) {
      const space: Space = {
        id: uid("s"),
        name: trimmed,
        icon: trimmed.slice(0, 1).toUpperCase() || "S"
      };
      const defaultLayout = createDefaultLayout();
      const defaultSettings = createDefaultServerSettings();
      const defaultPermissionOverrides = createDefaultPermissionOverrides();
      set((state) => ({
        spaces: [...state.spaces, space],
        currentSpaceId: space.id,
        currentRoomId: state.rooms.find((room) => room.spaceId === space.id)?.id ?? "",
        categoriesBySpaceId: {
          ...state.categoriesBySpaceId,
          [space.id]: layoutToCategories(defaultLayout)
        },
        spaceLayoutsBySpaceId: {
          ...state.spaceLayoutsBySpaceId,
          [space.id]: defaultLayout
        },
        serverSettingsBySpaceId: {
          ...state.serverSettingsBySpaceId,
          [space.id]: defaultSettings
        },
        permissionOverridesBySpaceId: {
          ...state.permissionOverridesBySpaceId,
          [space.id]: defaultPermissionOverrides
        },
        moderationAuditBySpaceId: {
          ...state.moderationAuditBySpaceId,
          [space.id]: []
        }
      }));
      return;
    }

    try {
      const { room_id } = await client.createRoom({
        name: trimmed,
        creation_content: { type: "m.space" },
        preset: Preset.PrivateChat
      });
      const defaultLayout = createDefaultLayout();
      const defaultSettings = createDefaultServerSettings();
      const defaultPermissionOverrides = createDefaultPermissionOverrides();

      set((state) => ({
        spaces: [
          ...state.spaces.filter((space) => space.id !== room_id),
          {
            id: room_id,
            name: trimmed,
            icon: trimmed.slice(0, 1).toUpperCase() || "S"
          }
        ],
        categoriesBySpaceId: {
          ...state.categoriesBySpaceId,
          [room_id]: layoutToCategories(defaultLayout)
        },
        spaceLayoutsBySpaceId: {
          ...state.spaceLayoutsBySpaceId,
          [room_id]: defaultLayout
        },
        serverSettingsBySpaceId: {
          ...state.serverSettingsBySpaceId,
          [room_id]: defaultSettings
        },
        permissionOverridesBySpaceId: {
          ...state.permissionOverridesBySpaceId,
          [room_id]: defaultPermissionOverrides
        },
        moderationAuditBySpaceId: {
          ...state.moderationAuditBySpaceId,
          [room_id]: []
        }
      }));

      try {
        await client.sendStateEvent(room_id, SPACE_LAYOUT_EVENT as any, defaultLayout, "");
        await client.sendStateEvent(room_id, SERVER_SETTINGS_EVENT as any, defaultSettings, "");
        await client.sendStateEvent(
          room_id,
          PERMISSION_OVERRIDES_EVENT as any,
          defaultPermissionOverrides,
          ""
        );
        await client.sendStateEvent(room_id, AUDIT_LOG_EVENT as any, { version: 1, events: [] }, "");
      } catch (error) {
        get().pushNotification("Server created with defaults", (error as Error).message);
      }

      get().selectSpace(room_id);
    } catch (error) {
      get().pushNotification("Unable to create server", (error as Error).message);
    }
  },
  renameSpace: async (spaceId, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const state = get();
    const spaceStateHostRoomId = resolveSpaceStateHostRoomId(state, spaceId);
    if (!spaceStateHostRoomId) {
      get().pushNotification("Unable to rename server", "No server context host room found.");
      return;
    }

    const nextSpace = { id: spaceId, name: trimmed, icon: trimmed.slice(0, 1).toUpperCase() || "S" };
    const client = state.matrixClient;
    if (!client) {
      set((state) => ({
        spaces: state.spaces.map((space) =>
          space.id === spaceId ? { ...space, ...nextSpace } : space
        ),
        spaceStateHostRoomIdBySpaceId: {
          ...state.spaceStateHostRoomIdBySpaceId,
          [spaceId]: spaceStateHostRoomId
        }
      }));
      return;
    }

    try {
      const renameAsRoomName = spaceId !== DEFAULT_SPACE.id && spaceStateHostRoomId === spaceId;
      if (renameAsRoomName) {
        await client.setRoomName(spaceId, trimmed);
      } else {
        await client.sendStateEvent(spaceStateHostRoomId, SERVER_META_EVENT as any, { name: trimmed }, "");
      }
      set((state) => ({
        spaces: state.spaces.map((space) =>
          space.id === spaceId ? { ...space, ...nextSpace } : space
        ),
        spaceStateHostRoomIdBySpaceId: {
          ...state.spaceStateHostRoomIdBySpaceId,
          [spaceId]: spaceStateHostRoomId
        }
      }));
    } catch (error) {
      get().pushNotification("Unable to rename server", (error as Error).message);
    }
  },
  createCategory: async (name) => {
    const state = get();
    const spaceId = state.currentSpaceId;
    if (!spaceId) return;
    const spaceStateHostRoomId = resolveSpaceStateHostRoomId(state, spaceId);
    if (!spaceStateHostRoomId) return;
    const trimmed = normalizeCategoryName(name);
    const client = state.matrixClient;
    const spaceRooms = getSpaceRooms(state.rooms, spaceId);
    const baseLayout = hydrateLayoutForRooms(state.spaceLayoutsBySpaceId[spaceId] ?? null, spaceRooms);
    const nextLayout: SpaceLayout = {
      ...baseLayout,
      categories: [...baseLayout.categories],
      rooms: { ...baseLayout.rooms }
    };

    let categoryId = toCategoryId(trimmed);
    let suffix = 1;
    while (nextLayout.categories.some((category) => category.id === categoryId)) {
      suffix += 1;
      categoryId = `${toCategoryId(trimmed)}-${suffix}`;
    }

    nextLayout.categories = normalizeLayoutCategories([
      ...nextLayout.categories,
      { id: categoryId, name: trimmed, order: nextLayout.categories.length }
    ]);

    if (client) {
      try {
        await client.sendStateEvent(spaceStateHostRoomId, SPACE_LAYOUT_EVENT as any, nextLayout, "");
      } catch (error) {
        get().pushNotification("Failed to create category", (error as Error).message);
        return;
      }
    }

    set((current) => ({
      spaceLayoutsBySpaceId: {
        ...current.spaceLayoutsBySpaceId,
        [spaceId]: nextLayout
      },
      categoriesBySpaceId: {
        ...current.categoriesBySpaceId,
        [spaceId]: layoutToCategories(nextLayout)
      },
      rooms: applyLayoutToSpaceRooms(current.rooms, spaceId, nextLayout)
    }));
  },
  renameCategory: async (categoryId, name) => {
    const state = get();
    const spaceId = state.currentSpaceId;
    if (!spaceId) return;
    const spaceStateHostRoomId = resolveSpaceStateHostRoomId(state, spaceId);
    if (!spaceStateHostRoomId) return;
    const trimmed = normalizeCategoryName(name);
    const client = state.matrixClient;
    const spaceRooms = getSpaceRooms(state.rooms, spaceId);
    const baseLayout = hydrateLayoutForRooms(state.spaceLayoutsBySpaceId[spaceId] ?? null, spaceRooms);
    if (!baseLayout.categories.some((category) => category.id === categoryId)) return;

    const nextLayout: SpaceLayout = {
      ...baseLayout,
      categories: normalizeLayoutCategories(
        baseLayout.categories.map((category) =>
          category.id === categoryId ? { ...category, name: trimmed } : category
        )
      ),
      rooms: { ...baseLayout.rooms }
    };

    if (client) {
      try {
        await client.sendStateEvent(spaceStateHostRoomId, SPACE_LAYOUT_EVENT as any, nextLayout, "");
      } catch (error) {
        get().pushNotification("Failed to rename category", (error as Error).message);
        return;
      }
    }

    set((current) => ({
      spaceLayoutsBySpaceId: {
        ...current.spaceLayoutsBySpaceId,
        [spaceId]: nextLayout
      },
      categoriesBySpaceId: {
        ...current.categoriesBySpaceId,
        [spaceId]: layoutToCategories(nextLayout)
      },
      rooms: applyLayoutToSpaceRooms(current.rooms, spaceId, nextLayout)
    }));
  },
  deleteCategory: async (categoryId) => {
    if (categoryId === DEFAULT_CATEGORY_ID) return;
    const state = get();
    const spaceId = state.currentSpaceId;
    if (!spaceId) return;
    if (!canCurrentUserDeleteChannelsInSpace(state, spaceId, state.currentRoomId)) {
      get().pushNotification(
        "Category delete unavailable",
        "Only server admins or roles explicitly granted Manage Channels can delete categories."
      );
      return;
    }
    const spaceStateHostRoomId = resolveSpaceStateHostRoomId(state, spaceId);
    if (!spaceStateHostRoomId) return;
    const client = state.matrixClient;
    const spaceRooms = getSpaceRooms(state.rooms, spaceId);
    const baseLayout = hydrateLayoutForRooms(state.spaceLayoutsBySpaceId[spaceId] ?? null, spaceRooms);
    if (!baseLayout.categories.some((category) => category.id === categoryId)) return;

    const nextLayout: SpaceLayout = {
      ...baseLayout,
      categories: normalizeLayoutCategories(
        baseLayout.categories.filter((category) => category.id !== categoryId)
      ),
      rooms: { ...baseLayout.rooms }
    };

    const movedRoomIds = getOrderedRoomIdsByCategory(nextLayout, categoryId);
    const defaultRoomIds = getOrderedRoomIdsByCategory(nextLayout, DEFAULT_CATEGORY_ID);
    setRoomOrderForCategory(nextLayout, DEFAULT_CATEGORY_ID, [...defaultRoomIds, ...movedRoomIds]);

    if (client) {
      try {
        await client.sendStateEvent(spaceStateHostRoomId, SPACE_LAYOUT_EVENT as any, nextLayout, "");
      } catch (error) {
        get().pushNotification("Failed to delete category", (error as Error).message);
        return;
      }
    }

    set((current) => ({
      spaceLayoutsBySpaceId: {
        ...current.spaceLayoutsBySpaceId,
        [spaceId]: nextLayout
      },
      categoriesBySpaceId: {
        ...current.categoriesBySpaceId,
        [spaceId]: layoutToCategories(nextLayout)
      },
      rooms: applyLayoutToSpaceRooms(current.rooms, spaceId, nextLayout)
    }));
  },
  moveCategoryByStep: async (categoryId, direction) => {
    if (categoryId === DEFAULT_CATEGORY_ID) return;
    const state = get();
    const spaceId = state.currentSpaceId;
    if (!spaceId) return;
    const spaceStateHostRoomId = resolveSpaceStateHostRoomId(state, spaceId);
    if (!spaceStateHostRoomId) return;
    const client = state.matrixClient;
    const spaceRooms = getSpaceRooms(state.rooms, spaceId);
    const baseLayout = hydrateLayoutForRooms(state.spaceLayoutsBySpaceId[spaceId] ?? null, spaceRooms);
    const categories = normalizeLayoutCategories(baseLayout.categories);
    const sourceIndex = categories.findIndex((category) => category.id === categoryId);
    if (sourceIndex < 0) return;
    const targetIndex = direction === "up" ? sourceIndex - 1 : sourceIndex + 1;
    if (targetIndex < 0 || targetIndex >= categories.length) return;
    if (categories[targetIndex]?.id === DEFAULT_CATEGORY_ID) return;

    const reordered = moveItem(categories, sourceIndex, targetIndex).map((category, index) => ({
      ...category,
      order: index
    }));
    const nextLayout: SpaceLayout = {
      ...baseLayout,
      categories: normalizeLayoutCategories(reordered),
      rooms: { ...baseLayout.rooms }
    };

    if (client) {
      try {
        await client.sendStateEvent(spaceStateHostRoomId, SPACE_LAYOUT_EVENT as any, nextLayout, "");
      } catch (error) {
        get().pushNotification("Failed to move category", (error as Error).message);
        return;
      }
    }

    set((current) => ({
      spaceLayoutsBySpaceId: {
        ...current.spaceLayoutsBySpaceId,
        [spaceId]: nextLayout
      },
      categoriesBySpaceId: {
        ...current.categoriesBySpaceId,
        [spaceId]: layoutToCategories(nextLayout)
      },
      rooms: applyLayoutToSpaceRooms(current.rooms, spaceId, nextLayout)
    }));
  },
  reorderCategory: async (sourceCategoryId, targetCategoryId) => {
    if (sourceCategoryId === targetCategoryId) return;
    if (sourceCategoryId === DEFAULT_CATEGORY_ID || targetCategoryId === DEFAULT_CATEGORY_ID) return;
    const state = get();
    const spaceId = state.currentSpaceId;
    if (!spaceId) return;
    const spaceStateHostRoomId = resolveSpaceStateHostRoomId(state, spaceId);
    if (!spaceStateHostRoomId) return;
    const client = state.matrixClient;
    const spaceRooms = getSpaceRooms(state.rooms, spaceId);
    const baseLayout = hydrateLayoutForRooms(state.spaceLayoutsBySpaceId[spaceId] ?? null, spaceRooms);
    const categories = normalizeLayoutCategories(baseLayout.categories);
    const sourceIndex = categories.findIndex((category) => category.id === sourceCategoryId);
    const targetIndex = categories.findIndex((category) => category.id === targetCategoryId);
    if (sourceIndex < 0 || targetIndex < 0) return;

    const reordered = moveItem(categories, sourceIndex, targetIndex).map((category, index) => ({
      ...category,
      order: index
    }));
    const nextLayout: SpaceLayout = {
      ...baseLayout,
      categories: normalizeLayoutCategories(reordered),
      rooms: { ...baseLayout.rooms }
    };

    if (client) {
      try {
        await client.sendStateEvent(spaceStateHostRoomId, SPACE_LAYOUT_EVENT as any, nextLayout, "");
      } catch (error) {
        get().pushNotification("Failed to reorder categories", (error as Error).message);
        return;
      }
    }

    set((current) => ({
      spaceLayoutsBySpaceId: {
        ...current.spaceLayoutsBySpaceId,
        [spaceId]: nextLayout
      },
      categoriesBySpaceId: {
        ...current.categoriesBySpaceId,
        [spaceId]: layoutToCategories(nextLayout)
      },
      rooms: applyLayoutToSpaceRooms(current.rooms, spaceId, nextLayout)
    }));
  },
  moveRoomByStep: async (roomId, direction) => {
    const state = get();
    const spaceId = state.currentSpaceId;
    if (!spaceId) return;
    const spaceStateHostRoomId = resolveSpaceStateHostRoomId(state, spaceId);
    if (!spaceStateHostRoomId) return;
    const client = state.matrixClient;
    const spaceRooms = getSpaceRooms(state.rooms, spaceId);
    const baseLayout = hydrateLayoutForRooms(state.spaceLayoutsBySpaceId[spaceId] ?? null, spaceRooms);
    const placement = baseLayout.rooms[roomId];
    if (!placement) return;

    const roomIds = getOrderedRoomIdsByCategory(baseLayout, placement.categoryId);
    const sourceIndex = roomIds.indexOf(roomId);
    if (sourceIndex < 0) return;
    const targetIndex = direction === "up" ? sourceIndex - 1 : sourceIndex + 1;
    if (targetIndex < 0 || targetIndex >= roomIds.length) return;

    const reordered = moveItem(roomIds, sourceIndex, targetIndex);
    const nextLayout: SpaceLayout = {
      ...baseLayout,
      categories: [...baseLayout.categories],
      rooms: { ...baseLayout.rooms }
    };
    setRoomOrderForCategory(nextLayout, placement.categoryId, reordered);

    if (client) {
      try {
        await client.sendStateEvent(spaceStateHostRoomId, SPACE_LAYOUT_EVENT as any, nextLayout, "");
      } catch (error) {
        get().pushNotification("Failed to move channel", (error as Error).message);
        return;
      }
    }

    set((current) => ({
      spaceLayoutsBySpaceId: {
        ...current.spaceLayoutsBySpaceId,
        [spaceId]: nextLayout
      },
      categoriesBySpaceId: {
        ...current.categoriesBySpaceId,
        [spaceId]: layoutToCategories(nextLayout)
      },
      rooms: applyLayoutToSpaceRooms(current.rooms, spaceId, nextLayout)
    }));
  },
  moveRoomToCategory: async (roomId, categoryId) => {
    const state = get();
    const spaceId = state.currentSpaceId;
    if (!spaceId) return;
    const spaceStateHostRoomId = resolveSpaceStateHostRoomId(state, spaceId);
    if (!spaceStateHostRoomId) return;
    const client = state.matrixClient;
    const spaceRooms = getSpaceRooms(state.rooms, spaceId);
    const baseLayout = hydrateLayoutForRooms(state.spaceLayoutsBySpaceId[spaceId] ?? null, spaceRooms);
    if (!baseLayout.rooms[roomId]) return;
    if (!baseLayout.categories.some((category) => category.id === categoryId)) return;

    const fromCategory = baseLayout.rooms[roomId].categoryId;
    if (fromCategory === categoryId) return;

    const nextLayout: SpaceLayout = {
      ...baseLayout,
      categories: [...baseLayout.categories],
      rooms: { ...baseLayout.rooms }
    };

    const sourceRoomIds = getOrderedRoomIdsByCategory(nextLayout, fromCategory).filter(
      (currentRoomId) => currentRoomId !== roomId
    );
    const targetRoomIds = getOrderedRoomIdsByCategory(nextLayout, categoryId);
    setRoomOrderForCategory(nextLayout, fromCategory, sourceRoomIds);
    setRoomOrderForCategory(nextLayout, categoryId, [...targetRoomIds, roomId]);

    if (client) {
      try {
        await client.sendStateEvent(spaceStateHostRoomId, SPACE_LAYOUT_EVENT as any, nextLayout, "");
      } catch (error) {
        get().pushNotification("Failed to move channel to category", (error as Error).message);
        return;
      }
    }

    set((current) => ({
      spaceLayoutsBySpaceId: {
        ...current.spaceLayoutsBySpaceId,
        [spaceId]: nextLayout
      },
      categoriesBySpaceId: {
        ...current.categoriesBySpaceId,
        [spaceId]: layoutToCategories(nextLayout)
      },
      rooms: applyLayoutToSpaceRooms(current.rooms, spaceId, nextLayout)
    }));
  },
  reorderRoom: async (sourceRoomId, targetRoomId, targetCategoryId) => {
    if (sourceRoomId === targetRoomId) return;
    const state = get();
    const spaceId = state.currentSpaceId;
    if (!spaceId) return;
    const spaceStateHostRoomId = resolveSpaceStateHostRoomId(state, spaceId);
    if (!spaceStateHostRoomId) return;
    const client = state.matrixClient;
    const spaceRooms = getSpaceRooms(state.rooms, spaceId);
    const baseLayout = hydrateLayoutForRooms(state.spaceLayoutsBySpaceId[spaceId] ?? null, spaceRooms);
    const sourcePlacement = baseLayout.rooms[sourceRoomId];
    const targetPlacement = baseLayout.rooms[targetRoomId];
    if (!sourcePlacement || !targetPlacement) return;

    const destinationCategoryId = targetCategoryId ?? targetPlacement.categoryId;
    if (!baseLayout.categories.some((category) => category.id === destinationCategoryId)) return;

    const nextLayout: SpaceLayout = {
      ...baseLayout,
      categories: [...baseLayout.categories],
      rooms: { ...baseLayout.rooms }
    };

    const sourceCategoryRoomIds = getOrderedRoomIdsByCategory(nextLayout, sourcePlacement.categoryId).filter(
      (roomId) => roomId !== sourceRoomId
    );
    setRoomOrderForCategory(nextLayout, sourcePlacement.categoryId, sourceCategoryRoomIds);

    const destinationRoomIds = getOrderedRoomIdsByCategory(nextLayout, destinationCategoryId);
    const targetIndex = destinationRoomIds.indexOf(targetRoomId);
    const insertIndex = targetIndex >= 0 ? targetIndex : destinationRoomIds.length;
    const withInsert = [
      ...destinationRoomIds.slice(0, insertIndex),
      sourceRoomId,
      ...destinationRoomIds.slice(insertIndex)
    ].filter((roomId, index, array) => array.indexOf(roomId) === index);
    setRoomOrderForCategory(nextLayout, destinationCategoryId, withInsert);

    if (client) {
      try {
        await client.sendStateEvent(spaceStateHostRoomId, SPACE_LAYOUT_EVENT as any, nextLayout, "");
      } catch (error) {
        get().pushNotification("Failed to reorder channels", (error as Error).message);
        return;
      }
    }

    set((current) => ({
      spaceLayoutsBySpaceId: {
        ...current.spaceLayoutsBySpaceId,
        [spaceId]: nextLayout
      },
      categoriesBySpaceId: {
        ...current.categoriesBySpaceId,
        [spaceId]: layoutToCategories(nextLayout)
      },
      rooms: applyLayoutToSpaceRooms(current.rooms, spaceId, nextLayout)
    }));
  },
  paginateCurrentRoomHistory: async () => {
    const client = get().matrixClient;
    const roomId = get().currentRoomId;
    if (!roomId) return;

    if (!client) {
      const loading = get().historyLoadingByRoomId[roomId];
      const hasMore = get().historyHasMoreByRoomId[roomId] ?? true;
      if (loading || !hasMore) return;

      set((state) => ({
        historyLoadingByRoomId: {
          ...state.historyLoadingByRoomId,
          [roomId]: true
        }
      }));

      await Promise.resolve();

      set((state) => {
        const existing = state.messagesByRoomId[roomId] ?? [];
        const oldestTimestamp = existing[0]?.timestamp ?? Date.now();
        const olderMessages: Message[] = Array.from({ length: 30 }, (_, index) => ({
          id: uid("m_hist"),
          roomId,
          authorId: state.users[index % state.users.length]?.id ?? state.me.id,
          body: `Older message ${index + 1} in #${roomId}`,
          timestamp: oldestTimestamp - (30 - index) * 60_000,
          reactions: []
        }));

        return {
          messagesByRoomId: {
            ...state.messagesByRoomId,
            [roomId]: [...olderMessages, ...existing]
          },
          historyHasMoreByRoomId: {
            ...state.historyHasMoreByRoomId,
            [roomId]: false
          },
          historyLoadingByRoomId: {
            ...state.historyLoadingByRoomId,
            [roomId]: false
          }
        };
      });
      return;
    }

    const loading = get().historyLoadingByRoomId[roomId];
    const hasMore = get().historyHasMoreByRoomId[roomId] ?? true;
    if (loading || !hasMore) return;

    const room = client.getRoom(roomId);
    if (!room) return;

    set((state) => ({
      historyLoadingByRoomId: {
        ...state.historyLoadingByRoomId,
        [roomId]: true
      }
    }));

    try {
      const hasMoreHistory = await client.paginateEventTimeline(room.getLiveTimeline(), {
        backwards: true,
        limit: 40
      });
      const messages = mapEventsToMessages(client, room);

      set((state) => ({
        messagesByRoomId: {
          ...state.messagesByRoomId,
          [roomId]: messages
        },
        historyHasMoreByRoomId: {
          ...state.historyHasMoreByRoomId,
          [roomId]: hasMoreHistory
        },
        historyLoadingByRoomId: {
          ...state.historyLoadingByRoomId,
          [roomId]: false
        }
      }));
    } catch (error) {
      console.warn("Failed to paginate room history", error);
      set((state) => ({
        historyLoadingByRoomId: {
          ...state.historyLoadingByRoomId,
          [roomId]: false
        }
      }));
    }
  }
});
