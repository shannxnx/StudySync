import Link from "next/link";
import { Layers } from "lucide-react";
export function Brand() {
  return (
    <Link className="brand" href="/" aria-label="StudySync home">
      <span>
        <Layers size={21} strokeWidth={2.3} />
      </span>
      StudySync
    </Link>
  );
}
