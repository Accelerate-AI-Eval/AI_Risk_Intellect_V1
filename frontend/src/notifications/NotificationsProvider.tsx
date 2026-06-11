import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { fetchNotifications } from "./notificationsApi";
import {
  getReadNotificationIds,
  markAllNotificationsRead,
  markNotificationRead,
} from "./notificationStorage";
import { maybeToastNotification } from "./notificationToasts";
import type { NotificationItem, NotificationKind } from "./types";

const POLL_MS = 20_000;

const CRON_TOAST_KINDS: NotificationKind[] = [
  "cron_job_started",
  "cron_job_stopped",
];

type NotificationsContextValue = {
  items: NotificationItem[];
  loading: boolean;
  unreadCount: number;
  readIds: Set<string>;
  load: (options?: { silent?: boolean }) => Promise<void>;
  markRead: (id: string) => void;
  markAllRead: () => void;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(
  null,
);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(() =>
    getReadNotificationIds(),
  );
  const toastedIdsRef = useRef<Set<string>>(new Set());
  const toastPrimedRef = useRef(false);

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!sessionStorage.getItem("accessToken")) {
      setItems([]);
      return;
    }

    const silent = options?.silent ?? false;
    if (!silent) setLoading(true);

    const result = await fetchNotifications();

    if (!silent) setLoading(false);
    if (!result.ok) return;

    const notifications = result.notifications;
    setItems(notifications);

    if (!toastPrimedRef.current) {
      for (const item of notifications) {
        toastedIdsRef.current.add(item.id);
      }
      toastPrimedRef.current = true;
      return;
    }

    for (const item of notifications) {
      if (toastedIdsRef.current.has(item.id)) continue;
      toastedIdsRef.current.add(item.id);
      if (CRON_TOAST_KINDS.includes(item.kind)) {
        maybeToastNotification(item);
      }
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      void load({ silent: true });
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const unreadCount = useMemo(
    () => items.filter((item) => !readIds.has(item.id)).length,
    [items, readIds],
  );

  const refreshReadIds = useCallback(() => {
    setReadIds(getReadNotificationIds());
  }, []);

  const markRead = useCallback(
    (id: string) => {
      markNotificationRead(id);
      refreshReadIds();
    },
    [refreshReadIds],
  );

  const markAllRead = useCallback(() => {
    markAllNotificationsRead(items.map((item) => item.id));
    refreshReadIds();
  }, [items, refreshReadIds]);

  const value = useMemo(
    () => ({
      items,
      loading,
      unreadCount,
      readIds,
      load,
      markRead,
      markAllRead,
    }),
    [items, loading, unreadCount, readIds, load, markRead, markAllRead],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within NotificationsProvider");
  }
  return ctx;
}
