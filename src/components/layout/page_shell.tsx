import { ReactNode } from "react";

interface PageShellProps {
  title: string;
  /** Optional icon or glyph rendered to the left of the title (e.g. page-specific Lucide icon). */
  titleIcon?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

export function PageShell({ title, titleIcon, description, actions, children }: PageShellProps) {
  return (
    <div className="flex-1 space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {titleIcon ? (
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex shrink-0 text-muted-foreground [&_svg]:block">{titleIcon}</span>
              <h1 className="min-w-0 text-2xl font-bold tracking-tight">{title}</h1>
            </div>
          ) : (
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          )}
          {description ? (
            typeof description === "string" ? (
              <p className="text-muted-foreground mt-1">{description}</p>
            ) : (
              <div className="text-muted-foreground mt-1">{description}</div>
            )
          ) : null}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
