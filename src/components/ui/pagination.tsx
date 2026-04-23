import * as React from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";

const Pagination = ({ className, ...props }: React.ComponentProps<"nav">) => (
  <nav role="navigation" aria-label="Pagination" className={cn("mx-auto flex w-full justify-center", className)} {...props} />
);
Pagination.displayName = "Pagination";

const PaginationContent = React.forwardRef<HTMLUListElement, React.ComponentProps<"ul">>(
  ({ className, ...props }, ref) => (
    <ul ref={ref} className={cn("flex flex-row items-center gap-1", className)} {...props} />
  )
);
PaginationContent.displayName = "PaginationContent";

const PaginationItem = React.forwardRef<HTMLLIElement, React.ComponentProps<"li">>(
  ({ className, ...props }, ref) => <li ref={ref} className={cn("", className)} {...props} />
);
PaginationItem.displayName = "PaginationItem";

type PaginationLinkProps = {
  isActive?: boolean;
} & Pick<React.ComponentProps<typeof Button>, "size"> &
  React.ComponentProps<"a">;

function PaginationLink({ className, isActive, size = "icon", ...props }: PaginationLinkProps) {
  return (
    <a
      aria-current={isActive ? "page" : undefined}
      className={cn(
        buttonVariants({
          variant: isActive ? "outline" : "ghost",
          size,
        }),
        className
      )}
      {...props}
    />
  );
}
PaginationLink.displayName = "PaginationLink";

type PaginationButtonProps = React.ComponentProps<typeof Button>;

const PaginationPrevious = React.forwardRef<HTMLButtonElement, PaginationButtonProps>(
  ({ className, size = "sm", variant = "outline", children, ...props }, ref) => (
    <Button
      ref={ref}
      aria-label="Go to previous page"
      variant={variant}
      size={size}
      className={cn("gap-1", className)}
      {...props}
    >
      <ChevronLeft className="h-4 w-4" />
      {size === "icon"
        ? children
        : (children ?? <span className="hidden sm:inline">Previous</span>)}
    </Button>
  )
);
PaginationPrevious.displayName = "PaginationPrevious";

const PaginationNext = React.forwardRef<HTMLButtonElement, PaginationButtonProps>(
  ({ className, size = "sm", variant = "outline", children, ...props }, ref) => (
    <Button
      ref={ref}
      aria-label="Go to next page"
      variant={variant}
      size={size}
      className={cn("gap-1", className)}
      {...props}
    >
      {size === "icon" ? children : (children ?? <span className="hidden sm:inline">Next</span>)}
      <ChevronRight className="h-4 w-4" />
    </Button>
  )
);
PaginationNext.displayName = "PaginationNext";

const PaginationEllipsis = ({ className, ...props }: React.ComponentProps<"span">) => (
  <span
    aria-hidden
    className={cn("flex h-9 w-9 items-center justify-center", className)}
    {...props}
  >
    <MoreHorizontal className="h-4 w-4" />
    <span className="sr-only">More pages</span>
  </span>
);
PaginationEllipsis.displayName = "PaginationEllipsis";

export { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationPrevious, PaginationNext, PaginationEllipsis };
