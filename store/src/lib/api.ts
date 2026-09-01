import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getAdminUser } from "@/lib/auth";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function corsHeaders(req: Request): Record<string, string> {
  const allowed = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const origin = req.headers.get("origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
  if (allowed.includes("*")) {
    headers["Access-Control-Allow-Origin"] = "*";
  } else if (origin && allowed.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  }
  return headers;
}

/** JSON response with CORS headers applied. Use this for every route response. */
export function json(req: Request, data: unknown, init: number | ResponseInit = 200) {
  const responseInit = typeof init === "number" ? { status: init } : init;
  return NextResponse.json(data, {
    ...responseInit,
    headers: { ...corsHeaders(req), ...(responseInit.headers ?? {}) },
  });
}

/** Standard OPTIONS preflight handler — re-export as `export const OPTIONS = preflight` per route. */
export function preflight(req: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

/** Uniform error → response mapping, including Zod validation errors. */
export function errorJson(req: Request, err: unknown) {
  if (err instanceof ApiError) return json(req, { error: err.message }, err.status);
  if (err instanceof ZodError) {
    return json(req, { error: "Invalid request", issues: err.flatten() }, 400);
  }
  console.error(err);
  return json(req, { error: "Internal server error" }, 500);
}

/** Parses and validates a JSON body against a zod schema, throwing ApiError(400) on malformed JSON. */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ApiError(400, "Request body must be valid JSON");
  }
}

/** Throws ApiError(401) unless the caller is a signed-in, allow-listed admin. Returns the admin otherwise. */
export async function requireAdmin() {
  const admin = await getAdminUser();
  if (!admin) throw new ApiError(401, "Admin authentication required");
  return admin;
}
