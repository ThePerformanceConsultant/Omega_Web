"use client";

import { useSyncExternalStore } from "react";
import { createClient } from "./supabase/client";
import {
  fetchMyNotifications as dbFetchMyNotifications,
  markMyNotificationsRead as dbMarkMyNotificationsRead,
  subscribeToMyNotifications,
} from "./supabase/db";
import type { NotificationItem } from "./types";

let notifications: NotificationItem[] = [];
let hydratedForUserId: string | null = null;
let realtimeChannel: ReturnType<typeof subscribeToMyNotifications> | null = null;
const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((listener) => listener());
}

function sortNotifications(items: NotificationItem[]): NotificationItem[] {
  return [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

function upsertNotification(item: NotificationItem) {
  const index = notifications.findIndex((existing) => existing.id === item.id);
  if (index === -1) {
    notifications = sortNotifications([item, ...notifications]);
    emitChange();
    return;
  }
  const next = [...notifications];
  next[index] = item;
  notifications = sortNotifications(next);
  emitChange();
}

function clearRealtimeSubscription() {
  if (!realtimeChannel) return;
  const client = createClient();
  client.removeChannel(realtimeChannel);
  realtimeChannel = null;
}

export const notificationStore = {
  getNotifications(): NotificationItem[] {
    return notifications;
  },

  getUnreadCount(): number {
    return notifications.reduce((count, item) => count + (item.isRead ? 0 : 1), 0);
  },

  async hydrate(userId: string) {
    if (hydratedForUserId === userId) return;

    clearRealtimeSubscription();
    hydratedForUserId = userId;

    try {
      notifications = sortNotifications(await dbFetchMyNotifications({ limit: 100 }));
      emitChange();
    } catch (error) {
      console.error("[notificationStore] Initial load failed:", error);
      notifications = [];
      emitChange();
    }

    realtimeChannel = subscribeToMyNotifications(userId, (item) => {
      upsertNotification(item);
    });
  },

  async markAsRead(notificationIds?: number[]) {
    const ids = (notificationIds ?? []).filter((id) => Number.isFinite(id));
    const previous = notifications;

    if (ids.length === 0) {
      notifications = notifications.map((item) =>
        item.isRead
          ? item
          : {
              ...item,
              isRead: true,
              readAt: item.readAt ?? new Date().toISOString(),
            }
      );
    } else {
      const idSet = new Set(ids);
      notifications = notifications.map((item) =>
        !idSet.has(item.id) || item.isRead
          ? item
          : {
              ...item,
              isRead: true,
              readAt: item.readAt ?? new Date().toISOString(),
            }
      );
    }
    emitChange();

    try {
      await dbMarkMyNotificationsRead(ids);
    } catch (error) {
      notifications = previous;
      emitChange();
      throw error;
    }
  },

  async refresh() {
    try {
      notifications = sortNotifications(await dbFetchMyNotifications({ limit: 100 }));
      emitChange();
    } catch (error) {
      console.error("[notificationStore] Refresh failed:", error);
    }
  },

  cleanup() {
    clearRealtimeSubscription();
    hydratedForUserId = null;
    notifications = [];
    emitChange();
  },

  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function useNotifications(): NotificationItem[] {
  return useSyncExternalStore(
    notificationStore.subscribe,
    notificationStore.getNotifications,
    notificationStore.getNotifications
  );
}

export function useNotificationUnreadCount(): number {
  return useSyncExternalStore(
    notificationStore.subscribe,
    notificationStore.getUnreadCount,
    notificationStore.getUnreadCount
  );
}
