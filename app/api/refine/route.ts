import { refineReadme } from "@/lib/ai";
import type { ProjectUnderstanding } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  let body: {
    markdown?: string;
    instruction?: string;
    understanding?: ProjectUnderstanding;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { markdown, instruction, understanding } = body;
  if (!markdown || !instruction || !understanding) {
    return Response.json(
      { error: "markdown, instruction, and understanding are all required." },
      { status: 400 }
    );
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "Server is missing ANTHROPIC_API_KEY. See .env.example." },
      { status: 500 }
    );
  }

  try {
    const revised = await refineReadme(markdown, instruction, understanding);
    return Response.json({ markdown: revised });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Refinement failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
