import { Link } from "react-router-dom";
import { truncateId } from "@/lib/utils";

interface EntityLinkProps {
  id: string;
  name?: string;
  className?: string;
}

export function EntityLink({ id, name, className }: EntityLinkProps) {
  return (
    <Link
      to={`/entities/${encodeURIComponent(id)}`}
      className={`text-sm font-medium text-primary hover:underline ${className ?? ""}`}
      title={id}
    >
      {name || truncateId(id)}
    </Link>
  );
}
