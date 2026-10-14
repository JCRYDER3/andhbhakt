// AI extraction agent, ported from jan-score's src/lib/ingestion/ai-extract.ts
// (Prisma -> Drizzle). This IS idea #7 (docs/jan-score-ideas.md): the
// system prompt explicitly forbids treating an unproven allegation as a
// finding of guilt.
//
// This never writes directly to a score. It always creates Evidence with
// needsReview=true, so a moderator must approve it via the review queue
// (idea #2, already merged) before recomputeRepresentativeScore() will
// include it. The model is also instructed to never claim VERIFIED status
// without the text itself citing a primary document/ruling.
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod/v4";
import { db, evidenceTable } from "@workspace/db";
import { logger } from "../lib/logger";

const extractionSchema = z.object({
  claims: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      dimension: z.enum(["ACCOUNTABILITY", "DELIVERY", "TRANSPARENCY", "INTEGRITY", "CITIZEN_SENTIMENT"]),
      abcxyzLetter: z.string().length(1).optional(),
      suggestedRawScore: z.number().min(0).max(100),
      claimStatus: z.enum(["VERIFIED", "PARTIALLY_VERIFIED", "UNVERIFIED", "DISPUTED", "FALSE", "ALLEGATION", "UNDER_INVESTIGATION"]),
      confidence: z.number().min(0).max(1),
    })
  ),
});

const SYSTEM_PROMPT = `You are a fact-extraction agent for a civic-accountability platform. You read a
raw text passage (news article, press release, report excerpt) about a named public
representative and extract discrete, checkable claims relevant to their public duties.

Rules:
- Never assert guilt or corruption from an allegation. If the text only reports an
  accusation with no charge/conviction, claimStatus must be "ALLEGATION" or
  "UNDER_INVESTIGATION", and suggestedRawScore must stay >= 40 (i.e. don't tank a
  score over an unproven claim).
- Only use "VERIFIED" if the text itself cites an official document, ruling, or
  primary record — not just "sources say".
- Ignore claims unrelated to the person's public office responsibilities.
- Output strictly matches the provided JSON schema. If you find nothing extractable,
  return an empty claims array.`;

export interface ExtractionInput {
  representativeId: number;
  representativeName: string;
  sourceId: number;
  rawText: string;
}

export async function extractClaimsWithAI(input: ExtractionInput): Promise<{ created: number; error?: string }> {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) {
    return { created: 0, error: "ANTHROPIC_API_KEY not configured — AI extraction skipped." };
  }

  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: `Representative: ${input.representativeName}\n\nText:\n${input.rawText.slice(0, 12000)}` }],
    tools: [
      {
        name: "submit_claims",
        description: "Submit extracted claims matching the schema.",
        input_schema: {
          type: "object",
          properties: {
            claims: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  dimension: { type: "string", enum: ["ACCOUNTABILITY", "DELIVERY", "TRANSPARENCY", "INTEGRITY", "CITIZEN_SENTIMENT"] },
                  abcxyzLetter: { type: "string" },
                  suggestedRawScore: { type: "number" },
                  claimStatus: {
                    type: "string",
                    enum: ["VERIFIED", "PARTIALLY_VERIFIED", "UNVERIFIED", "DISPUTED", "FALSE", "ALLEGATION", "UNDER_INVESTIGATION"],
                  },
                  confidence: { type: "number" },
                },
                required: ["title", "description", "dimension", "suggestedRawScore", "claimStatus", "confidence"],
              },
            },
          },
          required: ["claims"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "submit_claims" },
  });

  const toolUse = message.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    return { created: 0, error: "Model did not return structured claims." };
  }

  const parsed = extractionSchema.safeParse(toolUse.input);
  if (!parsed.success) {
    return { created: 0, error: `Schema validation failed: ${parsed.error.message}` };
  }

  let created = 0;
  for (const claim of parsed.data.claims) {
    await db.insert(evidenceTable).values({
      representativeId: input.representativeId,
      dimension: claim.dimension,
      abcxyzLetter: claim.abcxyzLetter ?? null,
      title: claim.title,
      description: claim.description,
      rawScore: claim.suggestedRawScore,
      sourceId: input.sourceId,
      claimStatus: claim.claimStatus,
      needsReview: true,
      aiExtractionConfidence: claim.confidence,
    });
    created += 1;
  }

  logger.info({ representativeId: input.representativeId, created }, "AI extraction produced claims (pending moderator review)");
  return { created };
}
