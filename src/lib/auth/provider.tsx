import { useEffect, type ReactNode } from "react";
import { initFirebaseAnalytics } from "@/lib/firebase";

/**
 * App-wide client provider mounted once near the root (in `src/routes/__root.tsx`):
 *
 *   <AuthProvider><Outlet /></AuthProvider>
 *
 * Better Auth's React client (`@/lib/auth/client`) needs NO context provider —
 * its `useSession()` works standalone. This mount starts Firebase Analytics
 * when the web config is present.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    void initFirebaseAnalytics();
  }, []);
  return <>{children}</>;
}
