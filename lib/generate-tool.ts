import "server-only";
import { allRows, type DB } from "./library";
import { generateStudy, type Source } from "./generation";
import { callGemini } from "./gemini";
import { StudyError, checkDb, type Generation } from "./study";
export async function generateTool(db: DB, uid: string, input: Generation) {
  if (!process.env.GEMINI_API_KEY)
    throw new StudyError(
      "Add GEMINI_API_KEY to the server environment to enable generation.",
      503,
    );
  const source: Source[] = [];
  const materials = [...new Set(input.materials)],
    notes = [...new Set(input.notes)];
  const materialRows = materials.length
    ? await db
        .from("materials")
        .select("id,filename")
        .eq("user_id", uid)
        .eq("subject_id", input.subject)
        .eq("status", "completed")
        .in("id", materials)
    : { data: [], error: null };
  const noteRows = notes.length
    ? await db
        .from("notes")
        .select("id,title,plain_text")
        .eq("user_id", uid)
        .eq("subject_id", input.subject)
        .in("id", notes)
    : { data: [], error: null };
  checkDb(materialRows.error);
  checkDb(noteRows.error);
  if (
    materialRows.data!.length !== materials.length ||
    noteRows.data!.length !== notes.length
  )
    throw new StudyError(
      "One or more sources are unavailable for this subject.",
      404,
    );
  if (materials.length) {
    const chunks = await allRows<{
      material_id: string;
      reference: string;
      body: string;
    }>((a, b) =>
      db
        .from("material_chunks")
        .select("material_id,reference,body")
        .eq("subject_id", input.subject)
        .eq("user_id", uid)
        .in("material_id", materials)
        .order("material_id")
        .order("position")
        .range(a, b),
    );
    const names = new Map(materialRows.data!.map((v) => [v.id, v.filename]));
    for (const c of chunks)
      source.push({
        group: c.material_id,
        label: names.get(c.material_id) + " · " + c.reference,
        text: c.body,
      });
  }
  for (const n of noteRows.data!) {
    if (!n.plain_text.trim())
      throw new StudyError("The selected note “" + n.title + "” is empty.");
    for (let i = 0; i < n.plain_text.length; i += 3500)
      source.push({
        group: n.id,
        label: n.title + " · Note, section " + (Math.floor(i / 3500) + 1),
        text: n.plain_text.slice(i, i + 3500),
      });
  }
  const reserve = await db.rpc("reserve_generation", { p_request: input.id });
  checkDb(reserve.error);
  if (!reserve.data)
    throw new StudyError(
      "This request is already running or the generation limit was reached. Try again later.",
      429,
    );
  const result = await generateStudy(input, source, callGemini);
  const saved = await db.rpc("save_generation", {
    p_id: input.id,
    p_kind: input.kind,
    p_subject: input.subject,
    p_data: result,
    p_materials: materials,
    p_notes: notes,
  });
  checkDb(saved.error);
  return { id: input.id };
}
