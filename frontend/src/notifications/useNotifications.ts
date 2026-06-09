import { useCallback, useEffect, useState } from "react";
import { fetchNotifications } from "./notificationsApi";
import {
  getReadNotificationIds,
  markAllNotificationsRead,
  markNotificationRead,
} from "./notificationStorage";
import type { NotificationItem } from "./types";

const POLL_MS = 20_000;

export function useNotifications(enabled: boolean) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(() =>
    getReadNotificationIds(),
  );
  const [readTick, setReadTick] = useState(0);

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

    setItems(result.notifications);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void load();
  }, [enabled, load]);

  useEffect(() => {
    if (!enabled) return;

    const timer = window.setInterval(() => {
      void load({ silent: true });
    }, POLL_MS);

    return () => window.clearInterval(timer);
  }, [enabled, load]);

  const unreadCount = items.filter((item) => !readIds.has(item.id)).length;

  function refreshReadIds(): void {
    setReadIds(getReadNotificationIds());
    setReadTick((value) => value + 1);
  }

  function markRead(id: string): void {
    markNotificationRead(id);
    refreshReadIds();
  }

  function markAllRead(): void {
    markAllNotificationsRead(items.map((item) => item.id));
    refreshReadIds();
  }

  return {
    items,
    loading,
    unreadCount,
    readIds,
    readTick,
    load,
    markRead,
    markAllRead,
  };
}
