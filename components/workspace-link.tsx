"use client";
import Link, { useLinkStatus } from "next/link";
import type { ComponentProps } from "react";

function PendingLink() {
  const { pending } = useLinkStatus();
  return pending ? (
    <i
      className="nav-pending"
      data-pending
      role="status"
      aria-label="Opening page"
    />
  ) : null;
}

export default function WorkspaceLink({
  children,
  ...props
}: ComponentProps<typeof Link>) {
  return (
    <Link {...props}>
      {children}
      <PendingLink />
    </Link>
  );
}
