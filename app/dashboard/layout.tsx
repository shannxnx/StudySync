import { Suspense, type ReactNode } from "react";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getWorkspaceData } from "@/lib/workspace-data";

async function DashboardFrame({ children }: { children: ReactNode }) {
  const { library } = await getWorkspaceData();
  return (
    <WorkspaceShell library={library}>
      <Suspense
        fallback={
          <div
            className="section-pending"
            role="status"
            aria-label="Loading section"
          />
        }
      >
        {children}
      </Suspense>
    </WorkspaceShell>
  );
}
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <DashboardFrame>{children}</DashboardFrame>
    </Suspense>
  );
}
