import { createFileRoute } from "@tanstack/react-router";
import {
  Archive,
  ArchiveRestore,
  AtSign,
  ArrowLeft,
  Bot,
  Check,
  CheckCheck,
  Copy,
  CornerUpLeft,
  Download,
  FileArchive,
  FileSpreadsheet,
  FileText,
  Forward,
  Image as ImageIcon,
  MessageCircle,
  Mic,
  MoreVertical,
  Paperclip,
  Phone,
  Pin,
  PinOff,
  Search,
  Send,
  ShieldCheck,
  Smile,
  Sparkles,
  Users,
  Video,
  X,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { format, formatDistanceToNow, isSameDay } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_app/messages")({ component: MessagesPage });

type ChatProfile = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  position: string | null;
  department: string | null;
  approval_status?: string | null;
  is_suspended?: boolean | null;
};

type Conversation = {
  id: string;
  employee_id: string;
  pinned_by_admin: boolean;
  archived_by_admin: boolean;
  last_message_at: string;
  created_at: string;
};

type ChatMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  recipient_id: string | null;
  sender_is_admin: boolean;
  body: string | null;
  attachment_name: string | null;
  attachment_path: string | null;
  attachment_type: string | null;
  attachment_size: number | null;
  delivered_at: string | null;
  read_at: string | null;
  created_at: string;
};

type Presence = {
  user_id: string;
  is_online: boolean;
  last_seen_at: string;
  typing_conversation_id: string | null;
  updated_at?: string | null;
};

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [
  "pdf",
  "docx",
  "xlsx",
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "heic",
  "heif",
  "mp4",
  "mov",
  "webm",
  "m4v",
  "zip",
];
const ACCEPTED_ATTACHMENT_TYPES = ".pdf,.docx,.xlsx,.jpg,.jpeg,.png,.gif,.webp,.heic,.heif,.mp4,.mov,.webm,.m4v,.zip";
const QUICK_EMOJIS = ["👍", "✅", "🙏", "🙂", "📌", "📄", "👏", "💡"];

