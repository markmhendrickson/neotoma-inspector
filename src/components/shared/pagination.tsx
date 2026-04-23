import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  offset: number;
  limit: number;
  total: number;
  onPageChange: (newOffset: number) => void;
}

export function Pagination({ offset, limit, total, onPageChange }: PaginationProps) {
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-muted-foreground">
        Showing {offset + 1}–{Math.min(offset + limit, total)} of {total.toLocaleString()}
      </p>
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                variant="outline"
                size="sm"
                disabled={offset === 0}
                onClick={() => onPageChange(Math.max(0, offset - limit))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Previous page</TooltipContent>
        </Tooltip>
        <span className="text-sm text-muted-foreground">
          {currentPage} / {totalPages}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                variant="outline"
                size="sm"
                disabled={offset + limit >= total}
                onClick={() => onPageChange(offset + limit)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Next page</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
