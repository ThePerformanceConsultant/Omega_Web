"use client";

import { useMemo } from "react";
import { useSyncExternalStore } from "react";
import { Conversation, Message } from "./types";
import {
  fetchConversations as dbFetchConversations,
  fetchMessages as dbFetchMessages,
  sendMessage as dbSendMessage,
  markMessagesRead as dbMarkRead,
  createConversation as dbCreateConversation,
  fetchClients,
  getMessageImageUrl,
  subscribeToMessages,
  subscribeToConversations,
} from "./supabase/db";
import { createClient } from "./supabase/client";

// =============================================
// Supabase-backed store for messaging
// =============================================

let conversations: Conversation[] = [];
let messages: Message[] = [];
const listeners = new Set<() => void>();
let _hydrated = false;
let _coachId = "";
let _clientMap = new Map<string, Record<string, unknown>>();

const messageCache = new Map<string, Message[]>();
let totalUnreadCache: number | null = null;

// Realtime channel references for cleanup
const channels: Array<ReturnType<typeof subscribeToMessages>> = [];

function emitChange() {
  messageCache.clear();
  totalUnreadCache = null;
  listeners.forEach((l) => l());
}

// Map a DB conversation row + client info to our Conversation type
function fromDbConversation(row: Record<string, unknown>, clientMap: Map<string, Record<string, unknown>>, coachId: string): Conversation {
  const clientInfo = clientMap.get(row.client_id as string);
  const lastSenderId = row.last_sender_id as string | null;
  return {
    id: String(row.id),
    clientId: row.client_id as string,
    clientName: (clientInfo?.full_name as string) ?? "Unknown",
    clientInitials: (clientInfo?.avatar_initials as string) ?? "?",
    lastMessage: (row.last_message_preview as string) ?? "",
    lastMessageAt: (row.last_message_at as string) ?? "",
    lastMessageSender: lastSenderId === coachId ? "coach" : "client",
    unreadCount: Number(row.coach_unread ?? 0),
  };
}

function fromDbMessage(row: Record<string, unknown>, coachId: string): Message {
  return {
    id: String(row.id),
    conversationId: String(row.conversation_id),
    senderId: row.sender_id as string,
    senderRole: row.sender_id === coachId ? "coach" : "client",
    content: (row.content as string | null) ?? "",
    imagePath: (row.image_path as string | null) ?? null,
    imageUrl: (row.image_url as string | null) ?? null,
    sentAt: row.sent_at as string,
    isRead: (row.read as boolean) ?? false,
  };
}

function subscribeToConversation(conversationId: string) {
  const channel = subscribeToMessages(conversationId, async (newRow: Record<string, unknown>) => {
    const rowWithImage = { ...newRow };
    const imagePath = (newRow.image_path as string | null) ?? null;
    if (imagePath && !newRow.image_url) {
      rowWithImage.image_url = await getMessageImageUrl(imagePath);
    }
    const msg = fromDbMessage(rowWithImage, _coachId);
    // Skip if this is our own message (already added optimistically)
    if (msg.senderRole === "coach") return;
    // Skip duplicates
    if (messages.some((m) => m.id === msg.id)) return;

    messages = [...messages, msg];
    // Update conversation metadata
    conversations = conversations.map((c) =>
      c.id === conversationId
        ? {
            ...c,
            lastMessage: messagePreview(msg.content, msg.imagePath),
            lastMessageAt: msg.sentAt,
            lastMessageSender: "client" as const,
            unreadCount: c.unreadCount + 1,
          }
        : c
    );
    emitChange();
  });
  if (channel) channels.push(channel);
}

function messagePreview(content: string, imagePath?: string | null): string {
  const text = content.trim();
  if (text.length > 0) return text;
  if (imagePath) return "📷 Image";
  return "";
}

