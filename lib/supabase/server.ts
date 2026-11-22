import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(updates) {
          try {
            for (const { name, value, options } of updates) {
              cookieStore.set(name, value, options);
            }
          } catch (error) {
            // Server Components read cookies. The proxy persists refreshes for them.
            if (
              !(error instanceof Error) ||
              !error.message.startsWith("Cookies can only be modified")
            ) {
              throw error;
            }
          }
        },
      },
    },
  );
}
