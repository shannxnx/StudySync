import { Suspense, type ReactNode } from "react";
import { WorkspaceShell } from "@/components/workspace-shell";
import { LibraryProvider } from "@/components/workspace-library";
import { ShellSkeleton } from "@/components/workspace-skeleton";
import { getWorkspaceSession } from "@/lib/workspace-data";
import { streamLibrary } from "@/lib/library";

async function DashboardFrame({ children }: { children: ReactNode }) {
  const { db, user } = await getWorkspaceSession();
  return (
    <LibraryProvider key={user.id} streams={streamLibrary(db, user)}>
      <WorkspaceShell>{children}</WorkspaceShell>
    </LibraryProvider>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <DashboardFrame>{children}</DashboardFrame>
    </Suspense>
  );
}
