import { notFound } from "next/navigation";
import { getWorkspaceData } from "@/lib/workspace-data";
import { detailFor } from "@/lib/library";
import { Workspace } from "@/components/workspace";
import { z } from "zod";
import type { Detail } from "@/lib/study";
type Props = PageProps<"/dashboard/[[...path]]">;
export default async function Page({ params, searchParams }: Props) {
  const [{ db, user, library }, route, query] = await Promise.all([
    getWorkspaceData(),
    params,
    searchParams,
  ]);
  const [area = "dashboard", id, results, attempt, ...extra] = route.path ?? [];
  if (
    ![
      "dashboard",
      "subjects",
      "materials",
      "notes",
      "reviewers",
      "quizzes",
      "settings",
    ].includes(area) ||
    extra.length ||
    ((area === "settings" || area === "dashboard") && id)
  )
    notFound();
  let detail: Detail = {};
  if (id) {
    if (
      !z.uuid().safeParse(id).success ||
      !(
        area === "subjects" ||
        area === "materials" ||
        area === "notes" ||
        area === "quizzes" ||
        area === "reviewers"
      )
    )
      notFound();
    if (!library[area].some((row) => row.id === id)) notFound();
    if (
      results &&
      (area !== "quizzes" ||
        results !== "results" ||
        !library.attempts.some((a) => a.id === attempt && a.quiz_id === id))
    )
      notFound();
    detail = await detailFor(db, user.id, area, id, attempt);
  }
  return (
    <Workspace
      key={[area, id, attempt].join("/")}
      library={library}
      area={area}
      id={id}
      attempt={attempt}
      detail={detail}
      tab={typeof query.tab === "string" ? query.tab : "overview"}
    />
  );
}