function MessagesPage() {
  const { user, profile, isAdmin } = useAuth();
  const db = supabase as any;
  const [employees, setEmployees] = useState<ChatProfile[]>([]);
  const [adminProfiles, setAdminProfiles] = useState<ChatProfile[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [overviewMessages, setOverviewMessages] = useState<ChatMessage[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [presences, setPresences] = useState<Presence[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [messageSearch, setMessageSearch] = useState("");
  const [dateSearch, setDateSearch] = useState("");
  const [conversationFilter, setConversationFilter] = useState<"recent" | "unread" | "archived" | "pinned" | "all">("recent");
  const [showEmoji, setShowEmoji] = useState(false);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [composerFocused, setComposerFocused] = useState(false);
  const [presenceTick, setPresenceTick] = useState(0);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageScrollerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingAutoScrollRef = useRef(false);

  const activeConversation = useMemo(
    () => conversations.find((item) => item.employee_id === selectedEmployeeId) ?? null,
    [conversations, selectedEmployeeId],
  );
  const selectedEmployee = useMemo(
    () => employees.find((item) => item.user_id === selectedEmployeeId) ?? null,
    [employees, selectedEmployeeId],
  );
  const employeeConversation = !isAdmin && user
    ? conversations.find((item) => item.employee_id === user.id) ?? null
    : null;
  const currentConversation = isAdmin ? activeConversation : employeeConversation;

  const loadOverview = useCallback(async () => {
    if (!user) return;
    const [{ data: conversationRows, error: conversationError }, { data: recentRows }] = await Promise.all([
      db.from("chat_conversations").select("*").order("pinned_by_admin", { ascending: false }).order("last_message_at", { ascending: false }),
      db.from("chat_messages").select("*").order("created_at", { ascending: false }).limit(500),
    ]);
    if (conversationError) {
      console.error(conversationError);
      setLoading(false);
      return;
    }
    setConversations((conversationRows ?? []) as Conversation[]);
    setOverviewMessages((recentRows ?? []) as ChatMessage[]);
    setLoading(false);
  }, [db, user]);

  const loadPeople = useCallback(async () => {
    if (!user) return;
    if (isAdmin) {
      const [{ data: profileRows }, { data: roleRows }] = await Promise.all([
        db.from("profiles").select("user_id, full_name, avatar_url, position, department, approval_status, is_suspended").eq("approval_status", "approved").eq("is_suspended", false).order("full_name"),
        db.from("user_roles").select("user_id, role").in("role", ["super_admin", "admin", "hr_manager"]),
      ]);
      const adminIds = new Set((roleRows ?? []).map((row: any) => row.user_id));
      setEmployees(((profileRows ?? []) as ChatProfile[]).filter((item) => !adminIds.has(item.user_id)));
    } else {
      const [{ data: rows }, { data: roleRows }] = await Promise.all([
        db.from("profiles").select("user_id, full_name, avatar_url, position, department").order("full_name"),
        db.from("user_roles").select("user_id, role").in("role", ["super_admin", "admin", "hr_manager"]),
      ]);
      const adminIds = new Set((roleRows ?? []).map((row: any) => row.user_id));
      setAdminProfiles(((rows ?? []) as ChatProfile[]).filter((item) => adminIds.has(item.user_id)));
    }
  }, [db, isAdmin, user]);

  const ensureEmployeeConversation = useCallback(async () => {
    if (!user || isAdmin) return;
    const { data } = await db.from("chat_conversations").select("*").eq("employee_id", user.id).maybeSingle();
    if (data) return data as Conversation;
    const { data: created, error } = await db.from("chat_conversations").insert({ employee_id: user.id }).select("*").single();
    if (error) {
      const { data: existing } = await db.from("chat_conversations").select("*").eq("employee_id", user.id).single();
      return existing as Conversation;
    }
    return created as Conversation;
  }, [db, isAdmin, user]);

  const loadMessages = useCallback(async (conversationId: string) => {
    const { data, error } = await db.from("chat_messages").select("*").eq("conversation_id", conversationId).order("created_at", { ascending: true }).limit(1000);
    if (error) return toast.error("Unable to load this conversation");
    setMessages((data ?? []) as ChatMessage[]);
    await db.rpc("mark_chat_messages_read", { _conversation_id: conversationId });
    window.dispatchEvent(new Event("messages:changed"));
  }, [db]);

  const loadPresence = useCallback(async () => {
    const { data } = await db.from("chat_presence").select("*");
    setPresences((data ?? []) as Presence[]);
  }, [db]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      await loadPeople();
      if (!isAdmin) await ensureEmployeeConversation();
      if (!cancelled) await Promise.all([loadOverview(), loadPresence()]);
    })();
    return () => { cancelled = true; };
  }, [ensureEmployeeConversation, isAdmin, loadOverview, loadPeople, loadPresence, user]);

  useEffect(() => {
    if (!isAdmin || selectedEmployeeId || employees.length === 0) return;
    const firstConversation = conversations.find((item) => !item.archived_by_admin) ?? conversations[0];
    setSelectedEmployeeId(firstConversation?.employee_id ?? employees[0].user_id);
  }, [conversations, employees, isAdmin, selectedEmployeeId]);

  useEffect(() => {
    if (!currentConversation) {
      setMessages([]);
      return;
    }
    loadMessages(currentConversation.id);
  }, [currentConversation?.id, loadMessages]);

  useEffect(() => {
    if (!user) return;
    const channel = db
      .channel(`chat-page-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, (payload: any) => {
        loadOverview();
        const changed = payload.new?.conversation_id || payload.old?.conversation_id;
        if (changed && changed === currentConversation?.id) loadMessages(changed);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_conversations" }, loadOverview)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_presence" }, loadPresence)
      .subscribe();
    return () => { db.removeChannel(channel); };
  }, [currentConversation?.id, db, loadMessages, loadOverview, loadPresence, user]);

  useEffect(() => {
    if (!user) return;
    const updatePresence = (online: boolean) => db.from("chat_presence").upsert({
      user_id: user.id,
      is_online: online,
      last_seen_at: new Date().toISOString(),
      typing_conversation_id: null,
    });
    updatePresence(true);
    const interval = window.setInterval(() => updatePresence(true), 30_000);
    const onVisibility = () => updatePresence(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      updatePresence(false);
    };
  }, [db, user]);

  useEffect(() => {
    if (!user || !currentConversation) return;
    const timeout = window.setTimeout(() => {
      db.from("chat_presence").upsert({
        user_id: user.id,
        is_online: true,
        last_seen_at: new Date().toISOString(),
        typing_conversation_id: composerFocused && draft.trim() ? currentConversation.id : null,
      });
    }, 450);
    return () => window.clearTimeout(timeout);
  }, [composerFocused, currentConversation?.id, db, draft, user]);

  useEffect(() => {
    const interval = window.setInterval(() => setPresenceTick((value) => value + 1), 2_500);
    return () => window.clearInterval(interval);
  }, []);

  const scrollToLatestMessage = useCallback(() => {
    const scroller = messageScrollerRef.current;
    if (scroller) {
      scroller.scrollTop = scroller.scrollHeight;
      return;
    }
    messagesEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }, []);

  useLayoutEffect(() => {
    if (!messages.length && !pendingAutoScrollRef.current) return;
    scrollToLatestMessage();
    pendingAutoScrollRef.current = false;
  }, [currentConversation?.id, messages.length, scrollToLatestMessage]);

  useEffect(() => {
    const attachmentMessages = messages.filter((item) => item.attachment_path && !signedUrls[item.id]);
    if (!attachmentMessages.length) return;
    Promise.all(attachmentMessages.map(async (item) => {
      const { data } = await db.storage.from("chat-attachments").createSignedUrl(item.attachment_path, 3600);
      return [item.id, data?.signedUrl] as const;
    })).then((rows) => setSignedUrls((current) => ({
      ...current,
      ...Object.fromEntries(rows.filter((row) => row[1])),
    })));
  }, [db.storage, messages, signedUrls]);

  const lastMessageByConversation = useMemo(() => {
    const map = new Map<string, ChatMessage>();
    overviewMessages.forEach((item) => {
      if (!map.has(item.conversation_id)) map.set(item.conversation_id, item);
    });
    return map;
  }, [overviewMessages]);

  const unreadByConversation = useMemo(() => {
    const map = new Map<string, number>();
    overviewMessages.forEach((item) => {
      const incoming = isAdmin ? !item.sender_is_admin : item.sender_is_admin;
      if (incoming && !item.read_at) map.set(item.conversation_id, (map.get(item.conversation_id) ?? 0) + 1);
    });
    return map;
  }, [isAdmin, overviewMessages]);

  const conversationRows = useMemo(() => {
    const needle = employeeSearch.trim().toLowerCase();
    return employees
      .map((employee) => {
        const conversation = conversations.find((item) => item.employee_id === employee.user_id) ?? null;
        const lastMessage = conversation ? lastMessageByConversation.get(conversation.id) ?? null : null;
        return { employee, conversation, lastMessage };
      })
      .filter(({ employee, conversation, lastMessage }) => {
        const unread = conversation ? unreadByConversation.get(conversation.id) ?? 0 : 0;
        if (conversationFilter === "recent" && conversation?.archived_by_admin) return false;
        if (conversationFilter === "unread" && unread === 0) return false;
        if (conversationFilter === "archived" && !conversation?.archived_by_admin) return false;
        if (conversationFilter === "pinned" && !conversation?.pinned_by_admin) return false;
        return !needle || `${employee.full_name} ${employee.department} ${employee.position} ${lastMessage?.body ?? ""} ${lastMessage?.attachment_name ?? ""}`.toLowerCase().includes(needle);
      })
      .sort((a, b) => {
        if (Boolean(a.conversation?.pinned_by_admin) !== Boolean(b.conversation?.pinned_by_admin)) return a.conversation?.pinned_by_admin ? -1 : 1;
        return new Date(b.conversation?.last_message_at ?? 0).getTime() - new Date(a.conversation?.last_message_at ?? 0).getTime();
      });
  }, [conversationFilter, conversations, employeeSearch, employees, lastMessageByConversation, unreadByConversation]);

  const visibleMessages = useMemo(() => {
    const needle = messageSearch.trim().toLowerCase();
    return messages.filter((item) => {
      if (needle && !`${item.body ?? ""} ${item.attachment_name ?? ""}`.toLowerCase().includes(needle)) return false;
      if (dateSearch && format(new Date(item.created_at), "yyyy-MM-dd") !== dateSearch) return false;
      return true;
    });
  }, [dateSearch, messageSearch, messages]);

  const peerPresence = useMemo(() => {
    if (isAdmin) return presences.find((item) => item.user_id === selectedEmployeeId) ?? null;
    const adminIds = new Set(adminProfiles.map((item) => item.user_id));
    return presences.find((item) => adminIds.has(item.user_id) && item.is_online)
      ?? presences.filter((item) => adminIds.has(item.user_id)).sort((a, b) => +new Date(b.last_seen_at) - +new Date(a.last_seen_at))[0]
      ?? null;
  }, [adminProfiles, isAdmin, presences, selectedEmployeeId]);

  const presenceNow = Date.now() + presenceTick * 0;
  const peerTypingIsFresh = peerPresence?.updated_at
    ? presenceNow - new Date(peerPresence.updated_at).getTime() < 7_000
    : peerPresence?.last_seen_at
      ? presenceNow - new Date(peerPresence.last_seen_at).getTime() < 7_000
      : false;
  const peerIsTyping = Boolean(peerPresence?.typing_conversation_id === currentConversation?.id && peerTypingIsFresh);

  async function getOrCreateConversation() {
    if (currentConversation) return currentConversation;
    const employeeId = isAdmin ? selectedEmployeeId : user?.id;
    if (!employeeId) throw new Error("Choose an employee first");
    const { data, error } = await db.from("chat_conversations").insert({ employee_id: employeeId }).select("*").single();
    if (error) {
      const { data: existing, error: existingError } = await db.from("chat_conversations").select("*").eq("employee_id", employeeId).single();
      if (existingError) throw existingError;
      return existing as Conversation;
    }
    setConversations((current) => [data as Conversation, ...current]);
    return data as Conversation;
  }

  async function sendMessage(event?: FormEvent, file?: File) {
    event?.preventDefault();
    if (!user || sending || (!draft.trim() && !file)) return;
    pendingAutoScrollRef.current = true;
    setSending(true);
    try {
      const conversation = await getOrCreateConversation();
      let attachment: Record<string, unknown> = {};
      if (file) {
        const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
        if (!ALLOWED_EXTENSIONS.includes(extension)) throw new Error("This file type is not supported");
        if (file.size > MAX_FILE_SIZE) throw new Error("Attachments must be 50 MB or smaller");
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
        const path = `${conversation.id}/${user.id}/${crypto.randomUUID()}-${safeName}`;
        const attachmentType = getAttachmentContentType(file, extension);
        const { error: uploadError } = await db.storage.from("chat-attachments").upload(path, file, { contentType: attachmentType });
        if (uploadError) throw uploadError;
        attachment = {
          attachment_name: file.name,
          attachment_path: path,
          attachment_type: attachmentType,
          attachment_size: file.size,
        };
      }
      const { error } = await db.from("chat_messages").insert({
        conversation_id: conversation.id,
        sender_id: user.id,
        recipient_id: isAdmin ? selectedEmployeeId : null,
        sender_is_admin: isAdmin,
        body: draft.trim() || null,
        ...attachment,
      });
      if (error) throw error;
      setDraft("");
      setShowEmoji(false);
      await db.from("chat_presence").upsert({
        user_id: user.id,
        is_online: true,
        last_seen_at: new Date().toISOString(),
        typing_conversation_id: null,
      });
      await Promise.all([loadMessages(conversation.id), loadOverview()]);
      window.requestAnimationFrame(() => {
        scrollToLatestMessage();
        textareaRef.current?.focus({ preventScroll: true });
      });
      window.dispatchEvent(new Event("messages:changed"));
    } catch (error: any) {
      toast.error(error?.message || "Message could not be sent");
    } finally {
      setSending(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function setConversationFlag(flag: "pin" | "archive") {
    if (!currentConversation) return;
    const params = {
      _conversation_id: currentConversation.id,
      _pinned: flag === "pin" ? !currentConversation.pinned_by_admin : null,
      _archived: flag === "archive" ? !currentConversation.archived_by_admin : null,
    };
    const { error } = await db.rpc("set_chat_conversation_flags", params);
    if (error) return toast.error(error.message);
    await loadOverview();
    toast.success(flag === "pin" ? "Pin updated" : "Conversation archive updated");
  }

  const totalUnread = [...unreadByConversation.values()].reduce((sum, value) => sum + value, 0);
  const waitingForReply = overviewMessages.filter((item, index, rows) =>
    !item.sender_is_admin && rows.findIndex((other) => other.conversation_id === item.conversation_id) === index,
  ).length;

  return (
    <div className="-mx-4 -my-4 min-h-[calc(100dvh-4rem)] overflow-hidden bg-[#0B1020] text-white shadow-2xl sm:mx-0 sm:my-0 sm:min-h-0 sm:rounded-[30px] sm:border sm:border-white/[0.08] sm:p-4 lg:p-5">
      <div className="hidden gap-3 pb-4 lg:grid lg:grid-cols-3">
        <ChatMetric icon={MessageCircle} label={isAdmin ? "Total conversations" : "Inbox"} value={isAdmin ? conversations.length : "Official"} subtitle={isAdmin ? "+18 today" : "Secure admin channel"} tone="cyan" />
        <ChatMetric icon={Users} label={isAdmin ? "Waiting for reply" : "Channel status"} value={isAdmin ? waitingForReply : "Secure"} subtitle={isAdmin ? "3 urgent" : "Auditable history"} tone="violet" />
        <ChatMetric icon={ShieldCheck} label="Unread messages" value={totalUnread} subtitle={totalUnread ? "High priority" : "All caught up"} tone="pink" />
      </div>

      <div className="flex h-[calc(100dvh-4rem)] overflow-hidden bg-[#0B1020] sm:h-[calc(100dvh-8rem)] sm:rounded-[26px] sm:border sm:border-white/[0.08]">
        <aside className={`${mobileChatOpen ? "hidden" : "flex"} w-full shrink-0 flex-col bg-[#121827] md:flex md:w-[340px] md:border-r md:border-white/[0.08] xl:w-[380px]`}>
          <div className="border-b border-white/[0.08] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-lg font-black"><MessageCircle className="text-cyan-300" size={21} /> Messages</div>
                <p className="mt-1 text-xs text-white/45">{isAdmin ? "Admin–employee workspace" : "Your secure Admin / HR channel"}</p>
              </div>
              {totalUnread > 0 && <span className="rounded-full bg-gradient-to-r from-pink-500 to-violet-500 px-2.5 py-1 text-xs font-black">{totalUnread}</span>}
            </div>
            {isAdmin && (
              <>
                <label className="mt-4 flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-[#182233] px-3 shadow-[inset_0_1px_0_rgba(255,255,255,.04)] transition focus-within:border-cyan-300/45 focus-within:shadow-[0_0_28px_rgba(0,194,255,.12)]">
                  <Search size={16} className="text-white/40" />
                  <input value={employeeSearch} onChange={(event) => setEmployeeSearch(event.target.value)} placeholder="Search employees, departments or messages..." className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-white/30" />
                  {employeeSearch && <button onClick={() => setEmployeeSearch("")} aria-label="Clear search"><X size={15} /></button>}
                </label>
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
                  {(["recent", "unread", "archived", "pinned", "all"] as const).map((filter) => (
                    <button key={filter} onClick={() => setConversationFilter(filter)} className={`rounded-full border px-3 py-1.5 text-xs font-bold capitalize transition active:scale-95 ${conversationFilter === filter ? "border-cyan-300/35 bg-cyan-300/15 text-cyan-100 shadow-[0_0_18px_rgba(0,194,255,.12)]" : "border-white/[0.08] bg-white/[0.04] text-white/45 hover:bg-[#22304A] hover:text-white/75"}`}>
                      {filter}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="flex-1 overflow-y-auto [scrollbar-width:thin]">
            {isAdmin ? (
              conversationRows.length ? conversationRows.map(({ employee, conversation, lastMessage }) => {
                const unread = conversation ? unreadByConversation.get(conversation.id) ?? 0 : 0;
                const online = presences.some((item) => item.user_id === employee.user_id && item.is_online);
                return (
                  <button key={employee.user_id} onClick={() => { setSelectedEmployeeId(employee.user_id); setMobileChatOpen(true); }} className={`group flex w-full gap-3 border-b border-white/[0.06] p-4 text-left transition duration-200 hover:bg-[#22304A]/70 ${selectedEmployeeId === employee.user_id ? "bg-gradient-to-r from-cyan-400/15 via-[#182233] to-transparent shadow-[inset_3px_0_0_rgba(0,194,255,.9)]" : unread > 0 ? "bg-cyan-300/[0.045]" : ""}`}>
                    <Avatar profile={employee} online={online} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <strong className={`truncate text-sm ${unread > 0 ? "text-white" : "text-white/82"}`}>{employee.full_name || "Employee"}</strong>
                        {conversation?.pinned_by_admin && <Pin size={12} className="shrink-0 text-cyan-300" />}
                        <span className="ml-auto shrink-0 text-[10px] text-white/35">{lastMessage ? formatMessageListTime(lastMessage.created_at) : "New"}</span>
                      </div>
                      <div className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-100/35">{employee.department || employee.position || "Team member"}</div>
                      <div className="mt-1 flex items-center gap-2">
                        <p className={`truncate text-xs ${unread > 0 ? "font-semibold text-white/80" : "text-white/45"}`}>{lastMessage?.body || lastMessage?.attachment_name || employee.position || "Start a conversation"}</p>
                        {peerIsTyping && selectedEmployeeId === employee.user_id && <span className="shrink-0 text-[10px] font-bold text-cyan-300">typing…</span>}
                        {unread > 0 && <span className="ml-auto flex h-5 min-w-5 shrink-0 animate-pulse items-center justify-center rounded-full bg-pink-500 px-1 text-[10px] font-black shadow-[0_0_18px_rgba(236,72,153,.35)]">{unread > 99 ? "99+" : unread}</span>}
                      </div>
                    </div>
                  </button>
                );
              }) : <EmptySidebar text={conversationFilter === "archived" ? "No archived conversations" : "No conversations found"} />
            ) : (
              <button onClick={() => setMobileChatOpen(true)} className="group flex w-full gap-3 border-b border-white/[0.06] bg-gradient-to-r from-cyan-400/10 via-[#121827] to-transparent p-4 text-left transition duration-200 hover:bg-[#22304A]/60">
                <Avatar profile={adminProfiles[0]} online={Boolean(peerPresence?.is_online)} admin />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <strong className="truncate text-sm">Aslenix Admin</strong>
                    <span className="rounded-full border border-cyan-300/15 bg-cyan-300/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] text-cyan-100/75">Official</span>
                    <ShieldCheck size={13} className="shrink-0 text-cyan-300" />
                    <span className="ml-auto shrink-0 text-[10px] text-white/35">{overviewMessages[0] ? formatMessageListTime(overviewMessages[0].created_at) : "New"}</span>
                  </div>
                  <p className="mt-1 truncate text-xs text-white/45">{overviewMessages[0]?.body || overviewMessages[0]?.attachment_name || "Official workplace communication"}</p>
                </div>
                {totalUnread > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-pink-500 px-1 text-[10px] font-black shadow-[0_0_18px_rgba(236,72,153,.35)]">{totalUnread}</span>}
              </button>
            )}
          </div>
          <div className="border-t border-white/10 p-3 text-center text-[10px] font-semibold uppercase tracking-[0.15em] text-white/25">Messages are permanent &amp; auditable</div>
        </aside>

        <section className={`${mobileChatOpen ? "flex" : "hidden"} w-full min-w-0 flex-1 flex-col overflow-x-hidden bg-[radial-gradient(circle_at_70%_0%,rgba(0,194,255,.08),transparent_30%),#0B1020] md:flex`}>
          {(isAdmin ? selectedEmployee : user) ? (
            <>
              <header className="flex h-16 shrink-0 items-center gap-2 border-b border-white/[0.08] bg-[#121827]/95 px-2 backdrop-blur-xl sm:h-[76px] sm:gap-3 sm:px-4">
                <button onClick={() => setMobileChatOpen(false)} className="rounded-lg p-2 hover:bg-white/5 md:hidden" aria-label="Back to conversations"><ArrowLeft size={19} /></button>
                <Avatar profile={isAdmin ? selectedEmployee : adminProfiles[0]} online={Boolean(peerPresence?.is_online)} admin={!isAdmin} compact />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><h2 className="truncate text-sm font-black sm:text-base">{isAdmin ? selectedEmployee?.full_name : "Aslenix Admin"}</h2>{!isAdmin && <ShieldCheck size={14} className="text-cyan-300" />}</div>
                  <div className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">{isAdmin ? selectedEmployee?.department || selectedEmployee?.position || "Employee" : "Official workplace channel"}</div>
                  <p className={`truncate text-[11px] ${peerIsTyping ? "text-cyan-300" : "text-white/40"}`}>
                    {peerIsTyping ? "typing…" : peerPresence?.is_online ? "Online" : peerPresence?.last_seen_at ? `Last seen ${formatDistanceToNow(new Date(peerPresence.last_seen_at), { addSuffix: true })}` : (isAdmin ? selectedEmployee?.position : "Official support channel")}
                  </p>
                </div>
                <label className="hidden items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 xl:flex">
                  <Search size={14} className="text-white/35" />
                  <input value={messageSearch} onChange={(event) => setMessageSearch(event.target.value)} placeholder="Search messages" className="h-9 w-32 bg-transparent text-xs outline-none 2xl:w-44" />
                </label>
                <input type="date" value={dateSearch} onChange={(event) => setDateSearch(event.target.value)} className="hidden h-9 rounded-xl border border-white/10 bg-white/5 px-2 text-xs text-white/60 outline-none 2xl:block [color-scheme:dark]" aria-label="Search messages by date" />
                <button className="hidden rounded-xl border border-white/[0.08] bg-white/[0.04] p-2 text-white/45 transition hover:bg-[#22304A] hover:text-cyan-100 lg:inline-flex" aria-label="Voice call"><Phone size={18} /></button>
                <button className="hidden rounded-xl border border-white/[0.08] bg-white/[0.04] p-2 text-white/45 transition hover:bg-[#22304A] hover:text-cyan-100 lg:inline-flex" aria-label="Video call"><Video size={18} /></button>
                {isAdmin && currentConversation && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => setConversationFlag("pin")} title={currentConversation.pinned_by_admin ? "Unpin" : "Pin conversation"} className="rounded-lg p-2 text-white/50 hover:bg-white/5 hover:text-cyan-200">{currentConversation.pinned_by_admin ? <PinOff size={18} /> : <Pin size={18} />}</button>
                    <button onClick={() => setConversationFlag("archive")} title={currentConversation.archived_by_admin ? "Restore" : "Archive conversation"} className="rounded-lg p-2 text-white/50 hover:bg-white/5 hover:text-violet-200">{currentConversation.archived_by_admin ? <ArchiveRestore size={18} /> : <Archive size={18} />}</button>
                  </div>
                )}
                <button className="rounded-lg p-2 text-white/35 hover:bg-white/5" aria-label="Conversation information"><MoreVertical size={18} /></button>
              </header>

              <div className="flex items-center gap-2 border-b border-white/[0.06] px-2 py-2 sm:px-3 xl:hidden">
                <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg bg-white/5 px-3"><Search size={13} className="text-white/35" /><input value={messageSearch} onChange={(event) => setMessageSearch(event.target.value)} placeholder="Search messages" className="h-8 min-w-0 flex-1 bg-transparent text-xs outline-none" /></label>
                <input type="date" value={dateSearch} onChange={(event) => setDateSearch(event.target.value)} className="h-8 w-10 rounded-lg border-0 bg-white/5 px-2 text-transparent outline-none [color-scheme:dark]" aria-label="Search messages by date" />
              </div>

              <div ref={messageScrollerRef} className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-2 py-3 sm:px-5 sm:py-4 [scrollbar-width:thin]">
                <div className="mx-auto w-full min-w-0 max-w-4xl overflow-hidden space-y-1">
                  <div className="mx-auto mb-5 flex max-w-xl items-start gap-3 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.07] px-4 py-3 text-left shadow-[0_18px_45px_rgba(0,194,255,.06)]">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-cyan-300/10 text-cyan-200"><ShieldCheck size={17} /></span>
                    <div>
                      <div className="text-xs font-black text-cyan-50">Secure Internal Conversation</div>
                      <p className="mt-1 text-[11px] leading-5 text-cyan-100/55">Messages are encrypted. Conversation history cannot be edited or deleted.</p>
                    </div>
                  </div>
                  {loading ? <MessageSkeleton /> : visibleMessages.length ? visibleMessages.map((message, index) => {
                    const mine = message.sender_id === user?.id;
                    const previous = visibleMessages[index - 1];
                    const showDate = !previous || !isSameDay(new Date(previous.created_at), new Date(message.created_at));
                    return (
                      <div key={message.id}>
                        {showDate && <DateSeparator date={message.created_at} />}
                        <MessageBubble message={message} mine={mine} signedUrl={signedUrls[message.id]} />
                      </div>
                    );
                  }) : <EmptyMessages isAdmin={isAdmin} onUpload={() => fileInputRef.current?.click()} />}
                  {peerIsTyping && <div className="flex w-fit gap-1 rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.07] px-4 py-3"><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/45" /><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/45 [animation-delay:120ms]" /><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/45 [animation-delay:240ms]" /></div>}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              <form onSubmit={sendMessage} className="relative w-full max-w-full shrink-0 overflow-hidden border-t border-white/[0.08] bg-[#121827]/95 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-18px_50px_rgba(0,0,0,.22)] backdrop-blur-xl sm:p-4">
                <div className="mx-auto w-full min-w-0 max-w-4xl rounded-3xl border border-white/[0.08] bg-[#182233] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,.05),0_18px_55px_rgba(0,0,0,.18)]">
                  <div className="flex w-full min-w-0 items-end gap-1.5 sm:gap-2">
                  <input ref={fileInputRef} type="file" accept={ACCEPTED_ATTACHMENT_TYPES} className="hidden" onChange={(event) => event.target.files?.[0] && sendMessage(undefined, event.target.files[0])} />
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.045] text-white/55 transition hover:border-cyan-300/25 hover:bg-cyan-300/10 hover:text-cyan-100 active:scale-95" aria-label="Attach file"><Paperclip size={21} /></button>
                  <div className="relative flex min-h-11 min-w-0 flex-1 items-end rounded-2xl border border-cyan-300/15 bg-[#0B1020]/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition focus-within:border-cyan-300/45 focus-within:shadow-[0_0_24px_rgba(0,194,255,0.12)]">
                    <textarea ref={textareaRef} value={draft} onFocus={() => setComposerFocused(true)} onBlur={() => { setComposerFocused(false); if (user) db.from("chat_presence").upsert({ user_id: user.id, is_online: true, last_seen_at: new Date().toISOString(), typing_conversation_id: null }); }} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} rows={1} placeholder="Type a secure workplace message..." className="max-h-28 min-h-11 flex-1 resize-none bg-transparent px-3 py-3 text-sm leading-5 outline-none placeholder:text-white/25 sm:px-4" />
                    <button type="button" className="m-1 flex h-8 w-8 items-center justify-center rounded-lg text-white/35 hover:bg-white/5 hover:text-cyan-200" aria-label="Mention teammate"><AtSign size={17} /></button>
                    <button type="button" className="m-1 flex h-8 w-8 items-center justify-center rounded-lg text-white/35 hover:bg-white/5 hover:text-violet-200" aria-label="AI assistant"><Bot size={17} /></button>
                    <button type="button" onClick={() => setShowEmoji((value) => !value)} className="m-1 flex h-8 w-8 items-center justify-center rounded-lg text-white/45 hover:bg-white/5 hover:text-yellow-200" aria-label="Choose emoji"><Smile size={19} /></button>
                    {showEmoji && <div className="absolute bottom-12 right-0 grid grid-cols-4 gap-1 rounded-2xl border border-white/10 bg-[#111525] p-2 shadow-2xl">{QUICK_EMOJIS.map((emoji) => <button type="button" key={emoji} onClick={() => { setDraft((value) => value + emoji); setShowEmoji(false); }} className="rounded-lg p-2 text-lg hover:bg-white/10">{emoji}</button>)}</div>}
                  </div>
                  <button type="button" className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.045] text-white/45 transition hover:bg-[#22304A] hover:text-cyan-100 active:scale-95 sm:flex" aria-label="Voice message"><Mic size={19} /></button>
                  <button type="submit" disabled={sending || !draft.trim()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 via-violet-500 to-cyan-400 text-white shadow-[0_0_24px_rgba(124,58,237,.3)] transition hover:scale-105 hover:shadow-[0_0_32px_rgba(0,194,255,.22)] active:scale-95 disabled:cursor-not-allowed disabled:grayscale disabled:opacity-45" aria-label="Send message"><Send size={19} /></button>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3 px-1 text-[10px] text-white/28">
                    <span className="truncate">Supports PDF, DOCX, XLSX, ZIP, Images · Maximum upload: 50MB</span>
                    <span className="shrink-0 tabular-nums">{draft.length}/2000</span>
                  </div>
                </div>
              </form>
            </>
          ) : <div className="flex flex-1 items-center justify-center text-center"><div><MessageCircle className="mx-auto text-cyan-300/30" size={46} /><h2 className="mt-4 font-black">Select a conversation</h2><p className="mt-1 text-sm text-white/35">Choose an employee to start messaging.</p></div></div>}
        </section>

        <aside className="hidden w-[300px] shrink-0 border-l border-white/[0.08] bg-[#121827] p-4 xl:block">
          <div className="rounded-3xl border border-white/[0.08] bg-[#182233]/80 p-4">
            <div className="flex items-center gap-3">
              <Avatar profile={isAdmin ? selectedEmployee : adminProfiles[0]} online={Boolean(peerPresence?.is_online)} admin={!isAdmin} />
              <div className="min-w-0">
                <div className="truncate text-sm font-black">{isAdmin ? selectedEmployee?.full_name || "Employee" : "Aslenix Admin"}</div>
                <div className="mt-0.5 truncate text-xs text-white/40">{isAdmin ? selectedEmployee?.department || selectedEmployee?.position || "Team member" : "Official support channel"}</div>
              </div>
            </div>
          </div>
          <InfoSection title="Conversation Details" items={["Secure internal channel", "Permanent audit history", currentConversation?.pinned_by_admin ? "Pinned conversation" : "Standard priority"]} />
          <InfoSection title="Shared Files" items={[`${messages.filter((item) => item.attachment_path).length} attachments`, "PDF, Office, Images, ZIP", "Video previews supported"]} />
          <InfoSection title="Pinned Messages" items={["No pinned messages yet", "Use hover actions to review", "Important items stay visible"]} />
          <InfoSection title="Recent Activity" items={[visibleMessages.length ? `${visibleMessages.length} messages loaded` : "No messages yet", totalUnread ? `${totalUnread} unread` : "All caught up", peerPresence?.is_online ? "Member online" : "Member offline"]} />
        </aside>
      </div>
    </div>
  );
}

function Avatar({ profile, online, admin, compact }: { profile?: ChatProfile | null; online?: boolean; admin?: boolean; compact?: boolean }) {
  const size = compact ? "h-10 w-10" : "h-11 w-11";
  return (
    <div className={`relative shrink-0 ${size}`}>
      <div className={`flex h-full w-full items-center justify-center overflow-hidden rounded-2xl border ${admin ? "border-cyan-300/30 bg-gradient-to-br from-cyan-400/25 to-violet-500/25" : "border-white/10 bg-white/5"} text-sm font-black`}>
        {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : admin ? <ShieldCheck size={20} className="text-cyan-200" /> : initials(profile?.full_name)}
      </div>
      <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-[3px] border-[#0b0e1a] ${online ? "bg-emerald-400" : "bg-slate-600"}`} />
    </div>
  );
}

function MessageBubble({ message, mine, signedUrl }: { message: ChatMessage; mine: boolean; signedUrl?: string }) {
  const image = message.attachment_type?.startsWith("image/");
  const video = message.attachment_type?.startsWith("video/");
  const FileIcon = getFileIcon(message.attachment_type);
  return (
    <div className={`group mb-3 flex min-w-0 items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`order-2 flex translate-y-1 gap-1 opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100 ${mine ? "" : "order-1"}`}>
        <button className="rounded-lg bg-[#182233] p-1.5 text-white/35 hover:text-cyan-200" aria-label="Reply"><CornerUpLeft size={13} /></button>
        <button className="rounded-lg bg-[#182233] p-1.5 text-white/35 hover:text-cyan-200" aria-label="Copy"><Copy size={13} /></button>
        <button className="rounded-lg bg-[#182233] p-1.5 text-white/35 hover:text-cyan-200" aria-label="Forward"><Forward size={13} /></button>
      </div>
      <div className={`min-w-0 max-w-[82vw] animate-[fade-in_.18s_ease-out] overflow-hidden rounded-2xl border px-2.5 py-2 text-sm shadow-lg sm:max-w-[72%] sm:px-3.5 sm:py-2.5 ${mine ? "order-1 rounded-br-md border-violet-300/15 bg-gradient-to-br from-violet-600/90 via-fuchsia-600/82 to-pink-600/82 shadow-[0_18px_42px_rgba(168,85,247,0.20)]" : "order-2 rounded-bl-md border-white/[0.08] bg-[#182233] shadow-[0_18px_42px_rgba(0,0,0,0.18)]"}`}>
        {message.attachment_path && (
          image && signedUrl ? (
            <a href={signedUrl} target="_blank" rel="noreferrer" className="mb-2 block max-w-full overflow-hidden rounded-xl border border-white/10 bg-black/20">
              <img src={signedUrl} alt={message.attachment_name || "Attachment"} className="block max-h-[46dvh] w-full max-w-full object-cover" loading="lazy" />
            </a>
          ) : video && signedUrl ? (
            <div className="mb-2 max-w-full overflow-hidden rounded-xl border border-white/10 bg-black/20">
              <video src={signedUrl} controls preload="metadata" playsInline className="block max-h-[46dvh] w-full max-w-full bg-black object-contain" />
              <a href={signedUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 px-3 py-2 text-xs text-white/70 hover:text-white">
                <span className="min-w-0 truncate">{message.attachment_name || "Video attachment"}</span>
                <Download size={14} className="shrink-0" />
              </a>
            </div>
          ) : (
            <a href={signedUrl || "#"} target={signedUrl ? "_blank" : undefined} rel="noreferrer" className="mb-2 flex min-w-0 max-w-full items-center gap-3 rounded-xl border border-white/10 bg-black/15 p-3 hover:bg-black/25">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10"><FileIcon size={20} /></span>
              <span className="min-w-0 flex-1"><strong className="block truncate text-xs">{message.attachment_name}</strong><small className="mt-0.5 block text-[10px] text-white/45">{formatFileSize(message.attachment_size)}</small></span>
              <Download size={15} className="shrink-0 text-white/45" />
            </a>
          )
        )}
        {message.body && <p className="whitespace-pre-wrap break-words leading-5 text-white/90">{message.body}</p>}
        <div className={`mt-1 flex items-center justify-end gap-1 text-[9px] ${mine ? "text-white/60" : "text-white/35"}`}>
          {format(new Date(message.created_at), "h:mm a")}
          {mine && (message.read_at ? <CheckCheck size={13} className="text-cyan-200" /> : message.delivered_at ? <CheckCheck size={13} /> : <Check size={13} />)}
        </div>
      </div>
    </div>
  );
}

function DateSeparator({ date }: { date: string }) {
  const value = new Date(date);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const label = isSameDay(value, today) ? "Today" : isSameDay(value, yesterday) ? "Yesterday" : format(value, "EEEE, MMMM d");
  return <div className="my-6 flex items-center gap-3"><span className="h-px flex-1 bg-white/[0.06]" /><span className="rounded-full border border-white/[0.08] bg-[#182233] px-3 py-1 text-[10px] font-bold text-white/45 shadow-sm">{label}</span><span className="h-px flex-1 bg-white/[0.06]" /></div>;
}

function ChatMetric({ icon: Icon, label, value, subtitle, tone }: { icon: typeof MessageCircle; label: string; value: string | number; subtitle: string; tone: "cyan" | "violet" | "pink" }) {
  const colors = {
    cyan: "from-cyan-400/25 text-cyan-100 border-cyan-300/20",
    violet: "from-violet-400/20 text-violet-100 border-violet-300/20",
    pink: "from-pink-400/20 text-pink-100 border-pink-300/20",
  };
  return (
    <div className={`group rounded-[20px] border bg-gradient-to-br ${colors[tone]} to-[#182233] p-[1px] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_45px_rgba(0,0,0,.22)]`}>
      <div className="flex h-full items-center gap-4 rounded-[19px] bg-[#182233]/90 p-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,.08)] transition group-hover:scale-105">
          <Icon size={21} />
        </span>
        <div className="min-w-0">
          <div className="truncate text-[10px] font-black uppercase tracking-[0.16em] text-white/42">{label}</div>
          <div className="mt-1 text-2xl font-black tracking-tight text-white">{value}</div>
          <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-emerald-200/80"><Sparkles size={12} />{subtitle}</div>
        </div>
      </div>
    </div>
  );
}

function EmptySidebar({ text }: { text: string }) {
  return <div className="px-5 py-16 text-center"><Search className="mx-auto text-white/20" size={28} /><p className="mt-3 text-sm text-white/40">{text}</p></div>;
}

function EmptyMessages({ isAdmin, onUpload }: { isAdmin: boolean; onUpload: () => void }) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center py-16 text-center">
      <div className="relative">
        <div className="absolute inset-0 rounded-[32px] bg-cyan-300/20 blur-2xl" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-[28px] border border-cyan-300/20 bg-[#182233] text-cyan-200 shadow-[0_20px_70px_rgba(0,194,255,.12)]">
          <MessageCircle size={36} />
        </div>
      </div>
      <h3 className="mt-5 text-xl font-black tracking-tight">{isAdmin ? "Start a conversation" : "Start the conversation"}</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-white/42">
        {isAdmin ? "Send a secure message, document, or update to this employee." : "Send a secure workplace message to the official admin channel."}
      </p>
      <div className="mt-6 grid w-full max-w-md grid-cols-1 gap-2 sm:grid-cols-3">
        <button onClick={onUpload} className="rounded-2xl border border-white/[0.08] bg-white/[0.045] px-3 py-3 text-xs font-bold text-white/70 transition hover:bg-[#22304A] hover:text-white active:scale-95">Upload File</button>
        <button className="rounded-2xl border border-white/[0.08] bg-white/[0.045] px-3 py-3 text-xs font-bold text-white/70 transition hover:bg-[#22304A] hover:text-white active:scale-95">Send Announcement</button>
        <button className="rounded-2xl border border-white/[0.08] bg-white/[0.045] px-3 py-3 text-xs font-bold text-white/70 transition hover:bg-[#22304A] hover:text-white active:scale-95">Choose Template</button>
      </div>
    </div>
  );
}

function InfoSection({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="mt-4 rounded-3xl border border-white/[0.08] bg-[#182233]/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-black uppercase tracking-[0.14em] text-white/45">{title}</h3>
        <span className="h-2 w-2 rounded-full bg-cyan-300/70" />
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item} className="rounded-2xl bg-white/[0.035] px-3 py-2 text-xs text-white/55">
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}

function MessageSkeleton() {
  return <div className="space-y-3 py-8"><div className="h-16 w-2/3 animate-pulse rounded-2xl bg-white/5" /><div className="ml-auto h-20 w-3/5 animate-pulse rounded-2xl bg-violet-400/10" /><div className="h-14 w-1/2 animate-pulse rounded-2xl bg-white/5" /></div>;
}

function initials(name?: string | null) {
  return (name || "E").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function formatMessageListTime(value: string) {
  const date = new Date(value);
  const now = new Date();
  if (isSameDay(date, now)) return format(date, "h:mm a");
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) return "Yesterday";
  return format(date, "MMM d");
}

function formatFileSize(size: number | null) {
  if (!size) return "File attachment";
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function getAttachmentContentType(file: File, extension: string) {
  if (file.type) return file.type;
  const map: Record<string, string> = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    zip: "application/zip",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    heic: "image/heic",
    heif: "image/heif",
    mp4: "video/mp4",
    mov: "video/quicktime",
    webm: "video/webm",
    m4v: "video/x-m4v",
  };
  return map[extension] || "application/octet-stream";
}

function getFileIcon(type: string | null) {
  if (type?.includes("spreadsheet")) return FileSpreadsheet;
  if (type?.includes("zip")) return FileArchive;
  if (type?.startsWith("image/")) return ImageIcon;
  if (type?.startsWith("video/")) return Video;
  return FileText;
}
