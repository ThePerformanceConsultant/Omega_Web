"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Send, MessageCircle, ImagePlus } from "lucide-react";
import { useConversations, useMessages, messageStore } from "@/lib/message-store";
import { createClient } from "@/lib/supabase/client";
import { uploadMessageImage } from "@/lib/supabase/db";
import { EmojiPicker } from "@/components/ui/emoji-picker";

function formatMessageTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatDateSeparator(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

export function ChatPanel({ clientId }: { clientId: string }) {
  const conversations = useConversations();
  const conv = conversations.find((c) => c.clientId === clientId);
  const messages = useMessages(conv?.id || "");
  const [draft, setDraft] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [coachId, setCoachId] = useState("");
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setCoachId(user.id);
        messageStore.hydrate(user.id);
      }
    });
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  useEffect(() => {
    if (conv && conv.unreadCount > 0) {
      messageStore.markAsRead(conv.id);
    }
    if (conv && coachId) {
      messageStore.loadMessages(conv.id, coachId);
    }
  }, [conv, coachId]);

  // Precompute which messages start a new date group (must be before early return)
  const dateSepSet = useMemo(() => {
    const set = new Set<string>();
    let prev = "";
    for (const msg of messages) {
      const dateStr = new Date(msg.sentAt).toDateString();
      if (dateStr !== prev) { set.add(msg.id); prev = dateStr; }
    }
    return set;
  }, [messages]);

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

  function clearAttachment() {
    if (attachmentPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(attachmentPreview);
    }
    setAttachmentFile(null);
    setAttachmentPreview(null);
  }

  function handleAttachmentChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setSendError("Please select an image file.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setSendError("Image must be 8 MB or smaller.");
      return;
    }
    clearAttachment();
    setAttachmentFile(file);
    setAttachmentPreview(URL.createObjectURL(file));
    setSendError(null);
  }

  useEffect(() => {
    return () => {
      if (attachmentPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(attachmentPreview);
      }
    };
  }, [attachmentPreview]);

  async function handleSend() {
    const text = draft.trim();
    if ((!text && !attachmentFile) || !coachId || sending) return;

    setSending(true);
    setSendError(null);
    let activeConversationId = conv?.id ?? "";

    try {
      if (!activeConversationId) {
        setCreating(true);
        const newConv = await messageStore.createConversation(coachId, clientId);
        setCreating(false);
        if (!newConv) {
          setSending(false);
          return;
        }
        activeConversationId = newConv.id;
      }

      let uploadedPath: string | null = null;
      let uploadedUrl: string | null = null;
      if (attachmentFile) {
        const uploaded = await uploadMessageImage({
          conversationId: activeConversationId,
          senderId: coachId,
          file: attachmentFile,
        });
        uploadedPath = uploaded.path;
        uploadedUrl = uploaded.signedUrl;
      }

      await messageStore.sendMessage(
        activeConversationId,
        { content: text, imagePath: uploadedPath, imageUrl: uploadedUrl },
        coachId
      );

      setDraft("");
      clearAttachment();
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "Failed to send message.");
    } finally {
      setSending(false);
      setCreating(false);
    }
  }

  function handleEmojiInsert(emoji: string) {
    setDraft((prev) => `${prev}${emoji}`);
    textareaRef.current?.focus();
  }

  return (
    <div className="flex flex-col h-full -mx-4 -mb-4">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-muted">
            <MessageCircle size={36} className="mb-2 opacity-30" />
            <p className="text-xs">{conv ? "Send a message to start the conversation" : "Type a message to start chatting"}</p>
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
                  className={`max-w-[80%] px-3.5 py-2 rounded-2xl ${
                    isCoach
                      ? "bg-accent text-white rounded-br-md"
                      : "bg-black/5 text-foreground rounded-bl-md"
                  }`}
                >
                  {msg.imageUrl ? (
                    <a href={msg.imageUrl} target="_blank" rel="noopener noreferrer" className="block">
                      <img
                        src={msg.imageUrl}
                        alt="Message attachment"
                        className="rounded-xl mb-2 max-h-64 w-auto object-cover border border-black/10"
                      />
                    </a>
                  ) : msg.imagePath ? (
                    <p className={`text-xs mb-2 ${isCoach ? "text-white/80" : "text-muted"}`}>Image unavailable</p>
                  ) : null}
                  {msg.content.trim() ? (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  ) : null}
                  <p className={`text-[10px] mt-1 ${isCoach ? "text-white/60" : "text-muted"}`}>
                    {formatMessageTime(msg.sentAt)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input — always visible even when no conversation exists */}
      <div className="px-5 py-3 border-t border-black/10 bg-white/50 shrink-0">
        {attachmentPreview && (
          <div className="mb-3 flex items-start gap-2">
            <img
              src={attachmentPreview}
              alt="Attachment preview"
              className="h-20 w-20 rounded-xl object-cover border border-black/10"
            />
            <button
              onClick={clearAttachment}
              className="px-2 py-1 rounded-lg text-xs border border-black/15 text-muted hover:text-foreground"
            >
              Remove image
            </button>
          </div>
        )}
        {sendError && <p className="mb-2 text-xs text-danger">{sendError}</p>}
        <div className="flex items-end gap-3">
          <EmojiPicker onSelect={handleEmojiInsert} disabled={creating || sending} />
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            onChange={handleAttachmentChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            className="w-9 h-9 rounded-full bg-black/5 text-muted flex items-center justify-center hover:text-foreground transition-colors shrink-0"
            title="Attach image"
          >
            <ImagePlus size={16} />
          </button>
          <textarea
            ref={textareaRef}
            placeholder="Type a message..."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            rows={1}
            className="flex-1 px-4 py-2.5 rounded-2xl bg-black/5 border border-black/10 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25 resize-none overflow-hidden"
          />
          <button
            onClick={() => void handleSend()}
            disabled={creating || sending || (!draft.trim() && !attachmentFile)}
            className="w-9 h-9 rounded-full bg-accent text-white flex items-center justify-center hover:bg-accent-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
