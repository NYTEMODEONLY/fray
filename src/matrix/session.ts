import { createTemporaryMatrixClient } from "./client";

const SESSION_KEY = "fray.matrix.session";

export interface MatrixSession {
  baseUrl: string;
  accessToken: string;
  userId: string;
  deviceId: string;
  refreshToken?: string;
}

const isMatrixSession = (value: unknown): value is MatrixSession => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<MatrixSession>;
  return (
    typeof candidate.baseUrl === "string" &&
    typeof candidate.accessToken === "string" &&
    typeof candidate.userId === "string" &&
    typeof candidate.deviceId === "string"
  );
};

export const loadMatrixSession = (): MatrixSession | null => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isMatrixSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const saveMatrixSession = (session: MatrixSession) => {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // ignore storage failures
  }
};

export const clearMatrixSession = () => {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore storage failures
  }
};

export const loginWithPassword = async (
  baseUrl: string,
  username: string,
  password: string
): Promise<MatrixSession> => {
  const tempClient = createTemporaryMatrixClient(baseUrl);
  const response = await tempClient.login("m.login.password", {
    user: username,
    password
  });

  return {
    baseUrl,
    accessToken: response.access_token,
    userId: response.user_id,
    deviceId: response.device_id,
    refreshToken: response.refresh_token
  };
};

export const registerWithPassword = async (
  baseUrl: string,
  username: string,
  password: string
): Promise<MatrixSession> => {
  const tempClient = createTemporaryMatrixClient(baseUrl);
  const response = await tempClient.register(username, password, null, { type: "m.login.dummy" });

  if (!response.access_token || !response.user_id || !response.device_id) {
    throw new Error("Registration did not return credentials");
  }

  return {
    baseUrl,
    accessToken: response.access_token,
    userId: response.user_id,
    deviceId: response.device_id
  };
};
