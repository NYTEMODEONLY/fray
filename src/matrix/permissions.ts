import { EventType, type MatrixRoom } from "./client";

export const getRoomPowerLevelContent = (room: MatrixRoom | null | undefined) => {
  return room?.currentState.getStateEvents(EventType.RoomPowerLevels, "")?.getContent();
};

export const getRoomMembership = (room: MatrixRoom | null | undefined, userId: string) => {
  return room?.getMember(userId)?.membership;
};
