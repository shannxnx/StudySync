"use client";
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter, useSelectedLayoutSegment } from "next/navigation";
import type { Library, LibraryStreams, Note } from "@/lib/study";

type Part = Exclude<keyof Library, "profile">;
const all: Part[] = [
  "subjects",
  "materials",
  "notes",
  "reviewers",
  "quizzes",
  "attempts",
];
const empty: never[] = [];
type NoteChange = Pick<Note, "id" | "title" | "revision" | "updated_at">;
const Data = createContext<LibraryStreams | null>(null);
const noChanges: ReadonlyMap<string, NoteChange> = new Map();
const Changes = createContext(noChanges);
const Save = createContext<((note: NoteChange) => void) | null>(null);

export function LibraryProvider({
  streams,
  children,
}: {
  streams: LibraryStreams;
  children: ReactNode;
}) {
  const router = useRouter();
  const segment = useSelectedLayoutSegment();
  const [pending, startTransition] = useTransition();
  const refreshed = useRef(0);
  const [changes, setChanges] = useState(new Map<string, NoteChange>());
  const save = useCallback(
    (note: NoteChange) =>
      setChanges((previous) => {
        if ((previous.get(note.id)?.revision ?? -1) >= note.revision)
          return previous;
        return new Map(previous).set(note.id, note);
      }),
    [],
  );
  useEffect(() => {
    refreshed.current = Date.now();
  }, [streams]);
  useEffect(() => {
    function revalidate() {
      if (
        pending ||
        document.visibilityState !== "visible" ||
        Date.now() - refreshed.current < 60000
      )
        return;
      refreshed.current = Date.now();
      startTransition(() => router.refresh());
    }
    window.addEventListener("focus", revalidate);
    document.addEventListener("visibilitychange", revalidate);
    window.addEventListener("online", revalidate);
    revalidate();
    return () => {
      window.removeEventListener("focus", revalidate);
      document.removeEventListener("visibilitychange", revalidate);
      window.removeEventListener("online", revalidate);
    };
  }, [router, pending, segment]);
  return (
    <Data.Provider value={streams}>
      <Save.Provider value={save}>
        <Changes.Provider value={changes}>{children}</Changes.Provider>
      </Save.Provider>
    </Data.Provider>
  );
}

export function useNoteSaved() {
  return use(Save)!;
}

// React's use() can read a promise conditionally. A slow, unrelated collection
// therefore doesn't hold up a settings screen or an already available list.
export function useLibrary(parts: readonly Part[] = all): Library {
  const streams = use(Data)!;
  const changes = parts.includes("notes") ? use(Changes) : noChanges;
  const profile = use(streams.profile);
  const subjects = parts.includes("subjects") ? use(streams.subjects) : empty;
  const materials = parts.includes("materials")
    ? use(streams.materials)
    : empty;
  const rawNotes = parts.includes("notes") ? use(streams.notes) : empty;
  const reviewers = parts.includes("reviewers")
    ? use(streams.reviewers)
    : empty;
  const quizzes = parts.includes("quizzes") ? use(streams.quizzes) : empty;
  const attempts = parts.includes("attempts") ? use(streams.attempts) : empty;
  return useMemo(() => {
    const notes =
      changes.size && rawNotes.length
        ? rawNotes.map((note) => {
            const change = changes.get(note.id);
            return change && change.revision > note.revision
              ? { ...note, ...change }
              : note;
          })
        : rawNotes;
    return {
      profile,
      subjects,
      materials,
      notes,
      reviewers,
      quizzes,
      attempts,
    };
  }, [
    profile,
    subjects,
    materials,
    rawNotes,
    reviewers,
    quizzes,
    attempts,
    changes,
  ]);
}
