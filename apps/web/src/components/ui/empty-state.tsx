import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 space-y-4 text-center",
        className,
      )}
    >
      <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20">
        <Icon className="w-7 h-7 text-primary" />
      </div>
      <div className="space-y-1">
        <h3 className="text-heading text-foreground">{title}</h3>
        {description && (
          <p className="text-label text-muted-foreground max-w-xs">
            {description}
          </p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

export { EmptyState };
