import { Suspense } from "react";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Workspace, DetailPreview } from "@/components/workspace";
import { getWorkspaceSession } from "@/lib/workspace-data";
import { loadItem } from "@/lib/library";
import type { ItemKind } from "@/lib/study";

async function Item({
  area,
  id,
  attempt,
}: {
  area: ItemKind;
  id: string;
  attempt?: string;
}) {
  const { db, user } = await getWorkspaceSession();
  const item = await loadItem(db, user.id, area, id, attempt);
  return (
    <Workspace
      key={[area, id, attempt].join("/")}
      area={area}
      id={id}
      attempt={attempt}
      {...item}
    />
  );
}

export default async function Page({
  params,
}: PageProps<"/dashboard/[...path]">) {
  const { path } = await params;
  const [area, id, results, attempt] = path;
  if (area === "dashboard" && path.length === 1)
    return <Workspace area="dashboard" />;
  if (
    !["subjects", "materials", "notes", "reviewers", "quizzes"].includes(
      area,
    ) ||
    !z.uuid().safeParse(id).success ||
    !(
      path.length === 2 ||
      (path.length === 4 &&
        area === "quizzes" &&
        results === "results" &&
        z.uuid().safeParse(attempt).success)
    )
  )
    notFound();
  const kind = area as ItemKind;
  return (
    <Suspense
      key={path.join("/")}
      fallback={<DetailPreview area={kind} id={id} />}
    >
      <Item area={kind} id={id} attempt={attempt} />
    </Suspense>
  );
}
