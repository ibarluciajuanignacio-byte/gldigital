import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { api, getApiBaseUrl } from "../api/client";

function attachmentViewUrl(objectKey: string): string {
  return `${getApiBaseUrl()}/uploads/view?objectKey=${encodeURIComponent(objectKey)}`;
}
import { useAuth } from "../state/auth";
import { Search, Send, Paperclip, ArrowLeft, CheckCheck } from "lucide-react";

type LastMessage = {
  id: string;
  body: string;
  createdAt: string;
  senderId?: string;
  kind: string;
  attachments?: Array<{ id: string; objectKey?: string }>;
};

type Conversation = {
  id: string;
  type: "dm" | "group";
  name?: string;
  unreadCount?: number;
  members: Array<{ user: { id: string; name: string; lastSeenAt?: string | null } }>;
  messages?: LastMessage[];
};

type ChatMessage = {
  id: string;
  senderId?: string;
  kind: "user" | "system";
  body: string;
  createdAt: string;
  sender?: { name: string };
  attachments?: Array<{ id: string; objectKey?: string }>;
};

function avatarForId(id: string): string {
  let n = 0;
  for (let i = 0; i < id.length; i++) n += id.charCodeAt(i);
  return `/dist/images/fakers/profile-${(n % 15) + 1}.jpg`;
}

function timeAgo(date: string): string {
  const d = new Date(date);
  const now = new Date();
  const mins = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (mins < 1) return "Ahora";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h} h`;
  return d.toLocaleDateString();
}

function lastSeenLabel(lastSeenAt: string | null | undefined): string {
  if (!lastSeenAt) return "Desconectado";
  const d = new Date(lastSeenAt);
  const now = new Date();
  const mins = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (mins < 2) return "En línea";
  if (mins < 60) return `Hace ${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `Hace ${h} h`;
  return `Última vez ${d.toLocaleDateString()}`;
}

