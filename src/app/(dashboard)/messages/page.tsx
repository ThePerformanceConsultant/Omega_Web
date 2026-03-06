"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Search, Send, MessageCircle, Plus, Megaphone, X, Check } from "lucide-react";
import { useConversations, useMessages, messageStore } from "@/lib/message-store";
import { Conversation } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { fetchClients } from "@/lib/supabase/db";

// ── Helpers ──

function timeAgo(iso: string): string {
  if (!iso) return "";
  const now = new Date();
  const then = new Date(iso);
  const diffMs = now.getTime() - then.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return "Yesterday";
  if (diffDay < 7) return `${diffDay}d ago`;
  return then.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatMessageTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatDateSeparator(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  if (isToday) return "Today";
  if (isYesterday) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function Avatar({ initials, size = 36 }: { initials: string; size?: number }) {
  return (
    <div
      className="rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.35 }}
    >
      {initials}
    </div>
  );
}

// ── Main Page ──

export default function MessagesPage() {
  const conversations = useConversations();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [coachId, setCoachId] = useState<string>("");
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [allClients, setAllClients] = useState<Array<{ id: string; full_name: string; avatar_initials: string }>>([]);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [broadcastSelected, setBroadcastSelected] = useState<Set<string>>(new Set());
  const [broadcastDraft, setBroadcastDraft] = useState("");
  const [broadcastSending, setBroadcastSending] = useState(false);

  // Hydrate from Supabase on mount
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setCoachId(user.id);
        messageStore.hydrate(user.id);
        // Load all clients for "New Message" picker
        fetchClients().then((clients) => {
          setAllClients(
            (clients ?? []).map((c: Record<string, unknown>) => ({
              id: c.id as string,
              full_name: (c.full_name as string) ?? "Unknown",
              avatar_initials: (c.avatar_initials as string) ?? "?",
            }))
          );
        });
      }
    });
  }, []);

  const sorted = useMemo(() => {
    let list = [...conversations].sort(
      (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((c) => c.clientName.toLowerCase().includes(q));
    }
    return list;
  }, [conversations, search]);

  // Clients who don't have a conversation yet
  const availableClients = useMemo(() => {
    const existingClientIds = new Set(conversations.map((c) => c.clientId));
    return allClients.filter((c) => !existingClientIds.has(c.id));
  }, [allClients, conversations]);

  function selectConversation(conv: Conversation) {
    setSelectedId(conv.id);
    setShowNewMessage(false);
    if (conv.unreadCount > 0) {
      messageStore.markAsRead(conv.id);
    }
  }

  async function handleNewConversation(clientId: string) {
    if (!coachId) return;
    const conv = await messageStore.createConversation(coachId, clientId);
    if (conv) {
      setSelectedId(conv.id);
      setShowNewMessage(false);
    }
  }

  function toggleBroadcastClient(clientId: string) {
    setBroadcastSelected((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  }

  function toggleBroadcastAll() {
    if (broadcastSelected.size === allClients.length) {
      setBroadcastSelected(new Set());
    } else {
      setBroadcastSelected(new Set(allClients.map((c) => c.id)));
    }
  }

  async function handleBroadcast() {
    const text = broadcastDraft.trim();
    if (!text || broadcastSelected.size === 0 || !coachId) return;
    setBroadcastSending(true);
    const sent = await messageStore.broadcastMessage(coachId, [...broadcastSelected], text);
    setBroadcastSending(false);
    setBroadcastDraft("");
    setBroadcastSelected(new Set());
    setShowBroadcast(false);
  }

  return (
    <div className="-m-8 flex h-[calc(100vh-64px)]">
      {/* Left: Conversation list */}
      <div className="w-80 shrink-0 border-r border-black/10 flex flex-col bg-white/50">
        {/* Header */}
        <div className="p-4 border-b border-black/10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">
              Messages{" "}
              <span className="text-muted font-normal">({conversations.length})</span>
            </h2>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => { setShowBroadcast(true); setShowNewMessage(false); }}
                className="w-7 h-7 rounded-lg bg-accent/10 text-accent flex items-center justify-center hover:bg-accent/20 transition-colors"
                title="Broadcast message"
              >
                <Megaphone size={13} />
              </button>
              <div className="relative">
                <button
                  onClick={() => { setShowNewMessage(!showNewMessage); setShowBroadcast(false); }}
                  className="w-7 h-7 rounded-lg bg-accent/10 text-accent flex items-center justify-center hover:bg-accent/20 transition-colors"
                  title="New message"
                >
                  <Plus size={14} />
                </button>
                {showNewMessage && availableClients.length > 0 && (
                  <div className="absolute right-0 top-9 w-56 bg-white border border-black/10 rounded-lg shadow-lg z-50 py-1 max-h-60 overflow-y-auto">
                    <p className="px-3 py-1.5 text-[10px] text-muted font-medium uppercase tracking-wider">Start conversation</p>
                    {availableClients.map((client) => (
                      <button
                        key={client.id}
                        onClick={() => handleNewConversation(client.id)}
                        className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-black/5 transition-colors"
                      >
                        <Avatar initials={client.avatar_initials} size={28} />
                        <span className="text-sm text-foreground truncate">{client.full_name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 rounded-lg bg-black/5 border border-black/10 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25"
            />
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {sorted.map((conv) => (
            <button
              key={conv.id}
              onClick={() => selectConversation(conv)}
              className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors border-l-2 ${
                selectedId === conv.id
                  ? "bg-accent/5 border-l-accent"
                  : "border-l-transparent hover:bg-black/[0.02]"
              }`}
            >
              <Avatar initials={conv.clientInitials} size={40} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground truncate">
                    {conv.clientName}
                  </span>
                  {conv.lastMessageAt && (
                    <span className="text-[10px] text-muted shrink-0 ml-2">
                      {timeAgo(conv.lastMessageAt)}
                    </span>
                  )}
                </div>
                {conv.lastMessage && (
                  <p className="text-xs text-muted truncate mt-0.5">
                    {conv.lastMessageSender === "coach" && (
                      <span className="text-accent">You: </span>
                    )}
                    {conv.lastMessage}
                  </p>
                )}
              </div>
              {conv.unreadCount > 0 && (
                <span className="bg-accent text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  {conv.unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Right: Chat window */}
      {selectedId ? (
        <ChatWindow conversationId={selectedId} coachId={coachId} />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-muted">
          <MessageCircle size={48} className="mb-3 opacity-30" />
          <p className="text-sm font-medium">Select a conversation</p>
          <p className="text-xs mt-1">Choose a client from the left to start chatting</p>
        </div>
      )}

      {/* Broadcast modal */}
      {showBroadcast && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowBroadcast(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-black/10">
              <div className="flex items-center gap-2">
                <Megaphone size={16} className="text-accent" />
                <h3 className="text-sm font-semibold text-foreground">Broadcast Message</h3>
              </div>
              <button onClick={() => setShowBroadcast(false)} className="text-muted hover:text-foreground transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Client list */}
            <div className="flex-1 overflow-y-auto px-5 py-3">
              <button
                onClick={toggleBroadcastAll}
                className="w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-black/5 rounded-lg transition-colors mb-1"
              >
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                  broadcastSelected.size === allClients.length ? "bg-accent border-accent" : "border-black/20"
                }`}>
                  {broadcastSelected.size === allClients.length && <Check size={12} className="text-white" />}
                </div>
                <span className="text-sm font-medium text-foreground">Select All</span>
                <span className="text-xs text-muted ml-auto">{allClients.length} clients</span>
              </button>
              <div className="h-px bg-black/10 my-2" />
              {allClients.map((client) => (
                <button
                  key={client.id}
                  onClick={() => toggleBroadcastClient(client.id)}
                  className="w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-black/5 rounded-lg transition-colors"
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                    broadcastSelected.has(client.id) ? "bg-accent border-accent" : "border-black/20"
                  }`}>
                    {broadcastSelected.has(client.id) && <Check size={12} className="text-white" />}
                  </div>
                  <Avatar initials={client.avatar_initials} size={28} />
                  <span className="text-sm text-foreground truncate">{client.full_name}</span>
                </button>
              ))}
            </div>

            {/* Compose + send */}
            <div className="px-5 py-4 border-t border-black/10">
              <textarea
                placeholder="Type your broadcast message..."
                value={broadcastDraft}
                onChange={(e) => setBroadcastDraft(e.target.value)}
                rows={3}
                className="w-full px-4 py-2.5 rounded-xl bg-black/5 border border-black/10 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25 resize-none"
              />
              <button
                onClick={handleBroadcast}
                disabled={!broadcastDraft.trim() || broadcastSelected.size === 0 || broadcastSending}
                className="mt-3 w-full py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Send size={14} />
                {broadcastSending
                  ? "Sending..."
                  : `Send to ${broadcastSelected.size} client${broadcastSelected.size !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Chat Window ──

function ChatWindow({ conversationId, coachId }: { conversationId: string; coachId: string }) {
  const conversations = useConversations();
  const messages = useMessages(conversationId);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const conv = conversations.find((c) => c.id === conversationId);

  // Load messages from Supabase when conversation changes
  useEffect(() => {
    if (coachId) {
      messageStore.loadMessages(conversationId, coachId);
    }
  }, [conversationId, coachId]);

  // Auto-scroll to bottom when messages change or conversation switches
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, conversationId]);

  // Focus input and reset draft when conversation changes
  useEffect(() => {
    textareaRef.current?.focus();
    setDraft("");
  }, [conversationId]);

  // Auto-resize textarea
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, []);

  useEffect(() => {
    autoResize();
  }, [draft, autoResize]);

  function handleSend() {
    const text = draft.trim();
    if (!text || !coachId) return;
    messageStore.sendMessage(conversationId, text, coachId);
    setDraft("");
    textareaRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // Precompute which messages start a new date group
  const dateSepSet = useMemo(() => {
    const set = new Set<string>();
    let prev = "";
    for (const msg of messages) {
      const dateStr = new Date(msg.sentAt).toDateString();
      if (dateStr !== prev) { set.add(msg.id); prev = dateStr; }
    }
    return set;
  }, [messages]);

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Chat header */}
      <div className="px-6 py-3 border-b border-black/10 flex items-center gap-3 bg-white/50 shrink-0">
        <Avatar initials={conv?.clientInitials || "?"} size={36} />
        <div>
          <h3 className="text-sm font-semibold text-foreground">{conv?.clientName}</h3>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-1">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-muted">
            <MessageCircle size={36} className="mb-2 opacity-30" />
            <p className="text-xs">Send a message to start the conversation</p>
          </div>
        )}
        {messages.map((msg) => {
          const showDateSep = dateSepSet.has(msg.id);
          const isCoach = msg.senderRole === "coach";

          return (
            <div key={msg.id}>
              {showDateSep && (
                <div className="flex items-center justify-center my-4">
                  <span className="text-[10px] text-muted bg-black/5 px-3 py-1 rounded-full">
                    {formatDateSeparator(msg.sentAt)}
                  </span>
                </div>
              )}
              <div className={`flex ${isCoach ? "justify-end" : "justify-start"} mb-1`}>
                <div
                  className={`max-w-[70%] px-3.5 py-2 rounded-2xl ${
                    isCoach
                      ? "bg-accent text-white rounded-br-md"
                      : "bg-black/5 text-foreground rounded-bl-md"
                  }`}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  <p
                    className={`text-[10px] mt-1 ${
                      isCoach ? "text-white/60" : "text-muted"
                    }`}
                  >
                    {formatMessageTime(msg.sentAt)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input bar */}
      <div className="px-6 py-3 border-t border-black/10 bg-white/50 shrink-0">
        <div className="flex items-end gap-3">
          <textarea
            ref={textareaRef}
            placeholder="Type a message..."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            className="flex-1 px-4 py-2.5 rounded-2xl bg-black/5 border border-black/10 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25 resize-none overflow-hidden"
          />
          <button
            onClick={handleSend}
            disabled={!draft.trim()}
            className="w-9 h-9 rounded-full bg-accent text-white flex items-center justify-center hover:bg-accent-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
