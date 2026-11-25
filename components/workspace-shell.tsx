"use client";
import Link from "./workspace-link";
import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
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
import { useLibrary } from "./workspace-library";
import { WorkspaceSkeleton } from "./workspace-skeleton";
const nav = {
  dashboard: LayoutDashboard,
  subjects: BookOpen,
  materials: FileText,
  notes: NotebookPen,
  reviewers: Layers,
  quizzes: ListChecks,
  settings: Settings,
};
function SearchResults({
  search,
  close,
}: {
  search: string;
  close: () => void;
}) {
  const library = useLibrary();
  const index = useMemo(
    () =>
      (Object.keys(icons) as Category[]).flatMap((kind) =>
        entries(library, kind).map((row) => ({
          ...row,
          kind,
          terms: (row.title + " " + row.description).toLowerCase(),
        })),
      ),
    [library],
  );
  const term = search.trim().toLowerCase();
  const rows = index.filter((row) => row.terms.includes(term)).slice(0, 30);
  return (
    <div className="search-results">
      {rows.map((row) => (
        <Link
          className="list-row"
          key={row.id}
          onNavigate={close}
          href={"/dashboard/" + row.kind + "/" + row.id}
        >
          <strong>{row.title}</strong>
          <small>{names[row.kind]}</small>
        </Link>
      ))}
      {!rows.length && <p>No matching items.</p>}
    </div>
  );
}

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { profile } = useLibrary([]);
  const menu = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);
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
  useEffect(() => {
    if (!mobile) return;
    const drawer = sidebar.current!;
    drawer.querySelector<HTMLElement>('a[aria-current="page"]')?.focus();
    const desktop = matchMedia("(min-width: 801px)");
    const resize = () => {
      if (desktop.matches) setMobile(false);
    };
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobile(false);
        menu.current?.focus();
      }
      if (event.key !== "Tab") return;
      const links = drawer.querySelectorAll<HTMLElement>(
        "a[href], button:not(:disabled)",
      );
      const first = links[0],
        last = links[links.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", keydown);
    desktop.addEventListener("change", resize);
    return () => {
      document.removeEventListener("keydown", keydown);
      desktop.removeEventListener("change", resize);
    };
  }, [mobile]);
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
      <aside ref={sidebar} id="workspace-sidebar">
        <Brand />
        <nav aria-label="Workspace navigation">
          {(Object.keys(nav) as (keyof typeof nav)[]).map((k) => {
            const Icon = nav[k];
            return (
              <Link
                title={names[k]}
                prefetch={true}
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
              {(profile.full_name || profile.email).slice(0, 1).toUpperCase()}
            </i>
            <span>{profile.full_name || profile.email}</span>
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
              ref={menu}
              aria-expanded={mobile}
              aria-controls="workspace-sidebar"
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
              {(profile.full_name || profile.email)[0]?.toUpperCase()}
            </Link>
          </div>
        </header>
        <main className="content" id="workspace-content">
          <Suspense fallback={<WorkspaceSkeleton area={section} />}>
            {children}
          </Suspense>
        </main>
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
          <Suspense fallback={<WorkspaceSkeleton area="notes" />}>
            <SearchResults search={search} close={() => setSearch(null)} />
          </Suspense>
        </Modal>
      )}
    </div>
  );
}