export function ChatPage() {
  const { token, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [otherMemberLastReadMessageId, setOtherMemberLastReadMessageId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [attachmentKeys, setAttachmentKeys] = useState<string[]>([]);
  const [groupName, setGroupName] = useState("");
  const [groupMembersRaw, setGroupMembersRaw] = useState("");
  const [searchChat, setSearchChat] = useState("");
  const [mobileShowConversation, setMobileShowConversation] = useState(false);
  const [typingUser, setTypingUser] = useState<{ userId: string; userName: string } | null>(null);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [globalOnlineUserIds, setGlobalOnlineUserIds] = useState<Set<string>>(new Set());
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadMoreScrollRef = useRef<{ height: number; top: number } | null>(null);
  const loadMoreJustDoneRef = useRef(false);

  const socket = useMemo(() => {
    if (!token) return null;
    return io(getApiBaseUrl(), { auth: { token } });
  }, [token]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId),
    [conversations, activeConversationId]
  );

  const activeTitle = activeConversation
    ? activeConversation.type === "group"
      ? activeConversation.name
      : activeConversation.members.find((m) => m.user.id !== user?.id)?.user.name ?? "Chat"
    : "";

  const requestedConversationId = searchParams.get("conversationId") ?? "";

  async function loadConversations() {
    const { data } = await api.get("/chat/conversations");
    setConversations(data.conversations);
    if (requestedConversationId && data.conversations.some((c: Conversation) => c.id === requestedConversationId)) {
      setActiveConversationId(requestedConversationId);
      return;
    }
    if (!activeConversationId && data.conversations[0]?.id) {
      setActiveConversationId(data.conversations[0].id);
    }
  }

  async function loadMessages(conversationId: string) {
    const { data } = await api.get(`/chat/conversations/${conversationId}/messages`);
    const newMessages = data.messages as ChatMessage[];
    setMessages(newMessages);
    setHasMoreMessages(Boolean(data.hasMore));
    setOtherMemberLastReadMessageId(data.otherMemberLastReadMessageId ?? null);
    if (newMessages.length > 0) {
      await api.post(`/chat/conversations/${conversationId}/mark-read`, {
        lastReadMessageId: newMessages[newMessages.length - 1].id
      });
    }
  }

  async function loadMoreMessages(conversationId: string, beforeId: string) {
    const container = messagesContainerRef.current;
    if (container) {
      loadMoreScrollRef.current = { height: container.scrollHeight, top: container.scrollTop };
    }
    setLoadingMore(true);
    try {
      const { data } = await api.get(`/chat/conversations/${conversationId}/messages`, {
        params: { beforeId, limit: 50 }
      });
      const older = (data.messages as ChatMessage[]) ?? [];
      setMessages((prev) => [...older, ...prev]);
      setHasMoreMessages(Boolean(data.hasMore));
      loadMoreJustDoneRef.current = true;
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    const draft = (location.state as { draftMessage?: string } | null)?.draftMessage;
    if (draft) {
      setText(draft);
      navigate(location.pathname + location.search, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, location.search, navigate]);

  function playNotificationSound() {
    try {
      const audio = new Audio("/notification.mp3");
      audio.volume = 0.5;
      audio.play().catch(() => {
        try {
          const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = 880;
          gain.gain.setValueAtTime(0.15, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.2);
        } catch {
          /* ignore */
        }
      });
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    if (!socket) return;
    socket.on("chat:message", (message: ChatMessage) => {
      setMessages((prev) => [...prev, message]);
      if (
        message.senderId !== user?.id &&
        (document.visibilityState === "hidden" || !document.hasFocus())
      ) {
        playNotificationSound();
      }
    });
    socket.on("chat:read", (payload: { userId: string; lastReadMessageId: string }) => {
      if (payload.userId !== user?.id) {
        setOtherMemberLastReadMessageId(payload.lastReadMessageId);
      }
    });
    return () => {
      socket.disconnect();
    };
  }, [socket, user?.id]);

  useEffect(() => {
    if (!socket) return;
    socket.emit("get:presence");
    socket.on("presence:global", (payload: { onlineUserIds?: string[] }) => {
      setGlobalOnlineUserIds(new Set(payload.onlineUserIds ?? []));
    });
    socket.on("chat:user_online", (payload: { userId: string }) => {
      setGlobalOnlineUserIds((prev) => new Set(prev).add(payload.userId));
    });
    socket.on("chat:user_offline", (payload: { userId: string }) => {
      setGlobalOnlineUserIds((prev) => {
        const next = new Set(prev);
        next.delete(payload.userId);
        return next;
      });
    });
    return () => {
      socket.off("presence:global");
      socket.off("chat:user_online");
      socket.off("chat:user_offline");
    };
  }, [socket]);

  useEffect(() => {
    if (!activeConversationId || !socket) return;
    socket.emit("join:conversation", activeConversationId);
    loadMessages(activeConversationId);
    setTypingUser(null);
    socket.on("presence:state", (payload: { onlineUserIds: string[] }) => {
      setOnlineUserIds(new Set(payload.onlineUserIds ?? []));
    });
    socket.on("chat:presence", (payload: { userId: string; online: boolean }) => {
      setOnlineUserIds((prev) => {
        const next = new Set(prev);
        if (payload.online) next.add(payload.userId);
        else next.delete(payload.userId);
        return next;
      });
    });
    return () => {
      socket.emit("leave:conversation", activeConversationId);
      socket.emit("typing:stop", activeConversationId);
      socket.off("presence:state");
      socket.off("chat:presence");
    };
  }, [activeConversationId, socket]);

  useEffect(() => {
    if (!loadMoreJustDoneRef.current || !messagesContainerRef.current || !loadMoreScrollRef.current) return;
    const container = messagesContainerRef.current;
    const { height, top } = loadMoreScrollRef.current;
    container.scrollTop = container.scrollHeight - height + top;
    loadMoreScrollRef.current = null;
    loadMoreJustDoneRef.current = false;
  }, [messages]);

  useEffect(() => {
    if (!socket || !activeConversationId) return;
    socket.on("chat:typing", (payload: { userId: string; userName: string; active: boolean }) => {
      if (payload.userId === user?.id) return;
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (payload.active) {
        setTypingUser({ userId: payload.userId, userName: payload.userName });
        typingTimeoutRef.current = setTimeout(() => setTypingUser(null), 4000);
      } else {
        setTypingUser(null);
      }
    });
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [socket, activeConversationId, user?.id]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [messages, activeConversationId]);

  async function uploadAttachment(file: File) {
    const { data } = await api.post("/uploads/presign", {
      mimeType: file.type,
      folder: "chat"
    });
    await fetch(data.uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type }
    });
    setAttachmentKeys((prev) => [...prev, data.objectKey]);
  }

  function emitTypingStop() {
    if (activeConversationId && socket) socket.emit("typing:stop", activeConversationId);
  }

  function scheduleTypingStart() {
    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    typingDebounceRef.current = setTimeout(() => {
      if (activeConversationId && socket && text.trim()) {
        socket.emit("typing:start", activeConversationId);
      }
      typingDebounceRef.current = null;
    }, 300);
  }

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (!activeConversationId || !text.trim()) return;
    emitTypingStop();
    await api.post("/chat/messages", {
      conversationId: activeConversationId,
      body: text,
      attachmentKeys
    });
    setText("");
    setAttachmentKeys([]);
    await loadConversations();
  }

  async function createGroup(e: FormEvent) {
    e.preventDefault();
    const memberIds = groupMembersRaw
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    if (!groupName || memberIds.length === 0) return;
    await api.post("/chat/conversations", {
      type: "group",
      name: groupName,
      memberIds
    });
    setGroupName("");
    setGroupMembersRaw("");
    await loadConversations();
  }

  const filteredConversations = useMemo(() => {
    if (!searchChat.trim()) return conversations;
    const q = searchChat.toLowerCase();
    return conversations.filter((c) => {
      const title =
        c.type === "group"
          ? c.name ?? ""
          : c.members.find((m) => m.user.id !== user?.id)?.user.name ?? "";
      return title.toLowerCase().includes(q);
    });
  }, [conversations, searchChat, user?.id]);

  return (
    <div>
      <div className="silva-page-header">
        <h2 className="silva-page-title">Chat interno</h2>
        <p className="silva-page-subtitle">Organizado en formato tipo WhatsApp Web.</p>
      </div>
      <div className={`wa-shell ${mobileShowConversation ? "wa-shell--show-conversation" : ""}`}>
        <aside className="wa-sidebar">
          <div className="wa-sidebar-top">
            <h3 className="wa-sidebar-title">Chats</h3>
            <span className="wa-sidebar-meta">{filteredConversations.length}</span>
          </div>

          <div className="wa-search">
            <div className="wa-search-wrap">
              <Search size={16} className="wa-search-icon" />
              <input
                type="text"
                className="wa-search-input"
                placeholder="Buscar conversaciones..."
                value={searchChat}
                onChange={(e) => setSearchChat(e.target.value)}
              />
            </div>
          </div>

          <div className="wa-chat-list">
            {filteredConversations.map((conversation) => {
              const title =
                conversation.type === "group"
                  ? conversation.name ?? "Grupo"
                  : conversation.members.find((m) => m.user.id !== user?.id)?.user.name ?? "DM";
              const isActive = conversation.id === activeConversationId;
              const unread = conversation.unreadCount ?? 0;
              const otherMember = conversation.members.find((m) => m.user.id !== user?.id);
              const avatar = otherMember ? avatarForId(otherMember.user.id) : avatarForId(conversation.id);
              return (
                <button
                  type="button"
                  key={conversation.id}
                  className={`wa-chat-item ${isActive ? "is-active" : ""}`}
                  onClick={() => {
                    setActiveConversationId(conversation.id);
                    setMobileShowConversation(true);
                  }}
                >
                  <div className="wa-chat-avatar-wrap">
                    <img className="wa-chat-avatar" src={avatar} alt="" />
                    {conversation.type !== "group" &&
                      otherMember &&
                      globalOnlineUserIds.has(otherMember.user.id) && (
                        <span className="wa-chat-online-dot" aria-hidden />
                      )}
                  </div>
                  <div className="wa-chat-content">
                    <div className="wa-chat-row">
                      <span className="wa-chat-name">{title}</span>
                      <span className="wa-chat-time">
                        {conversation.messages?.[0]?.createdAt
                          ? timeAgo(conversation.messages[0].createdAt)
                          : ""}
                      </span>
                      {unread > 0 && (
                        <span className="wa-chat-unread">
                          {unread}
                        </span>
                      )}
                    </div>
                    <div className="wa-chat-preview">
                      {conversation.messages?.[0] ? (
                        conversation.messages[0].attachments?.length ? (
                          conversation.messages[0].attachments?.[0]?.objectKey ? (
                            <>
                              <img
                                src={attachmentViewUrl(conversation.messages[0].attachments[0].objectKey)}
                                alt=""
                                className="wa-chat-preview-thumb"
                              />
                              <span>📷 Imagen</span>
                            </>
                          ) : (
                            "📷 Imagen"
                          )
                        ) : (
                          conversation.messages[0].body || "—"
                        )
                      ) : conversation.type === "group" ? (
                        "Grupo interno"
                      ) : (
                        "Chat directo"
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {user?.role === "admin" && (
            <form onSubmit={createGroup} className="wa-group-form">
              <div className="wa-group-title">Nuevo grupo</div>
              <input
                className="wa-group-input"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Nombre del grupo"
              />
              <input
                className="wa-group-input"
                value={groupMembersRaw}
                onChange={(e) => setGroupMembersRaw(e.target.value)}
                placeholder="IDs de usuarios (separados por coma)"
              />
              <button
                type="submit"
                className="wa-group-btn"
              >
                Crear grupo
              </button>
            </form>
          )}
        </aside>

        <section className="wa-main">
          {activeConversationId ? (
            <div className="wa-main-inner">
              <header className="wa-main-header">
                <button
                  type="button"
                  className="wa-main-back"
                  onClick={() => setMobileShowConversation(false)}
                  aria-label="Volver a chats"
                >
                  <ArrowLeft size={22} />
                </button>
                <img
                  className="wa-main-avatar"
                  src={activeConversation ? avatarForId(activeConversation.id) : ""}
                  alt=""
                />
                <div className="wa-main-user">
                  <div className="wa-main-name">{activeTitle}</div>
                  <div className="wa-main-status">
                    {typingUser
                      ? `${typingUser.userName} está escribiendo...`
                      : activeConversation?.type === "group"
                        ? "Grupo"
                        : (() => {
                            const other = activeConversation?.members.find((m) => m.user.id !== user?.id)?.user;
                            const otherId = other?.id;
                            if (otherId && onlineUserIds.has(otherId)) return "En línea";
                            return lastSeenLabel(other?.lastSeenAt);
                          })()}
                  </div>
                </div>
              </header>

              <div
                className="wa-messages"
                ref={messagesContainerRef}
                onScroll={() => {
                  const container = messagesContainerRef.current;
                  if (
                    !container ||
                    !hasMoreMessages ||
                    loadingMore ||
                    !messages[0] ||
                    container.scrollTop > 150
                  )
                    return;
                  loadMoreMessages(activeConversationId, messages[0].id);
                }}
              >
                {messages.map((message) => {
                  const isMine = message.senderId === user?.id;
                  const isSystem = message.kind === "system";
                  if (isSystem) {
                    return (
                      <div key={message.id} className="wa-system-row">
                        <div className="wa-system-pill">
                          {message.body}
                        </div>
                      </div>
                    );
                  }
                  const readIndex =
                    otherMemberLastReadMessageId != null
                      ? messages.findIndex((m) => m.id === otherMemberLastReadMessageId)
                      : -1;
                  const myIndex = messages.findIndex((m) => m.id === message.id);
                  const isRead = isMine && readIndex !== -1 && myIndex <= readIndex;
                  return (
                    <div
                      key={message.id}
                      className={`wa-message-row ${isMine ? "mine" : "theirs"}`}
                    >
                      <div className={`wa-message-bubble ${isMine ? "mine" : "theirs"}`}>
                        {message.attachments?.length
                          ? message.attachments.map((att) =>
                              att.objectKey ? (
                                <a
                                  key={att.id}
                                  href={attachmentViewUrl(att.objectKey)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="wa-message-attachment"
                                >
                                  <img src={attachmentViewUrl(att.objectKey)} alt="Adjunto" loading="lazy" />
                                </a>
                              ) : null
                            )
                          : null}
                        {message.body ? <div>{message.body}</div> : null}
                        <div className="wa-message-meta wa-message-meta-row">
                          <span>{timeAgo(message.createdAt)}</span>
                          {isMine && (
                            <span className="wa-message-ticks" aria-hidden>
                              {isRead ? (
                                <CheckCheck size={16} className="wa-tick-read" />
                              ) : (
                                <CheckCheck size={16} className="wa-tick-delivered" />
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {attachmentKeys.length > 0 && (
                <div className="wa-attachment-banner">
                  {attachmentKeys.length} adjunto(s) listos para enviar.
                </div>
              )}

              <form onSubmit={sendMessage} className="wa-inputbar">
                <label className="wa-icon-btn" aria-label="Adjuntar imagen">
                  <Paperclip size={18} />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && uploadAttachment(e.target.files[0])}
                  />
                </label>
                <textarea
                  rows={1}
                  className="wa-textarea"
                  placeholder="Escribí un mensaje..."
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    scheduleTypingStart();
                  }}
                  onBlur={emitTypingStop}
                />
                <button type="submit" className="wa-send-btn" aria-label="Enviar mensaje">
                  <Send size={16} />
                </button>
              </form>
            </div>
          ) : (
            <div className="wa-empty">
              <p>Elegí una conversación o creá un grupo.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
