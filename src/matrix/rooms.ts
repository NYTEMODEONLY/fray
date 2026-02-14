import { EventType, NotificationCountType, type MatrixClient, type MatrixRoom } from "./client";
import type { Room, Space, User } from "../types";

const getAvatarInitial = (name: string) => name.slice(0, 1).toUpperCase() || "?";
const DEFAULT_CATEGORY_ID = "channels";

export const mapMembers = (client: MatrixClient, room: MatrixRoom): User[] =>
  room.getJoinedMembers().map((member) => {
    const avatarMxc =
      typeof member.getMxcAvatarUrl === "function" ? member.getMxcAvatarUrl() : undefined;
    return {
      id: member.userId,
      name: member.name ?? member.userId,
      avatar: getAvatarInitial(member.name ?? member.userId),
      avatarUrl: avatarMxc ? client.mxcUrlToHttp(avatarMxc, 80, 80, "crop") ?? undefined : undefined,
      status: "offline",
      roles: [member.powerLevel === 100 ? "Admin" : "Member"]
    };
  });

export const buildSpaceIndex = (client: MatrixClient, defaultSpace: Space) => {
  const rooms = client.getRooms();
  const spaceRooms = rooms.filter((room) => room.getType() === "m.space");
  const spaces: Space[] = spaceRooms.length
    ? spaceRooms.map((room) => ({
        id: room.roomId,
        name: room.name || room.roomId,
        icon: (room.name || "S").slice(0, 1).toUpperCase()
      }))
    : [defaultSpace];
  const children = new Map<string, Set<string>>();

  spaceRooms.forEach((space) => {
    const childEvents = space.currentState.getStateEvents("m.space.child") ?? [];
    childEvents.forEach((event) => {
      const roomId = event.getStateKey();
      if (!roomId) return;
      if (!children.has(space.roomId)) {
        children.set(space.roomId, new Set());
      }
      children.get(space.roomId)?.add(roomId);
    });
  });

  return { spaces, children };
};

export const getDirectRoomIds = (client: MatrixClient) => {
  const directEvent = client.getAccountData(EventType.Direct);
  const content = directEvent?.getContent() ?? {};
  const directRoomIds = new Set<string>();
  Object.values(content).forEach((rooms) => {
    if (Array.isArray(rooms)) {
      rooms.forEach((roomId) => directRoomIds.add(roomId as string));
    }
  });
  return directRoomIds;
};

export const mapMatrixRoom = (
  client: MatrixClient,
  room: MatrixRoom,
  spaceId: string,
  directRoomIds: Set<string>
): Room => {
  const typeEvent = room.currentState.getStateEvents("com.fray.room_type", "");
  const mappedType = typeEvent?.getContent()?.type as Room["type"] | undefined;
  const isDm = directRoomIds.has(room.roomId);
  const tags = Object.keys(room.tags ?? {});
  const category = tags[0] ?? DEFAULT_CATEGORY_ID;
  const type: Room["type"] = isDm ? "dm" : mappedType ?? "text";
  const topicEvent = room.currentState.getStateEvents("m.room.topic", "");
  const topic = topicEvent?.getContent()?.topic ?? "";

  return {
    id: room.roomId,
    spaceId,
    name: room.name || room.getDefaultRoomName(client.getUserId() ?? "") || room.roomId,
    type,
    category,
    topic,
    unreadCount: room.getUnreadNotificationCount
      ? room.getUnreadNotificationCount(NotificationCountType.Total)
      : 0
  };
};

export const isRoomDeleted = (room: MatrixRoom) => {
  const typeEvent = room.currentState.getStateEvents("com.fray.room_type", "");
  return typeEvent?.getContent()?.deleted === true;
};
