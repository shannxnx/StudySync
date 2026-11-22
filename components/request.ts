export async function api<T = { ok: boolean }>(
  action: string,
  input: unknown,
): Promise<T> {
  const response = await fetch("/api/workspace/" + action, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const result = await response
    .json()
    .catch(() => ({ error: "The server could not complete the request." }));
  if (!response.ok) throw new Error(result.error || "Request failed.");
  return result as T;
}
export const message = (error: unknown) =>
  error instanceof Error ? error.message : "Unable to complete this request.";
