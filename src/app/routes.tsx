import type { ReactNode } from "react";
import { AuthScreen } from "../components/AuthScreen";
import type { AppState } from "../store";

interface AppRoutesProps {
  matrixClient: AppState["matrixClient"];
  isLocalMode: boolean;
  matrixStatus: AppState["matrixStatus"];
  matrixError: AppState["matrixError"];
  onLogin: AppState["login"];
  onRegister: AppState["register"];
  onUseOfflineDemo: () => void;
  children: ReactNode;
}

export const AppRoutes = ({
  matrixClient,
  isLocalMode,
  matrixStatus,
  matrixError,
  onLogin,
  onRegister,
  onUseOfflineDemo,
  children
}: AppRoutesProps) => {
  if (!matrixClient && !isLocalMode) {
    return (
      <AuthScreen
        status={matrixStatus}
        error={matrixError}
        onLogin={onLogin}
        onRegister={onRegister}
        onUseOfflineDemo={onUseOfflineDemo}
      />
    );
  }

  return <>{children}</>;
};
