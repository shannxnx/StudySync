"use client";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useSelectedLayoutSegment, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  NotebookPen,
  Layers,
  ListChecks,
  Settings,
  Menu,
  PanelLeftClose,
  Search,
  SunMoon,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { Brand } from "./brand";
import { createClient } from "@/lib/supabase/client";
import { message } from "./request";
import { Modal } from "./forms";
import { entries, names, icons, type Category } from "./collections";
import { useThemePreference, setThemePreference } from "./theme-preference";
import type { Library } from "@/lib/study";
const nav = {
  dashboard: LayoutDashboard,
  subjects: BookOpen,
  materials: FileText,
  notes: NotebookPen,
  reviewers: Layers,
  quizzes: ListChecks,
  settings: Settings,
};
export function WorkspaceShell({
  library: l,
  children,
}: {
  library: Library;
  children: ReactNode;
}) {
  const router = useRouter();
  const segment = useSelectedLayoutSegment();
  const section = (segment?.split("/")[0] || "dashboard") as keyof typeof nav;
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [search, setSearch] = useState<string | null>(null);
  const preference = useThemePreference();
  function theme() {
    const dark =
      preference === "dark" ||
      (preference === "system" &&
        matchMedia("(prefers-color-scheme: dark)").matches);
    setThemePreference(dark ? "light" : "dark");
  }
  async function signOut() {
    try {
      const { error } = await createClient().auth.signOut({ scope: "local" });
      if (error) throw error;
      router.replace("/login");
      router.refresh();
    } catch (e) {
      toast.error(message(e));
    }
  }
  const searchRows =
    search === null
      ? []
      : (Object.keys(icons) as Category[])
          .flatMap((k) => entries(l, k).map((r) => ({ ...r, kind: k })))
          .filter((r) =>
            (r.title + " " + r.description)
              .toLowerCase()
              .includes(search.toLowerCase()),
          )
          .slice(0, 30);
  return (
    <div
      className={
        "workspace " +
        (collapsed ? "collapsed " : "") +
        (mobile ? "mobile-open" : "")
      }
    >
      {mobile && (
        <button
          className="scrim"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside>
        <Brand />
        <nav aria-label="Workspace navigation">
          {(Object.keys(nav) as (keyof typeof nav)[]).map((k) => {
            const Icon = nav[k];
            return (
              <Link
                title={names[k]}
                key={k}
                aria-current={section === k ? "page" : undefined}
                href={k === "dashboard" ? "/dashboard" : "/dashboard/" + k}
                onClick={() => setMobile(false)}
              >
                <Icon size={18} />
                <span>{names[k]}</span>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-foot">
          <Link
            href="/dashboard/settings"
            className="identity"
            onClick={() => setMobile(false)}
          >
            <i>
              {(l.profile.full_name || l.profile.email)
                .slice(0, 1)
                .toUpperCase()}
            </i>
            <span>{l.profile.full_name || l.profile.email}</span>
          </Link>
          <button className="nav-action" onClick={signOut}>
            <LogOut size={17} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <div className="row">
            <button
              className="icon-btn desktop-menu"
              aria-label="Toggle sidebar"
              onClick={() => setCollapsed((v) => !v)}
            >
              <PanelLeftClose size={18} />
            </button>
            <button
              className="icon-btn mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={20} />
            </button>
            <Link href="/dashboard">Workspace</Link>
            <ChevronRight size={13} />
            <span>{names[section]}</span>
          </div>
          <div className="row">
            <button
              className="icon-btn"
              aria-label="Search workspace"
              onClick={() => setSearch("")}
            >
              <Search size={18} />
            </button>
            <button
              className="icon-btn"
              aria-label="Toggle color theme"
              onClick={theme}
            >
              <SunMoon size={18} />
            </button>
            <Link
              href="/dashboard/settings"
              className="avatar"
              aria-label="Account settings"
            >
              {(l.profile.full_name || l.profile.email)[0]?.toUpperCase()}
            </Link>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
      {search !== null && (
        <Modal title="Search workspace" onClose={() => setSearch(null)}>
          <input
            autoFocus
            aria-label="Search all items"
            placeholder="Search subjects, materials, notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="search-results">
            {searchRows.map((r) => (
              <Link
                className="list-row"
                key={r.id}
                onClick={() => setSearch(null)}
                href={"/dashboard/" + r.kind + "/" + r.id}
              >
                <strong>{r.title}</strong>
                <small>{names[r.kind]}</small>
              </Link>
            ))}
            {!searchRows.length && <p>No matching items.</p>}
          </div>
        </Modal>
      )}
    </div>
  );
}
