"use client";

import { useEffect } from "react";

export function SentryProvider({ children }: { children: React.ReactNode }) {
  // Sentry client-side initialization is now handled by instrumentation-client.ts
  return <>{children}</>;
}
