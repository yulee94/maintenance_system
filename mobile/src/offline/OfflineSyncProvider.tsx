import NetInfo from "@react-native-community/netinfo";
import { useEffect } from "react";
import type { PropsWithChildren } from "react";
import { useAuth } from "../api/AuthContext";
import { initializeOfflineDb, syncOfflineQueue } from "./offlineQueue";

export function OfflineSyncProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();

  useEffect(() => {
    void initializeOfflineDb();
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    void syncOfflineQueue().catch(() => undefined);
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        void syncOfflineQueue().catch(() => undefined);
      }
    });
    return unsubscribe;
  }, [user]);

  return <>{children}</>;
}
