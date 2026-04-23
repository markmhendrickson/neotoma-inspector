import { Link } from "react-router-dom";
import { EntityLink } from "@/components/shared/entity_link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { relativeTime, shortId, truncate } from "@/lib/humanize";
import type { RecentConversationItem } from "@/types/api";

interface RecentConversationsFeedProps {
  conversations: RecentConversationItem[];
  emptyMessage?: string;
  compact?: boolean;
  showViewAll?: boolean;
}

function conversationLabel(c: RecentConversationItem): string {
  const raw = c.title?.trim() || c.canonical_name?.trim();
  if (raw) return truncate(raw, 80);
  return `Conversation ${shortId(c.conversation_id, 8)}`;
}

export function RecentConversationsFeed({
  conversations,
  emptyMessage = "No conversations yet.",
  compact = false,
  showViewAll = false,
}: RecentConversationsFeedProps) {
  if (conversations.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className={cn("space-y-3", compact && "space-y-1")}>
      <div className="space-y-1">
        {conversations.map((c) => {
          const label = conversationLabel(c);
          return (
            <div
              key={c.conversation_id}
              className={cn(
                "flex items-start gap-3 rounded-md transition-colors hover:bg-muted/50",
                compact ? "px-1 py-1" : "px-3 py-2"
              )}
            >
              <span
                className={cn(
                  "shrink-0 text-right font-mono text-muted-foreground tabular-nums",
                  compact ? "w-12 text-xs" : "w-16 text-sm"
                )}
              >
                {relativeTime(c.activity_at)}
              </span>
              <div className="min-w-0 flex-1">
                <EntityLink
                  id={c.conversation_id}
                  name={label}
                  className={cn("font-medium hover:underline", compact ? "text-xs" : "text-sm")}
                />
                <div
                  className={cn(
                    "mt-0.5 text-muted-foreground",
                    compact ? "text-xs" : "text-sm"
                  )}
                >
                  {c.message_count} {c.message_count === 1 ? "message" : "messages"}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showViewAll ? (
        <Link to="/conversations" className={buttonVariants({ variant: "outline", size: "sm" })}>
          View all conversations
        </Link>
      ) : null}
    </div>
  );
}
