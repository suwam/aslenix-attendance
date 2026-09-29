import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";

import { format } from "date-fns";
import { formatNepaliDate } from "@/lib/nepali-calendar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Paperclip, Send, MoreVertical, Pencil, Trash2, Reply } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { TaskComment, TaskCommentMention } from "@/lib/tasks-utils";

interface UserOption {
  user_id: string;
  full_name: string;
  role: string;
}

interface TaskDiscussionProps {
  taskId: string;
  comments: TaskComment[];
  mentionableUsers: UserOption[];
  onCommentAdded: () => void;
  canComment: boolean;
}

function formatDate(iso: string) {
  try {
    return `${formatNepaliDate(iso, "DD MMM YYYY")} BS, ${format(new Date(iso), "HH:mm")}`;
  } catch (e) {
    return "";
  }
}

export function TaskDiscussion({
  taskId,
  comments,
  mentionableUsers,
  onCommentAdded,
  canComment,
}: TaskDiscussionProps) {
  const { user } = useAuth();
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<{ query: string; index: number } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setNewComment(val);

    // Simple mention detection
    const lastAt = val.lastIndexOf("@");
    if (lastAt !== -1 && (lastAt === 0 || val[lastAt - 1] === " ")) {
      const query = val.substring(lastAt + 1);
      if (!query.includes(" ")) {
        setMentionQuery({ query, index: lastAt });
        return;
      }
    }
    setMentionQuery(null);
  };

  const insertMention = (mentionUser: UserOption) => {
    if (!mentionQuery) return;
    const before = newComment.substring(0, mentionQuery.index);
    const after = newComment.substring(mentionQuery.index + mentionQuery.query.length + 1);
    setNewComment(`${before}@${mentionUser.full_name} ${after}`);
    setMentionQuery(null);
    textareaRef.current?.focus();
  };

  const submitComment = async () => {
    if (!user || !newComment.trim()) return;
    setLoading(true);

    try {
      if (editingId) {
        const { error } = await supabase
          .from("task_comments")
          .update({ comment: newComment.trim(), edited_at: new Date().toISOString() })
          .eq("id", editingId);
        if (error) throw error;
        toast.success("Comment updated");
      } else {
        const { data: insertedComment, error } = await supabase
          .from("task_comments")
          .insert({
            task_id: taskId,
            user_id: user.id,
            comment: newComment.trim(),
            parent_comment_id: replyTo,
          })
          .select("id")
          .single();
        if (error) throw error;

        // Process mentions
        const mentionNames = mentionableUsers.filter((mu) =>
          newComment.includes(`@${mu.full_name}`),
        );
        if (mentionNames.length > 0 && insertedComment) {
          await supabase.from("comment_mentions").insert(
            mentionNames.map((m) => ({
              comment_id: insertedComment.id,
              mentioned_user_id: m.user_id,
            })),
          );

          // Create notifications
          await supabase.from("notifications").insert(
            mentionNames.map((m) => ({
              user_id: m.user_id,
              title: "You were mentioned in a task",
              message: `Someone mentioned you in a comment.`,
              type: "task_mention",
              reference_id: taskId,
            })),
          );
        }

        toast.success("Comment added");
      }
      setNewComment("");
      setReplyTo(null);
      setEditingId(null);
      onCommentAdded();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteComment = async (id: string) => {
    if (!confirm("Delete this comment?")) return;
    const { error } = await supabase.from("task_comments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Comment deleted");
    onCommentAdded();
  };

  const filteredMentions = mentionableUsers.filter((u) =>
    u.full_name.toLowerCase().includes(mentionQuery?.query.toLowerCase() || ""),
  );

  // Group threads
  const threads = comments.filter((c) => !c.parent_comment_id);
  const replies = comments.filter((c) => c.parent_comment_id);

  threads.forEach((t) => {
    t.replies = replies.filter((r) => r.parent_comment_id === t.id);
  });

  const renderComment = (c: TaskComment, isReply = false) => (
    <div key={c.id} className={`flex gap-3 \${isReply ? "mt-3 ml-8" : "mt-4"}`}>
      <Avatar className="h-8 w-8 border border-border mt-1">
        <AvatarImage src={c.avatar_url || ""} />
        <AvatarFallback className="text-[10px]">
          {c.author?.substring(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="rounded-2xl rounded-tl-sm bg-muted/40 p-3 text-sm">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="font-semibold">{c.author}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{formatDate(c.created_at)}</span>
              {c.edited_at && <span className="text-[10px] text-muted-foreground">(edited)</span>}
              {user?.id === c.user_id && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="text-muted-foreground hover:text-foreground transition-colors p-0.5">
                      <MoreVertical size={14} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        setEditingId(c.id);
                        setNewComment(c.comment);
                        setReplyTo(c.parent_comment_id);
                      }}
                    >
                      <Pencil size={14} className="mr-2" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => deleteComment(c.id)}
                    >
                      <Trash2 size={14} className="mr-2" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
          <p className="whitespace-pre-wrap">{c.comment}</p>
        </div>
        {!isReply && canComment && (
          <div className="mt-1 ml-2">
            <button
              onClick={() => {
                setReplyTo(c.id);
                setEditingId(null);
                setNewComment("");
                textareaRef.current?.focus();
              }}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors"
            >
              <Reply size={12} /> Reply
            </button>
          </div>
        )}
        {c.replies?.map((r) => renderComment(r, true))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full max-h-[600px]">
      <div className="flex-1 overflow-y-auto pr-2 space-y-2 mb-4">
        {threads.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No discussions yet. Start the conversation!
          </div>
        ) : (
          threads.map((t) => renderComment(t))
        )}
      </div>

      {canComment && (
        <div className="relative mt-auto border-t border-border pt-3">
          {replyTo && (
            <div className="mb-2 flex items-center justify-between rounded-md bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
              <span>Replying to comment</span>
              <button onClick={() => setReplyTo(null)} className="hover:text-foreground">
                Cancel
              </button>
            </div>
          )}
          {editingId && (
            <div className="mb-2 flex items-center justify-between rounded-md bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
              <span>Editing comment</span>
              <button
                onClick={() => {
                  setEditingId(null);
                  setNewComment("");
                }}
                className="hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          )}

          {mentionQuery && filteredMentions.length > 0 && (
            <div className="absolute bottom-full left-0 mb-1 w-64 rounded-md border border-border bg-popover p-1 shadow-md z-10">
              {filteredMentions.map((mu) => (
                <button
                  key={mu.user_id}
                  onClick={() => insertMention(mu)}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent text-left"
                >
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className="text-[8px]">
                      {mu.full_name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate">{mu.full_name}</span>
                </button>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2">
            <div className="flex-1 rounded-xl border border-input bg-background focus-within:ring-1 focus-within:ring-ring p-1">
              <Textarea
                ref={textareaRef}
                value={newComment}
                onChange={handleInputChange}
                placeholder="Write a comment... type @ to mention"
                className="min-h-[60px] resize-none border-0 focus-visible:ring-0 px-3 py-2 text-sm shadow-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submitComment();
                  }
                }}
              />
              <div className="flex justify-between items-center px-2 pb-1">
                <button className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-muted">
                  <Paperclip size={16} />
                </button>
                <div className="text-[10px] text-muted-foreground">Press Enter to send</div>
              </div>
            </div>
            <Button
              onClick={submitComment}
              disabled={loading || !newComment.trim()}
              size="icon"
              className="h-10 w-10 shrink-0 rounded-full neon-button"
            >
              <Send size={16} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
