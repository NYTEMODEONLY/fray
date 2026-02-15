import {
  ClientEvent,
  EventStatus,
  EventType,
  GroupCallEvent,
  GroupCallIntent,
  GroupCallType,
  IndexedDBStore,
  MatrixEventEvent,
  MsgType,
  NotificationCountType,
  Preset,
  RelationType,
  RoomEvent,
  createClient,
  type MatrixClient
} from "matrix-js-sdk";
import type { CallFeed } from "matrix-js-sdk/lib/webrtc/callFeed";
import type { MatrixSession } from "./session";

export type { MatrixClient, MatrixEvent, Room as MatrixRoom } from "matrix-js-sdk";
export type { CallFeed };

export {
  ClientEvent,
  EventStatus,
  EventType,
  GroupCallEvent,
  GroupCallIntent,
  GroupCallType,
  MatrixEventEvent,
  MsgType,
  NotificationCountType,
  Preset,
  RelationType,
  RoomEvent
};

export const createTemporaryMatrixClient = (baseUrl: string) => createClient({ baseUrl });

export const createSessionMatrixClient = async (session: MatrixSession): Promise<MatrixClient> => {
  const hasIndexedDb = typeof window !== "undefined" && Boolean(window.indexedDB);
  const store = hasIndexedDb
    ? new IndexedDBStore({ indexedDB: window.indexedDB, dbName: "fray-matrix" })
    : null;

  let client = createClient({
    baseUrl: session.baseUrl,
    accessToken: session.accessToken,
    userId: session.userId,
    deviceId: session.deviceId,
    store: store ?? undefined,
    timelineSupport: true
  });

  if (store) {
    try {
      // matrix-js-sdk requires startup after a client is attached to the store.
      await store.startup();
    } catch (error) {
      console.warn("IndexedDB store startup failed, retrying without persistent store", error);
      client = createClient({
        baseUrl: session.baseUrl,
        accessToken: session.accessToken,
        userId: session.userId,
        deviceId: session.deviceId,
        timelineSupport: true
      });
    }
  }

  try {
    await client.initRustCrypto();
  } catch (error) {
    console.warn("Rust crypto init failed", error);
  }

  return client;
};

export const startMatrixClient = (client: MatrixClient, initialSyncLimit = 30) => {
  client.startClient({ initialSyncLimit });
};

export const stopMatrixClient = (client: MatrixClient) => {
  client.stopClient();
};

export const logoutMatrixClient = async (client: MatrixClient) => {
  await client.logout(true).catch(() => undefined);
};
