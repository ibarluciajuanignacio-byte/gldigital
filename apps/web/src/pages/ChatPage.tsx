import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useSearchParams } from "react-router-dom";
import { api, getApiBaseUrl } from "../api/client";
import { useAuth } from "../state/auth";
import { Search, Send, Paperclip } from "lucide-react";

type Conversation = {
  id: string;
  type: "dm" | "group";
  name?: string;
  unreadCount?: number;
  members: Array<{ user: { id: string; name: string } }>;
};

type ChatMessage = {
  id: string;
  senderId?: string;
  kind: "user" | "system";
  body: string;
  createdAt: string;
  sender?: { name: string };
  attachments?: Array<{ id: string }>;
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

export function ChatPage() {
  const { token, user } = useAuth();
  const [searchParams] = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [attachmentKeys, setAttachmentKeys] = useState<string[]>([]);
  const [groupName, setGroupName] = useState("");
  const [groupMembersRaw, setGroupMembersRaw] = useState("");
  const [searchChat, setSearchChat] = useState("");
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

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
    if (newMessages.length > 0) {
      await api.post(`/chat/conversations/${conversationId}/mark-read`, {
        lastReadMessageId: newMessages[newMessages.length - 1].id
      });
    }
  }

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on("chat:message", (message: ChatMessage) => {
      setMessages((prev) => [...prev, message]);
    });
    return () => {
      socket.disconnect();
    };
  }, [socket]);

  useEffect(() => {
    if (!activeConversationId || !socket) return;
    socket.emit("join:conversation", activeConversationId);
    loadMessages(activeConversationId);
    return () => {
      socket.emit("leave:conversation", activeConversationId);
    };
  }, [activeConversationId, socket]);

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

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (!activeConversationId || !text.trim()) return;
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
      <div className="wa-shell">
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
                  onClick={() => setActiveConversationId(conversation.id)}
                >
                  <img className="wa-chat-avatar" src={avatar} alt="" />
                  <div className="wa-chat-content">
                    <div className="wa-chat-row">
                      <span className="wa-chat-name">{title}</span>
                      <span className="wa-chat-time">{timeAgo(new Date().toISOString())}</span>
                      {unread > 0 && (
                        <span className="wa-chat-unread">
                          {unread}
                        </span>
                      )}
                    </div>
                    <div className="wa-chat-preview">
                      {conversation.type === "group" ? "Grupo interno" : "Chat directo"} · GLdigital
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
                <img
                  className="wa-main-avatar"
                  src={activeConversation ? avatarForId(activeConversation.id) : ""}
                  alt=""
                />
                <div className="wa-main-user">
                  <div className="wa-main-name">{activeTitle}</div>
                  <div className="wa-main-status">
                    {activeConversation?.type === "group" ? "Grupo" : "Chat"} <span className="mx-1">•</span> En línea
                  </div>
                </div>
              </header>

              <div className="wa-messages" ref={messagesContainerRef}>
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
                  return (
                    <div
                      key={message.id}
                      className={`wa-message-row ${isMine ? "mine" : "theirs"}`}
                    >
                      <div className={`wa-message-bubble ${isMine ? "mine" : "theirs"}`}>
                      <div>{message.body}</div>
                      {message.attachments?.length ? (
                        <div className="wa-message-meta">Adjuntos: {message.attachments.length}</div>
                      ) : null}
                      <div className="wa-message-meta">{timeAgo(message.createdAt)}</div>
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
                  onChange={(e) => setText(e.target.value)}
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