export const messageStore = {
  getConversations() {
    return conversations;
  },

  getMessages(conversationId: string): Message[] {
    const cached = messageCache.get(conversationId);
    if (cached) return cached;

    const result = messages
      .filter((m) => m.conversationId === conversationId)
      .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
    messageCache.set(conversationId, result);
    return result;
  },

  getTotalUnread(): number {
    if (totalUnreadCache !== null) return totalUnreadCache;
    totalUnreadCache = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
    return totalUnreadCache;
  },

  /** Hydrate conversations from Supabase and subscribe to realtime */
  async hydrate(coachId: string) {
    if (_hydrated) return;
    _coachId = coachId;
    try {
      const [convRows, clients] = await Promise.all([
        dbFetchConversations(coachId, "coach"),
        fetchClients(),
      ]);
      _clientMap = new Map(clients.map((c: Record<string, unknown>) => [c.id as string, c]));
      conversations = (convRows ?? []).map((r: Record<string, unknown>) => fromDbConversation(r, _clientMap, coachId));
      _hydrated = true;
      emitChange();

      // Subscribe to realtime for each conversation
      for (const conv of conversations) {
        subscribeToConversation(conv.id);
      }

      // Subscribe to NEW conversations (client-initiated) and conversation updates
      const convChannel = subscribeToConversations(
        coachId,
        // New conversation created by a client
        async (newRow: Record<string, unknown>) => {
          const convId = String(newRow.id);
          if (conversations.some((c) => c.id === convId)) return;
          // Refresh client map if this client isn't known yet
          const clientId = newRow.client_id as string;
          if (!_clientMap.has(clientId)) {
            const clients = await fetchClients();
            _clientMap = new Map(clients.map((c: Record<string, unknown>) => [c.id as string, c]));
          }
          const conv = fromDbConversation(newRow, _clientMap, coachId);
          conversations = [conv, ...conversations];
          subscribeToConversation(conv.id);
          emitChange();
        },
        // Existing conversation updated (e.g. client sent message, unread count changed)
        (updatedRow: Record<string, unknown>) => {
          const convId = String(updatedRow.id);
          const existing = conversations.find((c) => c.id === convId);
          if (!existing) return;
          conversations = conversations.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  lastMessage: (updatedRow.last_message_preview as string) ?? c.lastMessage,
                  lastMessageAt: (updatedRow.last_message_at as string) ?? c.lastMessageAt,
                  unreadCount: Number(updatedRow.coach_unread ?? c.unreadCount),
                }
              : c
          );
          emitChange();
        }
      );
      if (convChannel) channels.push(convChannel);
    } catch (err) {
      console.error("[messageStore] hydrate failed:", err);
    }
  },

  /** Load messages for a specific conversation */
  async loadMessages(conversationId: string, coachId: string) {
    try {
      const rows = await dbFetchMessages(conversationId);
      const newMsgs = (rows ?? []).map((r: Record<string, unknown>) => fromDbMessage(r, coachId));
      messages = [
        ...messages.filter((m) => m.conversationId !== conversationId),
        ...newMsgs,
      ];
      emitChange();
    } catch (err) {
      console.error("[messageStore] loadMessages failed:", err);
    }
  },

  /** Create or get conversation for a client */
  async createConversation(coachId: string, clientId: string): Promise<Conversation | null> {
    try {
      const row = await dbCreateConversation(coachId, clientId);
      const conv = fromDbConversation(row as Record<string, unknown>, _clientMap, coachId);
      // Add to list if not already present
      if (!conversations.some((c) => c.id === conv.id)) {
        conversations = [conv, ...conversations];
        subscribeToConversation(conv.id);
      }
      emitChange();
      return conv;
    } catch (err) {
      console.error("[messageStore] createConversation failed:", err);
      return null;
    }
  },

  async sendMessage(
    conversationId: string,
    payload: { content: string; imagePath?: string | null; imageUrl?: string | null },
    senderId: string
  ) {
    const content = payload.content.trim();
    const imagePath = payload.imagePath ?? null;
    const imageUrl = payload.imageUrl ?? null;
    if (!content && !imagePath) return;

    const now = new Date().toISOString();
    const previousConversation = conversations.find((c) => c.id === conversationId) ?? null;
    const preview = messagePreview(content, imagePath);
    // Optimistic local update
    const tempMsg: Message = {
      id: `temp-${Date.now()}`,
      conversationId,
      senderId,
      senderRole: "coach",
      content,
      imagePath,
      imageUrl,
      sentAt: now,
      isRead: true,
    };
    messages = [...messages, tempMsg];
    conversations = conversations.map((c) =>
      c.id === conversationId
        ? { ...c, lastMessage: preview, lastMessageAt: now, lastMessageSender: "coach" as const }
        : c
    );
    emitChange();

    // Persist to Supabase
    try {
      const saved = await dbSendMessage({ conversationId, senderId, content, imagePath });
      const savedMapped = fromDbMessage(saved as Record<string, unknown>, _coachId);
      // Replace temp message with real one
      messages = messages.map((m) =>
        m.id === tempMsg.id
          ? savedMapped
          : m
      );
      emitChange();
    } catch (err) {
      messages = messages.filter((m) => m.id !== tempMsg.id);
      conversations = conversations.map((c) =>
        c.id === conversationId
          ? (previousConversation ?? c)
          : c
      );
      emitChange();
      console.error("[messageStore] sendMessage failed:", err);
    }
  },

  async markAsRead(conversationId: string) {
    conversations = conversations.map((c) =>
      c.id === conversationId ? { ...c, unreadCount: 0 } : c
    );
    messages = messages.map((m) =>
      m.conversationId === conversationId && m.senderRole === "client" && !m.isRead
        ? { ...m, isRead: true }
        : m
    );
    emitChange();

    // Persist to Supabase
    try {
      await dbMarkRead(conversationId, "coach");
    } catch (err) {
      console.error("[messageStore] markAsRead failed:", err);
    }
  },

  /** Send the same message to multiple clients, creating conversations as needed */
  async broadcastMessage(coachId: string, clientIds: string[], content: string): Promise<number> {
    let sent = 0;
    for (const clientId of clientIds) {
      try {
        // Find existing conversation or create one
        let conv = conversations.find((c) => c.clientId === clientId);
        if (!conv) {
          const created = await this.createConversation(coachId, clientId);
          if (!created) continue;
          conv = created;
        }
        await this.sendMessage(conv.id, { content }, coachId);
        sent++;
      } catch (err) {
        console.error(`[messageStore] broadcast to ${clientId} failed:`, err);
      }
    }
    return sent;
  },

  /** Clean up realtime subscriptions */
  cleanup() {
    const supabase = createClient();
    for (const ch of channels) {
      if (ch) supabase.removeChannel(ch);
    }
    channels.length = 0;
    _hydrated = false;
    conversations = [];
    messages = [];
    emitChange();
  },

  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

/** Reactive hook — re-renders when conversations change. */
export function useConversations(): Conversation[] {
  return useSyncExternalStore(
    messageStore.subscribe,
    messageStore.getConversations,
    messageStore.getConversations
  );
}

/** Reactive hook — gets sorted messages for a conversation. */
export function useMessages(conversationId: string): Message[] {
  const getSnapshot = useMemo(
    () => () => messageStore.getMessages(conversationId),
    [conversationId]
  );
  return useSyncExternalStore(messageStore.subscribe, getSnapshot, getSnapshot);
}

/** Reactive hook — total unread count across all conversations. */
export function useTotalUnread(): number {
  return useSyncExternalStore(
    messageStore.subscribe,
    messageStore.getTotalUnread,
    messageStore.getTotalUnread
  );
}
