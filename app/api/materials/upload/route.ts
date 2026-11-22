import { bodyBytes, failure, session } from "@/lib/api";
import { maxBytes } from "@/lib/documents";
import { uploadMaterial } from "@/lib/materials";
import { StudyError } from "@/lib/study";
export async function POST(request: Request) {
  try {
    const { db, uid } = await session(request);
    const bytes = await bodyBytes(request, maxBytes() + 65536);
    const form = await new Response(new Uint8Array(bytes), {
      headers: { "Content-Type": request.headers.get("Content-Type") ?? "" },
    }).formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new StudyError("Choose a file.");
    return Response.json(
      await uploadMaterial(db, uid, String(form.get("subject") ?? ""), file),
      { status: 201 },
    );
  } catch (e) {
    return failure(e);
  }
}
