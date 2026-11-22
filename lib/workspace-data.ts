import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { loadLibrary } from "./library";

// The layout and page share this read within a single server request.
export const getWorkspaceData = cache(async () => {
  await connection();
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");
  return { db, user, library: await loadLibrary(db, user) };
});
