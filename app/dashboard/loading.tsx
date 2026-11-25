"use client";
import { usePathname } from "next/navigation";
import { WorkspaceSkeleton } from "@/components/workspace-skeleton";

export default function Loading() {
  const [, , area, id] = usePathname().split("/");
  return <WorkspaceSkeleton area={area ?? "dashboard"} detail={Boolean(id)} />;
}
