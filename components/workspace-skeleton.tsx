import { Brand } from "./brand";

export function WorkspaceSkeleton({
  area = "dashboard",
  detail = false,
  title,
}: {
  area?: string;
  detail?: boolean;
  title?: string;
}) {
  const cards = !detail && (area === "dashboard" || area === "subjects");
  return (
    <div
      className="workspace-placeholder"
      role="status"
      aria-busy="true"
      aria-label={title ? "Loading " + title : "Loading workspace content"}
    >
      {title ? (
        <h1>{title}</h1>
      ) : (
        <div className="skeleton-bar skeleton-heading" aria-hidden />
      )}
      {area === "dashboard" && !detail && (
        <div className="stats" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton-stat" />
          ))}
        </div>
      )}
      {!detail &&
        ["subjects", "notes", "quizzes", "materials", "reviewers"].includes(
          area,
        ) && (
          <div className="skeleton-filters" aria-hidden>
            <i />
            <i />
          </div>
        )}
      {detail && area === "subjects" && (
        <div className="skeleton-bar skeleton-tabs" aria-hidden />
      )}
      {area === "settings" && !detail ? (
        <div className="skeleton-settings" aria-hidden>
          <div className="skeleton-surface reader-placeholder" />
          <div className="skeleton-surface reader-placeholder" />
        </div>
      ) : cards ? (
        <div className="cards" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton-card">
              <div className="skeleton-bar" />
              <div className="skeleton-bar" />
              <div className="skeleton-bar" />
            </div>
          ))}
        </div>
      ) : (
        <div
          className={
            "skeleton-surface " +
            (detail || area === "settings"
              ? "reader-placeholder"
              : "list-placeholder")
          }
          aria-hidden
        >
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton-line">
              <i className="skeleton-bar" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ShellSkeleton() {
  return (
    <div className="workspace">
      <aside aria-hidden inert>
        <Brand />
        <div className="skeleton-nav">
          {Array.from({ length: 7 }, (_, i) => (
            <i key={i} className="skeleton-bar" />
          ))}
        </div>
      </aside>
      <div className="main-column">
        <div className="topbar" aria-hidden />
        <main className="content">
          <WorkspaceSkeleton />
        </main>
      </div>
    </div>
  );
}
