"use client";

import { useServiceWorker } from "@/hooks/use-service-worker";

export function ServiceWorkerProvider({ children }: { children: React.ReactNode }) {
  // Register service worker on app load
  useServiceWorker();

  return <>{children}</>;
}

export { useServiceWorker };
