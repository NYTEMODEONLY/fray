const parseBooleanFlag = (value: string | undefined, defaultValue: boolean) => {
  if (typeof value !== "string") {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on") {
    return true;
  }
  if (normalized === "false" || normalized === "0" || normalized === "no" || normalized === "off") {
    return false;
  }
  return defaultValue;
};

export interface FeatureFlags {
  enableAdvancedAdmin: boolean;
  enableAdvancedCalls: boolean;
}

export const featureFlags: FeatureFlags = {
  enableAdvancedAdmin: parseBooleanFlag(import.meta.env.VITE_ENABLE_ADVANCED_ADMIN, false),
  enableAdvancedCalls: parseBooleanFlag(import.meta.env.VITE_ENABLE_ADVANCED_CALLS, false)
};
