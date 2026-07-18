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
import {
  FormEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  role?: string | null;
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
  reactions?: Record<string, string[]> | null;
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
const ACCEPTED_ATTACHMENT_TYPES =
  ".pdf,.docx,.xlsx,.jpg,.jpeg,.png,.gif,.webp,.heic,.heif,.mp4,.mov,.webm,.m4v,.zip";
const QUICK_EMOJIS = ["👍", "✅", "🙏", "🙂", "📌", "📄", "👏", "💡"];
const QUICK_TEMPLATES = [
  {
    label: "Thanks",
    text: "Thanks for the update. I will review this and get back to you shortly.",
  },
  { label: "Need Details", text: "Could you share a few more details so I can help you properly?" },
  {
    label: "Resolved",
    text: "This has been resolved. Please let me know if anything else comes up.",
  },
  {
    label: "Follow Up",
    text: "Following up on this conversation. Is there any update from your side?",
  },
];

function MessagesPage() {
  const { user, profile, isAdmin } = useAuth();
  const db = supabase as any;

  const isChatAdmin = useMemo(() => {
    if (isAdmin) return true;
    if (!profile) return false;
    const pos = (profile.position || "").toLowerCase();
    const dept = (profile.department || "").toLowerCase();
    return (
      pos.includes("hr") ||
      pos.includes("human resources") ||
      dept.includes("hr") ||
      dept.includes("human resources")
    );
  }, [isAdmin, profile]);

  const [employees, setEmployees] = useState<ChatProfile[]>([]);
  const [adminProfiles, setAdminProfiles] = useState<ChatProfile[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [overviewMessages, setOverviewMessages] = useState<ChatMessage[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [presences, setPresences] = useState<Presence[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [selectedOfficialId, setSelectedOfficialId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [messageSearch, setMessageSearch] = useState("");
  const [dateSearch, setDateSearch] = useState("");
  const [conversationFilter, setConversationFilter] = useState<
    "recent" | "unread" | "needs_reply" | "archived" | "pinned" | "all"
  >("recent");
  const [showEmoji, setShowEmoji] = useState(false);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [composerFocused, setComposerFocused] = useState(false);
  const [presenceTick, setPresenceTick] = useState(0);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [messageLimit, setMessageLimit] = useState(50);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageScrollerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingAutoScrollRef = useRef(false);
  const previousScrollHeightRef = useRef<number | null>(null);
  const lastMessageIdRef = useRef<string | null>(null);
  const firstMessageIdRef = useRef<string | null>(null);

  const activeConversation = useMemo(
    () => conversations.find((item) => item.employee_id === selectedEmployeeId) ?? null,
    [conversations, selectedEmployeeId],
  );
  const selectedEmployee = useMemo(
    () => employees.find((item) => item.user_id === selectedEmployeeId) ?? null,
    [employees, selectedEmployeeId],
  );
  const selectedOfficial = useMemo(
    () =>
      adminProfiles.find((item) => item.user_id === selectedOfficialId) ?? adminProfiles[0] ?? null,
    [adminProfiles, selectedOfficialId],
  );
  const employeeConversation =
    !isChatAdmin && user
      ? (conversations.find((item) => item.employee_id === user.id) ?? null)
      : null;
  const currentConversation = isChatAdmin ? activeConversation : employeeConversation;

  const loadOverview = useCallback(async () => {
    if (!user) return;
    const [{ data: conversationRows, error: conversationError }, { data: recentRows }] =
      await Promise.all([
        db
          .from("chat_conversations")
          .select("*")
          .order("pinned_by_admin", { ascending: false })
          .order("last_message_at", { ascending: false }),
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
    if (isChatAdmin) {
      const [{ data: profileRows }, { data: roleRows }] = await Promise.all([
        db
          .from("profiles")
          .select(
            "user_id, full_name, avatar_url, position, department, approval_status, is_suspended",
          )
          .eq("approval_status", "approved")
          .eq("is_suspended", false)
          .order("full_name"),
        db
          .from("user_roles")
          .select("user_id, role")
          .in("role", ["super_admin", "admin", "hr_manager"]),
      ]);
      const adminIds = new Set((roleRows ?? []).map((row: any) => row.user_id));
      setEmployees(
        ((profileRows ?? []) as ChatProfile[]).filter((item) => {
          if (adminIds.has(item.user_id)) return false;
          const pos = (item.position || "").toLowerCase();
          const dept = (item.department || "").toLowerCase();
          return !(
            pos.includes("hr") ||
            pos.includes("human resources") ||
            dept.includes("hr") ||
            dept.includes("human resources")
          );
        }),
      );
    } else {
      const [{ data: rows }, { data: roleRows }] = await Promise.all([
        db
          .from("profiles")
          .select("user_id, full_name, avatar_url, position, department")
          .order("full_name"),
        db
          .from("user_roles")
          .select("user_id, role")
          .in("role", ["super_admin", "admin", "hr_manager"]),
      ]);
      const roleByUser = new Map((roleRows ?? []).map((row: any) => [row.user_id, row.role]));
      const adminIds = new Set((roleRows ?? []).map((row: any) => row.user_id));
      setAdminProfiles(
        ((rows ?? []) as ChatProfile[])
          .filter((item) => {
            if (adminIds.has(item.user_id)) return true;
            const pos = (item.position || "").toLowerCase();
            const dept = (item.department || "").toLowerCase();
            return (
              pos.includes("hr") ||
              pos.includes("human resources") ||
              dept.includes("hr") ||
              dept.includes("human resources")
            );
          })
          .map((item) => {
            const isHr =
              (item.position || "").toLowerCase().includes("hr") ||
              (item.department || "").toLowerCase().includes("hr");
            return {
              ...item,
              role: roleByUser.get(item.user_id) ?? (isHr ? "hr_manager" : null),
            };
          })
          .sort(sortOfficials),
      );
    }
  }, [db, isChatAdmin, user]);

  const ensureEmployeeConversation = useCallback(async () => {
    if (!user || isChatAdmin) return;
    const { data } = await db
      .from("chat_conversations")
      .select("*")
      .eq("employee_id", user.id)
      .maybeSingle();
    if (data) return data as Conversation;
    const { data: created, error } = await db
      .from("chat_conversations")
      .insert({ employee_id: user.id })
      .select("*")
      .single();
    if (error) {
      const { data: existing } = await db
        .from("chat_conversations")
        .select("*")
        .eq("employee_id", user.id)
        .single();
      return existing as Conversation;
    }
    return created as Conversation;
  }, [db, isChatAdmin, user]);

  const loadMessages = useCallback(
    async (conversationId: string, limit: number) => {
      if (messageScrollerRef.current) {
        previousScrollHeightRef.current = messageScrollerRef.current.scrollHeight;
      }
      const { data, error } = await db
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) return toast.error("Unable to load this conversation");
      const sorted = (data ?? []).reverse();
      setMessages(sorted as ChatMessage[]);
      await db.rpc("mark_chat_messages_read", { _conversation_id: conversationId });
      window.dispatchEvent(new Event("messages:changed"));
    },
    [db],
  );

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
      if (!isChatAdmin) await ensureEmployeeConversation();
      if (!cancelled) await Promise.all([loadOverview(), loadPresence()]);
    })();
    return () => {
      cancelled = true;
    };
  }, [ensureEmployeeConversation, isChatAdmin, loadOverview, loadPeople, loadPresence, user]);

  useEffect(() => {
    if (!isChatAdmin || selectedEmployeeId || employees.length === 0) return;
    const firstConversation =
      conversations.find((item) => !item.archived_by_admin) ?? conversations[0];
    setSelectedEmployeeId(firstConversation?.employee_id ?? employees[0].user_id);
  }, [conversations, employees, isChatAdmin, selectedEmployeeId]);

  useEffect(() => {
    if (isChatAdmin || selectedOfficialId || adminProfiles.length === 0) return;
    setSelectedOfficialId(adminProfiles[0].user_id);
  }, [adminProfiles, isChatAdmin, selectedOfficialId]);

  useEffect(() => {
    setMessageLimit(50);
    setReplyingTo(null);
  }, [currentConversation?.id]);

  useEffect(() => {
    if (!currentConversation) {
      setMessages([]);
      return;
    }
    loadMessages(currentConversation.id, messageLimit);
  }, [currentConversation?.id, messageLimit, loadMessages]);

  useEffect(() => {
    setShowInfoPanel(false);
  }, [currentConversation?.id]);

  useEffect(() => {
    if (!user) return;
    const channel = db
      .channel(`chat-page-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_messages" },
        (payload: any) => {
          loadOverview();
          const changed = payload.new?.conversation_id || payload.old?.conversation_id;
          if (changed && changed === currentConversation?.id) loadMessages(changed, messageLimit);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_conversations" },
        loadOverview,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_presence" },
        loadPresence,
      )
      .subscribe();
    return () => {
      db.removeChannel(channel);
    };
  }, [currentConversation?.id, db, loadMessages, loadOverview, loadPresence, user, messageLimit]);

  useEffect(() => {
    if (!user) return;
    const updatePresence = (online: boolean) =>
      db.from("chat_presence").upsert({
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
    const scroller = messageScrollerRef.current;
    if (!scroller || !messages.length) return;

    const currentFirstId = messages[0]?.id;
    const currentLastId = messages[messages.length - 1]?.id;

    if (
      firstMessageIdRef.current &&
      currentFirstId !== firstMessageIdRef.current &&
      currentLastId === lastMessageIdRef.current
    ) {
      if (previousScrollHeightRef.current !== null) {
        scroller.scrollTop = scroller.scrollHeight - previousScrollHeightRef.current;
      }
    } else {
      scrollToLatestMessage();
    }

    firstMessageIdRef.current = currentFirstId;
    lastMessageIdRef.current = currentLastId;
    pendingAutoScrollRef.current = false;
  }, [messages, scrollToLatestMessage]);

  useEffect(() => {
    const attachmentMessages = messages.filter(
      (item) => item.attachment_path && !signedUrls[item.id],
    );
    if (!attachmentMessages.length) return;
    Promise.all(
      attachmentMessages.map(async (item) => {
        const { data } = await db.storage
          .from("chat-attachments")
          .createSignedUrl(item.attachment_path, 3600);
        return [item.id, data?.signedUrl] as const;
      }),
    ).then((rows) =>
      setSignedUrls((current) => ({
        ...current,
        ...Object.fromEntries(rows.filter((row) => row[1])),
      })),
    );
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
      const incoming = isChatAdmin ? !item.sender_is_admin : item.sender_is_admin;
      if (incoming && !item.read_at)
        map.set(item.conversation_id, (map.get(item.conversation_id) ?? 0) + 1);
    });
    return map;
  }, [isChatAdmin, overviewMessages]);

  const officialRows = useMemo(() => {
    if (isChatAdmin) return [];
    const fallbackOfficialId = adminProfiles[0]?.user_id;
    return adminProfiles.map((official) => {
      const officialMessages = overviewMessages.filter((item) =>
        item.sender_is_admin
          ? item.sender_id === official.user_id
          : item.recipient_id === official.user_id ||
            (!item.recipient_id && official.user_id === fallbackOfficialId),
      );
      const lastMessage = officialMessages[0] ?? null;
      const unread = overviewMessages.filter(
        (item) => item.sender_is_admin && item.sender_id === official.user_id && !item.read_at,
      ).length;
      const online = presences.some((item) => item.user_id === official.user_id && item.is_online);
      return { official, lastMessage, unread, online };
    });
  }, [adminProfiles, isChatAdmin, overviewMessages, presences]);

  const conversationRows = useMemo(() => {
    const needle = employeeSearch.trim().toLowerCase();
    return employees
      .map((employee) => {
        const conversation =
          conversations.find((item) => item.employee_id === employee.user_id) ?? null;
        const lastMessage = conversation
          ? (lastMessageByConversation.get(conversation.id) ?? null)
          : null;
        return { employee, conversation, lastMessage };
      })
      .filter(({ employee, conversation, lastMessage }) => {
        const unread = conversation ? (unreadByConversation.get(conversation.id) ?? 0) : 0;
        const needsReply = Boolean(conversation && lastMessage && !lastMessage.sender_is_admin);
        if (conversationFilter === "recent" && conversation?.archived_by_admin) return false;
        if (conversationFilter === "unread" && unread === 0) return false;
        if (conversationFilter === "needs_reply" && !needsReply) return false;
        if (conversationFilter === "archived" && !conversation?.archived_by_admin) return false;
        if (conversationFilter === "pinned" && !conversation?.pinned_by_admin) return false;
        return (
          !needle ||
          `${employee.full_name} ${employee.department} ${employee.position} ${lastMessage?.body ?? ""} ${lastMessage?.attachment_name ?? ""}`
            .toLowerCase()
            .includes(needle)
        );
      })
      .sort((a, b) => {
        if (Boolean(a.conversation?.pinned_by_admin) !== Boolean(b.conversation?.pinned_by_admin))
          return a.conversation?.pinned_by_admin ? -1 : 1;
        return (
          new Date(b.conversation?.last_message_at ?? 0).getTime() -
          new Date(a.conversation?.last_message_at ?? 0).getTime()
        );
      });
  }, [
    conversationFilter,
    conversations,
    employeeSearch,
    employees,
    lastMessageByConversation,
    unreadByConversation,
  ]);

  const visibleMessages = useMemo(() => {
    const needle = messageSearch.trim().toLowerCase();
    const fallbackOfficialId = adminProfiles[0]?.user_id;
    return messages.filter((item) => {
      if (!isChatAdmin && selectedOfficial?.user_id) {
        const belongsToSelectedOfficial = item.sender_is_admin
          ? item.sender_id === selectedOfficial.user_id
          : item.recipient_id === selectedOfficial.user_id ||
            (!item.recipient_id && selectedOfficial.user_id === fallbackOfficialId);
        if (!belongsToSelectedOfficial) return false;
      }
      if (
        needle &&
        !`${item.body ?? ""} ${item.attachment_name ?? ""}`.toLowerCase().includes(needle)
      )
        return false;
      if (dateSearch && format(new Date(item.created_at), "yyyy-MM-dd") !== dateSearch)
        return false;
      return true;
    });
  }, [adminProfiles, dateSearch, isChatAdmin, messageSearch, messages, selectedOfficial?.user_id]);

  const peerPresence = useMemo(() => {
    if (isChatAdmin) return presences.find((item) => item.user_id === selectedEmployeeId) ?? null;
    return presences.find((item) => item.user_id === selectedOfficial?.user_id) ?? null;
  }, [isChatAdmin, presences, selectedEmployeeId, selectedOfficial?.user_id]);

  const presenceNow = Date.now() + presenceTick * 0;
  const peerTypingIsFresh = peerPresence?.updated_at
    ? presenceNow - new Date(peerPresence.updated_at).getTime() < 7_000
    : peerPresence?.last_seen_at
      ? presenceNow - new Date(peerPresence.last_seen_at).getTime() < 7_000
      : false;
  const peerIsTyping = Boolean(
    peerPresence?.typing_conversation_id === currentConversation?.id && peerTypingIsFresh,
  );

  async function getOrCreateConversation() {
    if (currentConversation) return currentConversation;
    const employeeId = isChatAdmin ? selectedEmployeeId : user?.id;
    if (!employeeId) throw new Error("Choose an employee first");
    const { data, error } = await db
      .from("chat_conversations")
      .insert({ employee_id: employeeId })
      .select("*")
      .single();
    if (error) {
      const { data: existing, error: existingError } = await db
        .from("chat_conversations")
        .select("*")
        .eq("employee_id", employeeId)
        .single();
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
        if (!ALLOWED_EXTENSIONS.includes(extension))
          throw new Error("This file type is not supported");
        if (file.size > MAX_FILE_SIZE) throw new Error("Attachments must be 50 MB or smaller");
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
        const path = `${conversation.id}/${user.id}/${crypto.randomUUID()}-${safeName}`;
        const attachmentType = getAttachmentContentType(file, extension);
        const { error: uploadError } = await db.storage
          .from("chat-attachments")
          .upload(path, file, { contentType: attachmentType });
        if (uploadError) throw uploadError;
        attachment = {
          attachment_name: file.name,
          attachment_path: path,
          attachment_type: attachmentType,
          attachment_size: file.size,
        };
      }
      let messageBody = draft.trim();
      if (replyingTo) {
        const replyUser = replyingTo.sender_is_admin ? "Admin" : "Teammate";
        const cleanBody = replyingTo.body ? replyingTo.body.replace(/\n/g, " ") : "Attachment";
        const truncated = cleanBody.length > 50 ? `${cleanBody.substring(0, 50)}...` : cleanBody;
        messageBody = `> [${replyUser}]: ${truncated}\n\n${messageBody}`;
      }

      const { error } = await db.from("chat_messages").insert({
        conversation_id: conversation.id,
        sender_id: user.id,
        recipient_id: isChatAdmin ? selectedEmployeeId : (selectedOfficial?.user_id ?? null),
        sender_is_admin: isChatAdmin,
        body: messageBody || null,
        ...attachment,
      });
      if (error) throw error;
      setDraft("");
      setShowEmoji(false);
      setReplyingTo(null);
      await db.from("chat_presence").upsert({
        user_id: user.id,
        is_online: true,
        last_seen_at: new Date().toISOString(),
        typing_conversation_id: null,
      });
      await Promise.all([loadMessages(conversation.id, messageLimit), loadOverview()]);
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

  async function toggleReaction(message: ChatMessage, emoji: string) {
    if (!user) return;
    const current = (message.reactions || {}) as Record<string, string[]>;
    const uids = current[emoji] || [];
    const exists = uids.includes(user.id);
    const updatedUids = exists ? uids.filter((id) => id !== user.id) : [...uids, user.id];

    const updated = {
      ...current,
      [emoji]: updatedUids,
    };

    if (updatedUids.length === 0) {
      delete updated[emoji];
    }

    const { error } = await db
      .from("chat_messages")
      .update({ reactions: updated })
      .eq("id", message.id);

    if (error) {
      console.error("Failed to update reaction:", error);
      toast.error("Reaction could not be saved");
    } else {
      setMessages((prev) =>
        prev.map((msg) => (msg.id === message.id ? { ...msg, reactions: updated } : msg)),
      );
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
  const waitingForReply = conversations.filter((conversation) => {
    const lastMessage = lastMessageByConversation.get(conversation.id);
    return !conversation.archived_by_admin && lastMessage && !lastMessage.sender_is_admin;
  }).length;
  const todayMessages = overviewMessages.filter((item) =>
    isSameDay(new Date(item.created_at), new Date()),
  ).length;
  const activeSharedFiles = messages.filter((item) => item.attachment_path);
  const activeLastMessage = messages[messages.length - 1] ?? null;
  const activeUnread = currentConversation
    ? (unreadByConversation.get(currentConversation.id) ?? 0)
    : 0;
  const activeResponseStatus = activeLastMessage
    ? activeLastMessage.sender_is_admin === isChatAdmin
      ? "Waiting on recipient"
      : "Your turn"
    : "No messages yet";
  const suggestedActions = [
    activeUnread
      ? `Review ${activeUnread} unread message${activeUnread === 1 ? "" : "s"}`
      : "No unread messages",
    activeSharedFiles.length
      ? `${activeSharedFiles.length} shared file${activeSharedFiles.length === 1 ? "" : "s"}`
      : "No shared files yet",
    activeLastMessage
      ? `Last activity ${formatDistanceToNow(new Date(activeLastMessage.created_at), { addSuffix: true })}`
      : "Start with a quick template",
  ];

  function applyTemplate(text: string) {
    setDraft((value) => (value.trim() ? `${value.trim()}\n\n${text}` : text));
    setShowEmoji(false);
    window.requestAnimationFrame(() => textareaRef.current?.focus({ preventScroll: true }));
  }

  return (
    <div className="-mx-4 -mb-4 mt-0 sm:mx-0 sm:my-0 h-full flex flex-col flex-1 min-h-0 overflow-hidden bg-card text-foreground shadow-2xl sm:rounded-[30px] sm:border sm:border-border sm:p-4 lg:p-5">
      <div className="hidden gap-3 pb-4 lg:grid lg:grid-cols-3">
        <ChatMetric
          icon={MessageCircle}
          label={isChatAdmin ? "Total conversations" : "Inbox"}
          value={isChatAdmin ? conversations.length : "Official Channel"}
          subtitle={isChatAdmin ? `${todayMessages} today` : "Secure messaging"}
          tone="cyan"
        />
        <ChatMetric
          icon={Users}
          label={isChatAdmin ? "Waiting for reply" : "Channel status"}
          value={isChatAdmin ? waitingForReply : "Active"}
          subtitle={activeResponseStatus}
          tone="violet"
        />
        <ChatMetric
          icon={ShieldCheck}
          label="Unread messages"
          value={totalUnread}
          subtitle={totalUnread ? "High priority" : "All caught up"}
          tone="pink"
        />
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden bg-card sm:rounded-[26px] sm:border sm:border-border">
        <aside
          className={`${mobileChatOpen ? "hidden" : "flex"} w-full shrink-0 flex-col bg-card md:flex md:w-[340px] md:border-r md:border-border xl:w-[380px]`}
        >
          <div className="border-b border-border p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-lg font-black">
                  <MessageCircle className="text-foreground" size={21} /> Messages
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {isChatAdmin ? "Admin–employee workspace" : "Your secure Admin / HR channel"}
                </p>
              </div>
              {totalUnread > 0 && (
                <span className="rounded-full bg-gradient-to-r from-pink-500 to-violet-500 px-2.5 py-1 text-xs font-black">
                  {totalUnread}
                </span>
              )}
            </div>
            {isChatAdmin && (
              <>
                <label className="mt-4 flex items-center gap-2 rounded-2xl border border-border bg-card px-3 shadow-[inset_0_1px_0_rgba(255,255,255,.04)] transition focus-within:border-cyan-300/45 focus-within:shadow-[0_0_28px_rgba(0,194,255,.12)]">
                  <Search size={16} className="text-muted-foreground" />
                  <input
                    value={employeeSearch}
                    onChange={(event) => setEmployeeSearch(event.target.value)}
                    placeholder="Search employees, departments or messages..."
                    className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                  {employeeSearch && (
                    <button onClick={() => setEmployeeSearch("")} aria-label="Clear search">
                      <X size={15} />
                    </button>
                  )}
                </label>
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
                  {(["recent", "unread", "needs_reply", "archived", "pinned", "all"] as const).map(
                    (filter) => (
                      <button
                        key={filter}
                        onClick={() => setConversationFilter(filter)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-bold capitalize transition active:scale-95 ${conversationFilter === filter ? "border-cyan-300/35 bg-cyan-300/15 text-foreground shadow-[0_0_18px_rgba(0,194,255,.12)]" : "border-border bg-card text-muted-foreground hover:bg-card hover:text-muted-foreground"}`}
                      >
                        {filter.replace("_", " ")}
                      </button>
                    ),
                  )}
                </div>
              </>
            )}
          </div>

          <div className="flex-1 overflow-y-auto [scrollbar-width:thin]">
            {isChatAdmin ? (
              conversationRows.length ? (
                conversationRows.map(({ employee, conversation, lastMessage }) => {
                  const unread = conversation
                    ? (unreadByConversation.get(conversation.id) ?? 0)
                    : 0;
                  const online = presences.some(
                    (item) => item.user_id === employee.user_id && item.is_online,
                  );
                  return (
                    <button
                      key={employee.user_id}
                      onClick={() => {
                        setSelectedEmployeeId(employee.user_id);
                        setMobileChatOpen(true);
                      }}
                      className={`group flex w-full gap-3 border-b border-border p-4 text-left transition duration-200 hover:bg-card/70 ${selectedEmployeeId === employee.user_id ? "bg-gradient-to-r from-cyan-400/15 via-[#182233] to-transparent shadow-[inset_3px_0_0_rgba(0,194,255,.9)]" : unread > 0 ? "bg-cyan-300/[0.045]" : ""}`}
                    >
                      <Avatar profile={employee} online={online} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <strong
                            className={`truncate text-sm ${unread > 0 ? "text-foreground" : "text-muted-foreground"}`}
                          >
                            {employee.full_name || "Employee"}
                          </strong>
                          {conversation?.pinned_by_admin && (
                            <Pin size={12} className="shrink-0 text-foreground" />
                          )}
                          <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                            {lastMessage ? formatMessageListTime(lastMessage.created_at) : "New"}
                          </span>
                        </div>
                        <div className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground">
                          {employee.department || employee.position || "Team member"}
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <p
                            className={`truncate text-xs ${unread > 0 ? "font-semibold text-muted-foreground" : "text-muted-foreground"}`}
                          >
                            {lastMessage?.body ||
                              lastMessage?.attachment_name ||
                              employee.position ||
                              "Start a conversation"}
                          </p>
                          {peerIsTyping && selectedEmployeeId === employee.user_id && (
                            <span className="shrink-0 text-[10px] font-bold text-foreground">
                              typing…
                            </span>
                          )}
                          {unread > 0 && (
                            <span className="ml-auto flex h-5 min-w-5 shrink-0 animate-pulse items-center justify-center rounded-full bg-pink-500 px-1 text-[10px] font-black shadow-[0_0_18px_rgba(236,72,153,.35)]">
                              {unread > 99 ? "99+" : unread}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              ) : (
                <EmptySidebar
                  text={
                    conversationFilter === "archived"
                      ? "No archived conversations"
                      : "No conversations found"
                  }
                />
              )
            ) : (
              officialRows.map(({ official, lastMessage, unread, online }) => {
                const isSelected = selectedOfficialId === official.user_id;
                const typing = presences.find(
                  (item) =>
                    item.user_id === official.user_id &&
                    item.typing_conversation_id === currentConversation?.id,
                );
                const isTyping = Boolean(
                  typing &&
                  (typing.updated_at
                    ? Date.now() - new Date(typing.updated_at).getTime() < 7000
                    : true),
                );
                return (
                  <button
                    key={official.user_id}
                    onClick={() => {
                      setSelectedOfficialId(official.user_id);
                      setMobileChatOpen(true);
                    }}
                    className={`group flex w-full gap-3 border-b border-border p-4 text-left transition duration-200 hover:bg-card/60 ${
                      isSelected
                        ? "bg-gradient-to-r from-cyan-400/15 via-[#182233] to-transparent shadow-[inset_3px_0_0_rgba(0,194,255,.9)]"
                        : unread > 0
                          ? "bg-cyan-300/[0.045]"
                          : ""
                    }`}
                  >
                    <Avatar profile={official} online={online} admin compact />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <strong
                          className={`truncate text-sm ${unread > 0 ? "text-foreground" : "text-muted-foreground"}`}
                        >
                          {official.full_name || "Official"}
                        </strong>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] ${
                            official.role === "super_admin"
                              ? "border border-pink-500/20 bg-pink-500/10 text-foreground"
                              : official.role === "hr_manager"
                                ? "border border-purple-500/20 bg-purple-500/10 text-purple-300"
                                : "border border-cyan-300/15 bg-cyan-300/10 text-foreground"
                          }`}
                        >
                          {official.role === "super_admin"
                            ? "S-Admin"
                            : official.role === "hr_manager"
                              ? "HR"
                              : "Admin"}
                        </span>
                        {lastMessage && (
                          <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                            {formatMessageListTime(lastMessage.created_at)}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground">
                        {official.position || "Administrator"}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <p
                          className={`truncate text-xs ${unread > 0 ? "font-semibold text-muted-foreground" : "text-muted-foreground"}`}
                        >
                          {lastMessage?.body ||
                            lastMessage?.attachment_name ||
                            "Start the conversation"}
                        </p>
                        {isTyping && (
                          <span className="shrink-0 text-[10px] font-bold text-foreground animate-pulse">
                            typing…
                          </span>
                        )}
                        {unread > 0 && (
                          <span className="ml-auto flex h-5 min-w-5 shrink-0 animate-pulse items-center justify-center rounded-full bg-pink-500 px-1 text-[10px] font-black shadow-[0_0_18px_rgba(236,72,153,.35)]">
                            {unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
          <div className="border-t border-border p-3 text-center text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Messages are permanent &amp; auditable
          </div>
        </aside>

        <section
          className={`${mobileChatOpen ? "flex" : "hidden"} w-full min-w-0 flex-1 flex-col overflow-x-hidden bg-[radial-gradient(circle_at_70%_0%,rgba(0,194,255,.08),transparent_30%),#0B1020] md:flex`}
        >
          {(isChatAdmin ? selectedEmployee : selectedOfficial) ? (
            <>
              <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-card/95 px-2 backdrop-blur-xl sm:h-[76px] sm:gap-3 sm:px-4">
                <button
                  onClick={() => setMobileChatOpen(false)}
                  className="rounded-lg p-2 hover:bg-card md:hidden"
                  aria-label="Back to conversations"
                >
                  <ArrowLeft size={19} />
                </button>
                <Avatar
                  profile={isChatAdmin ? selectedEmployee : selectedOfficial}
                  online={Boolean(peerPresence?.is_online)}
                  admin={!isChatAdmin}
                  compact
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-sm font-black sm:text-base">
                      {isChatAdmin
                        ? selectedEmployee?.full_name
                        : selectedOfficial?.full_name || "Aslenix Admin"}
                    </h2>
                    {!isChatAdmin && <ShieldCheck size={14} className="text-foreground" />}
                  </div>
                  <div className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {isChatAdmin
                      ? selectedEmployee?.department || selectedEmployee?.position || "Employee"
                      : selectedOfficial?.position || "Official support channel"}
                  </div>
                  <p
                    className={`truncate text-[11px] ${peerIsTyping ? "text-foreground" : "text-muted-foreground"}`}
                  >
                    {peerIsTyping
                      ? "typing…"
                      : peerPresence?.is_online
                        ? "Online"
                        : peerPresence?.last_seen_at
                          ? `Last seen ${formatDistanceToNow(new Date(peerPresence.last_seen_at), { addSuffix: true })}`
                          : isChatAdmin
                            ? selectedEmployee?.position
                            : selectedOfficial?.position || "Support channel"}
                  </p>
                </div>
                <label className="hidden items-center gap-2 rounded-xl border border-border bg-card px-3 xl:flex">
                  <Search size={14} className="text-muted-foreground" />
                  <input
                    value={messageSearch}
                    onChange={(event) => setMessageSearch(event.target.value)}
                    placeholder="Search messages"
                    className="h-9 w-32 bg-transparent text-xs outline-none 2xl:w-44"
                  />
                </label>
                <input
                  type="date"
                  value={dateSearch}
                  onChange={(event) => setDateSearch(event.target.value)}
                  className="hidden h-9 rounded-xl border border-border bg-card px-2 text-xs text-muted-foreground outline-none 2xl:block [color-scheme:dark]"
                  aria-label="Search messages by date"
                />
                <button
                  className="hidden rounded-xl border border-border bg-card p-2 text-muted-foreground transition hover:bg-card hover:text-foreground lg:inline-flex"
                  aria-label="Voice call"
                >
                  <Phone size={18} />
                </button>
                <button
                  className="hidden rounded-xl border border-border bg-card p-2 text-muted-foreground transition hover:bg-card hover:text-foreground lg:inline-flex"
                  aria-label="Video call"
                >
                  <Video size={18} />
                </button>
                {isChatAdmin && currentConversation && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setConversationFlag("pin")}
                      title={currentConversation.pinned_by_admin ? "Unpin" : "Pin conversation"}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-card hover:text-foreground"
                    >
                      {currentConversation.pinned_by_admin ? (
                        <PinOff size={18} />
                      ) : (
                        <Pin size={18} />
                      )}
                    </button>
                    <button
                      onClick={() => setConversationFlag("archive")}
                      title={
                        currentConversation.archived_by_admin ? "Restore" : "Archive conversation"
                      }
                      className="rounded-lg p-2 text-muted-foreground hover:bg-card hover:text-foreground"
                    >
                      {currentConversation.archived_by_admin ? (
                        <ArchiveRestore size={18} />
                      ) : (
                        <Archive size={18} />
                      )}
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setShowInfoPanel((value) => !value)}
                  className={`rounded-lg p-2 transition ${showInfoPanel ? "bg-cyan-300/10 text-foreground" : "text-muted-foreground hover:bg-card"}`}
                  aria-label="Conversation information"
                  aria-expanded={showInfoPanel}
                >
                  <MoreVertical size={18} />
                </button>
              </header>

              <div className="flex items-center gap-2 border-b border-border px-2 py-2 sm:px-3 xl:hidden">
                <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg bg-card px-3">
                  <Search size={13} className="text-muted-foreground" />
                  <input
                    value={messageSearch}
                    onChange={(event) => setMessageSearch(event.target.value)}
                    placeholder="Search messages"
                    className="h-8 min-w-0 flex-1 bg-transparent text-xs outline-none"
                  />
                </label>
                <input
                  type="date"
                  value={dateSearch}
                  onChange={(event) => setDateSearch(event.target.value)}
                  className="h-8 w-10 rounded-lg border-0 bg-card px-2 text-transparent outline-none [color-scheme:dark]"
                  aria-label="Search messages by date"
                />
              </div>

              <div
                ref={messageScrollerRef}
                className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-2 py-3 sm:px-5 sm:py-4 [scrollbar-width:thin]"
              >
                <div className="mx-auto w-full min-w-0 max-w-4xl overflow-hidden space-y-1">
                  {messages.length >= messageLimit && (
                    <div className="flex justify-center py-2">
                      <button
                        type="button"
                        onClick={() => setMessageLimit((prev) => prev + 50)}
                        className="rounded-full border border-border bg-card px-4 py-1.5 text-xs font-bold text-muted-foreground transition hover:bg-card hover:text-foreground cursor-pointer"
                      >
                        Load Older Messages
                      </button>
                    </div>
                  )}
                  <div className="mx-auto mb-5 flex max-w-xl items-start gap-3 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.07] px-4 py-3 text-left shadow-[0_18px_45px_rgba(0,194,255,.06)]">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-cyan-300/10 text-foreground">
                      <ShieldCheck size={17} />
                    </span>
                    <div>
                      <div className="text-xs font-black text-cyan-50">
                        Secure Internal Conversation
                      </div>
                      <p className="mt-1 text-[11px] leading-5 text-foreground">
                        Messages are encrypted. Conversation history cannot be edited or deleted.
                      </p>
                    </div>
                  </div>
                  {loading ? (
                    <MessageSkeleton />
                  ) : visibleMessages.length ? (
                    visibleMessages.map((message, index) => {
                      const mine = message.sender_id === user?.id;
                      const previous = visibleMessages[index - 1];
                      const showDate =
                        !previous ||
                        !isSameDay(new Date(previous.created_at), new Date(message.created_at));
                      return (
                        <div key={message.id}>
                          {showDate && <DateSeparator date={message.created_at} />}
                          <MessageBubble
                            message={message}
                            mine={mine}
                            signedUrl={signedUrls[message.id]}
                            currentUserId={user?.id}
                            onToggleReaction={toggleReaction}
                            onReply={setReplyingTo}
                          />
                        </div>
                      );
                    })
                  ) : (
                    <EmptyMessages
                      isAdmin={isChatAdmin}
                      onUpload={() => fileInputRef.current?.click()}
                    />
                  )}
                  {peerIsTyping && (
                    <div className="flex w-fit gap-1 rounded-2xl rounded-bl-md border border-border bg-card px-4 py-3">
                      <i className="h-1.5 w-1.5 animate-bounce rounded-full bg-card" />
                      <i className="h-1.5 w-1.5 animate-bounce rounded-full bg-card [animation-delay:120ms]" />
                      <i className="h-1.5 w-1.5 animate-bounce rounded-full bg-card [animation-delay:240ms]" />
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              <form
                onSubmit={sendMessage}
                className="relative w-full max-w-full shrink-0 overflow-hidden border-t border-border bg-card/95 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-18px_50px_rgba(0,0,0,.22)] backdrop-blur-xl sm:p-4"
              >
                {replyingTo && (
                  <div className="mx-auto mb-2 flex max-w-4xl items-center justify-between gap-3 border-l-2 border-cyan-400 bg-cyan-300/[0.04] px-4 py-2 text-xs rounded-r-xl animate-[fade-in_.15s_ease-out]">
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-foreground">
                        Replying to {replyingTo.sender_is_admin ? "Admin" : "Teammate"}:
                      </span>
                      <p className="truncate text-muted-foreground mt-0.5">
                        {replyingTo.body || "Attachment"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReplyingTo(null)}
                      className="text-muted-foreground hover:text-foreground cursor-pointer"
                      aria-label="Cancel reply"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
                <div className="mx-auto mb-2 flex max-w-4xl gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
                  {QUICK_TEMPLATES.map((template) => (
                    <button
                      key={template.label}
                      type="button"
                      onClick={() => applyTemplate(template.text)}
                      className="shrink-0 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-bold text-muted-foreground transition hover:border-cyan-300/30 hover:bg-cyan-300/10 hover:text-foreground active:scale-95"
                    >
                      {template.label}
                    </button>
                  ))}
                </div>
                <div className="mx-auto w-full min-w-0 max-w-4xl rounded-3xl border border-border bg-card p-2 shadow-[inset_0_1px_0_rgba(255,255,255,.05),0_18px_55px_rgba(0,0,0,.18)]">
                  <div className="flex w-full min-w-0 items-end gap-1.5 sm:gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={ACCEPTED_ATTACHMENT_TYPES}
                      className="hidden"
                      onChange={(event) =>
                        event.target.files?.[0] && sendMessage(undefined, event.target.files[0])
                      }
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground transition hover:border-cyan-300/25 hover:bg-cyan-300/10 hover:text-foreground active:scale-95 cursor-pointer"
                      aria-label="Attach file"
                    >
                      <Paperclip size={21} />
                    </button>
                    <div className="relative flex min-h-11 min-w-0 flex-1 items-end rounded-2xl border border-cyan-300/15 bg-card/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition focus-within:border-cyan-300/45 focus-within:shadow-[0_0_24px_rgba(0,194,255,0.12)]">
                      <textarea
                        ref={textareaRef}
                        value={draft}
                        onFocus={() => setComposerFocused(true)}
                        onBlur={() => {
                          setComposerFocused(false);
                          if (user)
                            db.from("chat_presence").upsert({
                              user_id: user.id,
                              is_online: true,
                              last_seen_at: new Date().toISOString(),
                              typing_conversation_id: null,
                            });
                        }}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            sendMessage();
                          }
                        }}
                        rows={1}
                        placeholder="Type a secure workplace message..."
                        className="max-h-28 min-h-11 flex-1 resize-none bg-transparent px-3 py-3 text-sm leading-5 outline-none placeholder:text-muted-foreground sm:px-4"
                      />
                      <button
                        type="button"
                        className="m-1 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-card hover:text-foreground"
                        aria-label="Mention teammate"
                      >
                        <AtSign size={17} />
                      </button>
                      <button
                        type="button"
                        className="m-1 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-card hover:text-foreground"
                        aria-label="AI assistant"
                      >
                        <Bot size={17} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowEmoji((value) => !value)}
                        className="m-1 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-card hover:text-yellow-200 cursor-pointer"
                        aria-label="Choose emoji"
                      >
                        <Smile size={19} />
                      </button>
                      {showEmoji && (
                        <div className="absolute bottom-12 right-0 grid grid-cols-4 gap-1 rounded-2xl border border-border bg-card p-2 shadow-2xl">
                          {QUICK_EMOJIS.map((emoji) => (
                            <button
                              type="button"
                              key={emoji}
                              onClick={() => {
                                setDraft((value) => value + emoji);
                                setShowEmoji(false);
                              }}
                              className="rounded-lg p-2 text-lg hover:bg-card"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground transition hover:bg-card hover:text-foreground active:scale-95 sm:flex"
                      aria-label="Voice message"
                    >
                      <Mic size={19} />
                    </button>
                    <button
                      type="submit"
                      disabled={sending || !draft.trim()}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 via-violet-500 to-cyan-400 text-foreground shadow-[0_0_24px_rgba(124,58,237,.3)] transition hover:scale-105 hover:shadow-[0_0_32px_rgba(0,194,255,.22)] active:scale-95 disabled:cursor-not-allowed disabled:grayscale disabled:opacity-45 cursor-pointer"
                      aria-label="Send message"
                    >
                      <Send size={19} />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-end sm:justify-between gap-3 px-1 text-[10px] text-muted-foreground">
                    <span className="truncate hidden sm:inline">
                      Supports PDF, DOCX, XLSX, ZIP, Images · Maximum upload: 50MB
                    </span>
                    <span className="shrink-0 tabular-nums">{draft.length}/2000</span>
                  </div>
                </div>
              </form>
            </>
          ) : !isChatAdmin && adminProfiles.length > 0 ? (
            <div className="flex flex-1 flex-col overflow-y-auto p-6 sm:p-8 lg:p-10 bg-card">
              <div className="max-w-4xl mx-auto w-full animate-[fade-in_.2s_ease-out]">
                <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between border-b border-border pb-6">
                  <div>
                    <h2 className="text-2xl font-black text-foreground tracking-tight">
                      Contact HR & Administration
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1.5">
                      Directly message any of the available workspace administrators or HR managers
                      below.
                    </p>
                  </div>
                  <div className="mt-4 md:mt-0 flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,.04)]">
                    <Search size={14} className="text-muted-foreground" />
                    <input
                      value={employeeSearch}
                      onChange={(event) => setEmployeeSearch(event.target.value)}
                      placeholder="Search administrators..."
                      className="h-9 w-44 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                    />
                    {employeeSearch && (
                      <button onClick={() => setEmployeeSearch("")} aria-label="Clear search">
                        <X size={13} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {adminProfiles
                    .filter(
                      (official) =>
                        !employeeSearch ||
                        (official.full_name || "")
                          .toLowerCase()
                          .includes(employeeSearch.toLowerCase()),
                    )
                    .map((official) => {
                      const online = presences.some(
                        (item) => item.user_id === official.user_id && item.is_online,
                      );
                      const initialsStr = initials(official.full_name);
                      return (
                        <div
                          key={official.user_id}
                          className="relative group rounded-3xl border border-border bg-card/70 p-6 flex flex-col justify-between transition duration-300 hover:border-cyan-300/25 hover:bg-card/70 hover:shadow-[0_20px_50px_rgba(0,194,255,0.06)]"
                        >
                          <div>
                            <div className="flex items-start gap-4">
                              <div className="relative shrink-0 h-14 w-14">
                                <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-2xl border border-cyan-300/30 bg-gradient-to-br from-cyan-400/25 to-violet-500/25 text-base font-black text-foreground">
                                  {official.avatar_url ? (
                                    <img
                                      src={official.avatar_url}
                                      alt=""
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    initialsStr
                                  )}
                                </div>
                                <span
                                  className={`absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-[3px] border-[#121827] ${online ? "bg-emerald-400" : "bg-slate-600"}`}
                                />
                              </div>
                              <div className="min-w-0">
                                <h3 className="font-black text-foreground text-base truncate flex items-center gap-1.5">
                                  {official.full_name || "Official"}
                                  <ShieldCheck size={16} className="text-foreground shrink-0" />
                                </h3>
                                <div className="mt-0.5 text-xs font-semibold uppercase tracking-[0.08em] text-purple-300/80">
                                  {official.role === "super_admin"
                                    ? "Super Admin"
                                    : official.role === "hr_manager"
                                      ? "HR Manager"
                                      : "Administrator"}
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground truncate">
                                  {official.position || "Official Support Channel"}
                                </div>
                              </div>
                            </div>
                            <p className="mt-4 text-xs text-muted-foreground leading-relaxed">
                              Available for leave approvals, attendance updates, official company
                              circulars, and support queries.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedOfficialId(official.user_id);
                              setMobileChatOpen(true);
                            }}
                            className="mt-6 w-full rounded-2xl bg-card border border-border hover:border-cyan-300/25 hover:bg-cyan-300/10 hover:text-foreground text-foreground font-bold py-2.5 px-4 text-xs tracking-wider uppercase transition active:scale-95 cursor-pointer"
                          >
                            Message
                          </button>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center text-center">
              <div>
                <MessageCircle className="mx-auto text-foreground" size={46} />
                <h2 className="mt-4 font-black">Select a conversation</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choose an official to start messaging.
                </p>
              </div>
            </div>
          )}
        </section>

        {showInfoPanel && (
          <aside className="hidden w-[300px] shrink-0 animate-[fade-in_.18s_ease-out] border-l border-border bg-card p-4 xl:block">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-black">Details</div>
                <div className="text-[11px] text-muted-foreground">Conversation information</div>
              </div>
              <button
                type="button"
                onClick={() => setShowInfoPanel(false)}
                className="rounded-xl border border-border bg-card p-2 text-muted-foreground transition hover:bg-card hover:text-foreground"
                aria-label="Close details panel"
              >
                <X size={16} />
              </button>
            </div>
            <div className="rounded-3xl border border-border bg-card/80 p-4">
              <div className="flex items-center gap-3">
                <Avatar
                  profile={isChatAdmin ? selectedEmployee : selectedOfficial}
                  online={Boolean(peerPresence?.is_online)}
                  admin={!isChatAdmin}
                />
                <div className="min-w-0">
                  <div className="truncate text-sm font-black">
                    {isChatAdmin
                      ? selectedEmployee?.full_name || "Employee"
                      : selectedOfficial?.full_name || "Aslenix Admin"}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {isChatAdmin
                      ? selectedEmployee?.department || selectedEmployee?.position || "Team member"
                      : selectedOfficial?.position || "Official support channel"}
                  </div>
                </div>
              </div>
            </div>
            <InfoSection
              title="Conversation Details"
              items={[
                "Secure internal channel",
                currentConversation?.pinned_by_admin ? "Pinned conversation" : "Standard priority",
                currentConversation?.archived_by_admin ? "Archived" : "Active",
              ]}
            />
            <InfoSection
              title="Shared Files"
              items={[
                `${activeSharedFiles.length} attachment${activeSharedFiles.length === 1 ? "" : "s"}`,
                activeSharedFiles[0]?.attachment_name || "No recent file",
                "PDF, Office, Images, ZIP, Video",
              ]}
            />
            <InfoSection title="Suggested Actions" items={suggestedActions} />
            <InfoSection
              title="Recent Activity"
              items={[
                visibleMessages.length
                  ? `${visibleMessages.length} messages loaded`
                  : "No messages yet",
                activeResponseStatus,
                peerPresence?.is_online ? "Member online" : "Member offline",
              ]}
            />
          </aside>
        )}
      </div>
    </div>
  );
}

function Avatar({
  profile,
  online,
  admin,
  compact,
}: {
  profile?: ChatProfile | null;
  online?: boolean;
  admin?: boolean;
  compact?: boolean;
}) {
  const size = compact ? "h-10 w-10" : "h-11 w-11";
  return (
    <div className={`relative shrink-0 ${size}`}>
      <div
        className={`flex h-full w-full items-center justify-center overflow-hidden rounded-2xl border ${admin ? "border-cyan-300/30 bg-gradient-to-br from-cyan-400/25 to-violet-500/25" : "border-border bg-card"} text-sm font-black`}
      >
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
        ) : admin ? (
          <ShieldCheck size={20} className="text-foreground" />
        ) : (
          initials(profile?.full_name)
        )}
      </div>
      <span
        className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-[3px] border-[#0b0e1a] ${online ? "bg-emerald-400" : "bg-slate-600"}`}
      />
    </div>
  );
}

function MessageBubble({
  message,
  mine,
  signedUrl,
  currentUserId,
  onToggleReaction,
  onReply,
}: {
  message: ChatMessage;
  mine: boolean;
  signedUrl?: string;
  currentUserId?: string;
  onToggleReaction: (message: ChatMessage, emoji: string) => void;
  onReply: (message: ChatMessage) => void;
}) {
  const image = message.attachment_type?.startsWith("image/");
  const video = message.attachment_type?.startsWith("video/");
  const FileIcon = getFileIcon(message.attachment_type);

  const isReply = message.body?.startsWith("> [");
  let quoteUser = "";
  let quoteBody = "";
  let cleanBody = message.body || "";

  if (isReply && message.body) {
    const splitIdx = message.body.indexOf("\n\n");
    if (splitIdx !== -1) {
      const header = message.body.substring(0, splitIdx);
      const match = header.match(/^>\s*\[([^\]]+)\]:\s*(.*)$/);
      if (match) {
        quoteUser = match[1];
        quoteBody = match[2];
      }
      cleanBody = message.body.substring(splitIdx + 2);
    }
  }

  return (
    <div
      className={`group mb-3 flex min-w-0 items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`order-2 flex translate-y-1 gap-1 opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100 ${mine ? "" : "order-1"}`}
      >
        <div className="flex gap-0.5 rounded-lg bg-card p-0.5 border border-border shadow-md">
          {["👍", "❤️", "😂", "🎉", "🙏"].map((emoji) => (
            <button
              key={emoji}
              onClick={() => onToggleReaction(message, emoji)}
              className="rounded p-1 text-xs hover:bg-card active:scale-90 cursor-pointer"
              title={`React with ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
        <button
          onClick={() => onReply(message)}
          className="rounded-lg bg-card p-1.5 text-muted-foreground hover:text-foreground hover:bg-card cursor-pointer"
          aria-label="Reply"
        >
          <CornerUpLeft size={13} />
        </button>
        <button
          onClick={() => {
            navigator.clipboard.writeText(cleanBody);
            toast.success("Copied to clipboard");
          }}
          className="rounded-lg bg-card p-1.5 text-muted-foreground hover:text-foreground hover:bg-card cursor-pointer"
          aria-label="Copy"
        >
          <Copy size={13} />
        </button>
      </div>
      <div
        className={`min-w-0 max-w-[82vw] animate-[fade-in_.18s_ease-out] overflow-hidden rounded-2xl border px-2.5 py-2 text-sm shadow-lg sm:max-w-[72%] sm:px-3.5 sm:py-2.5 ${mine ? "order-1 rounded-br-md border-violet-300/15 bg-gradient-to-br from-violet-600/90 via-fuchsia-600/82 to-pink-600/82 shadow-[0_18px_42px_rgba(168,85,247,0.20)]" : "order-2 rounded-bl-md border-border bg-card shadow-[0_18px_42px_rgba(0,0,0,0.18)]"}`}
      >
        {quoteUser && (
          <div className="mb-2 border-l-2 border-border bg-card px-2.5 py-1.5 text-[11px] rounded-r-lg text-muted-foreground">
            <span className="font-bold block text-[10px] text-muted-foreground">{quoteUser}</span>
            <p className="line-clamp-2 mt-0.5">{quoteBody}</p>
          </div>
        )}
        {message.attachment_path &&
          (image && signedUrl ? (
            <a
              href={signedUrl}
              target="_blank"
              rel="noreferrer"
              className="mb-2 block max-w-full overflow-hidden rounded-xl border border-border bg-card"
            >
              <img
                src={signedUrl}
                alt={message.attachment_name || "Attachment"}
                className="block max-h-[46dvh] w-full max-w-full object-cover"
                loading="lazy"
              />
            </a>
          ) : video && signedUrl ? (
            <div className="mb-2 max-w-full overflow-hidden rounded-xl border border-border bg-card">
              <video
                src={signedUrl}
                controls
                preload="metadata"
                playsInline
                className="block max-h-[46dvh] w-full max-w-full bg-black object-contain"
              />
              <a
                href={signedUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-3 px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <span className="min-w-0 truncate">
                  {message.attachment_name || "Video attachment"}
                </span>
                <Download size={14} className="shrink-0" />
              </a>
            </div>
          ) : (
            <a
              href={signedUrl || "#"}
              target={signedUrl ? "_blank" : undefined}
              rel="noreferrer"
              className="mb-2 flex min-w-0 max-w-full items-center gap-3 rounded-xl border border-border bg-card p-3 hover:bg-card"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-card">
                <FileIcon size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-xs">{message.attachment_name}</strong>
                <small className="mt-0.5 block text-[10px] text-muted-foreground">
                  {formatFileSize(message.attachment_size)}
                </small>
              </span>
              <Download size={15} className="shrink-0 text-muted-foreground" />
            </a>
          ))}
        {cleanBody && (
          <p className="whitespace-pre-wrap break-words leading-5 text-muted-foreground">
            {cleanBody}
          </p>
        )}
        <div
          className={`mt-1 flex items-center justify-end gap-1 text-[9px] ${mine ? "text-muted-foreground" : "text-muted-foreground"}`}
        >
          {format(new Date(message.created_at), "h:mm a")}
          {mine &&
            (message.read_at ? (
              <CheckCheck size={13} className="text-foreground" />
            ) : message.delivered_at ? (
              <CheckCheck size={13} />
            ) : (
              <Check size={13} />
            ))}
        </div>
        {message.reactions && Object.keys(message.reactions).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {Object.entries(message.reactions as Record<string, string[]>).map(([emoji, uids]) => {
              if (!uids || uids.length === 0) return null;
              const reacted = currentUserId && uids.includes(currentUserId);
              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onToggleReaction(message, emoji)}
                  className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs transition active:scale-95 cursor-pointer ${
                    reacted
                      ? "border-cyan-300/30 bg-cyan-300/10 text-foreground"
                      : "border-border bg-card text-muted-foreground hover:bg-card hover:text-foreground"
                  }`}
                >
                  <span>{emoji}</span>
                  <span className="text-[10px] font-bold">{uids.length}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function DateSeparator({ date }: { date: string }) {
  const value = new Date(date);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const label = isSameDay(value, today)
    ? "Today"
    : isSameDay(value, yesterday)
      ? "Yesterday"
      : format(value, "EEEE, MMMM d");
  return (
    <div className="my-6 flex items-center gap-3">
      <span className="h-px flex-1 bg-card" />
      <span className="rounded-full border border-border bg-card px-3 py-1 text-[10px] font-bold text-muted-foreground shadow-sm">
        {label}
      </span>
      <span className="h-px flex-1 bg-card" />
    </div>
  );
}

function ChatMetric({
  icon: Icon,
  label,
  value,
  subtitle,
  tone,
}: {
  icon: typeof MessageCircle;
  label: string;
  value: string | number;
  subtitle: string;
  tone: "cyan" | "violet" | "pink";
}) {
  const colors = {
    cyan: "from-cyan-400/25 text-foreground border-cyan-300/20",
    violet: "from-violet-400/20 text-foreground border-violet-300/20",
    pink: "from-pink-400/20 text-foreground border-pink-300/20",
  };
  return (
    <div
      className={`group rounded-[20px] border bg-gradient-to-br ${colors[tone]} to-[#182233] p-[1px] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_45px_rgba(0,0,0,.22)]`}
    >
      <div className="flex h-full items-center gap-4 rounded-[19px] bg-card/90 p-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-card shadow-[inset_0_1px_0_rgba(255,255,255,.08)] transition group-hover:scale-105">
          <Icon size={21} />
        </span>
        <div className="min-w-0">
          <div className="truncate text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
            {label}
          </div>
          <div className="mt-1 text-2xl font-black tracking-tight text-foreground">{value}</div>
          <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-foreground">
            <Sparkles size={12} />
            {subtitle}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptySidebar({ text }: { text: string }) {
  return (
    <div className="px-5 py-16 text-center">
      <Search className="mx-auto text-muted-foreground" size={28} />
      <p className="mt-3 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function EmptyMessages({ isAdmin, onUpload }: { isAdmin: boolean; onUpload: () => void }) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center py-16 text-center">
      <div className="relative">
        <div className="absolute inset-0 rounded-[32px] bg-cyan-300/20 blur-2xl" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-[28px] border border-cyan-300/20 bg-card text-foreground shadow-[0_20px_70px_rgba(0,194,255,.12)]">
          <MessageCircle size={36} />
        </div>
      </div>
      <h3 className="mt-5 text-xl font-black tracking-tight">
        {isAdmin ? "Start a conversation" : "Start the conversation"}
      </h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
        {isAdmin
          ? "Send a secure message, document, or update to this employee."
          : "Send a secure workplace message to the official admin channel."}
      </p>
      <div className="mt-6 grid w-full max-w-md grid-cols-1 gap-2 sm:grid-cols-3">
        <button
          onClick={onUpload}
          className="rounded-2xl border border-border bg-card px-3 py-3 text-xs font-bold text-muted-foreground transition hover:bg-card hover:text-foreground active:scale-95"
        >
          Upload File
        </button>
        <button className="rounded-2xl border border-border bg-card px-3 py-3 text-xs font-bold text-muted-foreground transition hover:bg-card hover:text-foreground active:scale-95">
          Send Announcement
        </button>
        <button className="rounded-2xl border border-border bg-card px-3 py-3 text-xs font-bold text-muted-foreground transition hover:bg-card hover:text-foreground active:scale-95">
          Choose Template
        </button>
      </div>
    </div>
  );
}

function InfoSection({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="mt-4 rounded-3xl border border-border bg-card/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
          {title}
        </h3>
        <span className="h-2 w-2 rounded-full bg-cyan-300/70" />
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item} className="rounded-2xl bg-card px-3 py-2 text-xs text-muted-foreground">
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}

function MessageSkeleton() {
  return (
    <div className="space-y-3 py-8">
      <div className="h-16 w-2/3 animate-pulse rounded-2xl bg-card" />
      <div className="ml-auto h-20 w-3/5 animate-pulse rounded-2xl bg-violet-400/10" />
      <div className="h-14 w-1/2 animate-pulse rounded-2xl bg-card" />
    </div>
  );
}

function initials(name?: string | null) {
  return (name || "E")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
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

function sortOfficials(a: ChatProfile, b: ChatProfile) {
  const roleOrder: Record<string, number> = {
    super_admin: 1,
    admin: 2,
    hr_manager: 3,
  };
  const orderA = roleOrder[a.role || ""] ?? 99;
  const orderB = roleOrder[b.role || ""] ?? 99;
  if (orderA !== orderB) return orderA - orderB;
  return (a.full_name || "").localeCompare(b.full_name || "");
}
