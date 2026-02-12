import { invoke } from "@tauri-apps/api/core";

export interface ServerHealthQuery {
  host: string;
  username: string;
  password?: string;
  synapseContainer?: string;
  postgresContainer?: string;
  postgresUser?: string;
  postgresDatabase?: string;
}

export interface ServerHealthContainer {
  name: string;
  status: string;
  health: string;
  cpuPercent?: string;
  memoryPercent?: string;
  memoryUsage?: string;
  networkIo?: string;
  blockIo?: string;
  pids?: string;
}

export interface ServerHealthSnapshot {
  captured_at: number;
  host: {
    cpu_percent: number;
    load_1m: number;
    load_5m: number;
    load_15m: number;
    uptime_seconds: number;
    memory_total_bytes: number;
    memory_used_bytes: number;
    memory_available_bytes: number;
    disk_total_bytes: number;
    disk_used_bytes: number;
    disk_available_bytes: number;
  };
  matrix: {
    container: string;
    status: string;
    health: string;
    version?: string | null;
    room_count?: number | null;
    user_count?: number | null;
    joined_memberships?: number | null;
  };
  database: {
    container: string;
    status: string;
    health: string;
    database: string;
    size_bytes?: number | null;
    active_connections?: number | null;
  };
  containers: ServerHealthContainer[];
  errors: string[];
}

const hasTauriRuntime = () => {
  if (typeof window === "undefined") return false;
  return typeof (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ !== "undefined";
};

export const fetchServerHealthSnapshot = async (
  query: ServerHealthQuery
): Promise<ServerHealthSnapshot> => {
  if (!hasTauriRuntime()) {
    throw new Error("Server health monitoring is available in the desktop app only.");
  }

  const response = await invoke<ServerHealthSnapshot>("fetch_remote_server_health", {
    host: query.host,
    username: query.username,
    password: query.password?.trim() ? query.password : null,
    synapseContainer: query.synapseContainer?.trim() || null,
    postgresContainer: query.postgresContainer?.trim() || null,
    postgresUser: query.postgresUser?.trim() || null,
    postgresDb: query.postgresDatabase?.trim() || null
  });

  return response;
};
