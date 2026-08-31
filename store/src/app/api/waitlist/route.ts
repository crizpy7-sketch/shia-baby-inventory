import { createAdminClient } from "@/lib/supabase/admin";
import { json, errorJson, preflight, readJson } from "@/lib/api";
import { waitlistSchema } from "@/lib/validation";
import { sendWaitlistWelcomeEmail } from "@/lib/email";

export const OPTIONS = preflight;

/** POST /api/waitlist — powers the Founding Families signup form. */
export async function POST(req: Request) {
  try {
    const body = waitlistSchema.parse(await readJson(req));
    const admin = createAdminClient();

    const { error } = await admin
      .from("waitlist_signups")
      .upsert(
        { email: body.email, role: body.role ?? null, source: body.source ?? "website" },
        { onConflict: "email", ignoreDuplicates: true }
      );
    if (error) throw error;

    await sendWaitlistWelcomeEmail(body.email);

    return json(req, { ok: true }, 201);
  } catch (err) {
    return errorJson(req, err);
  }
}
