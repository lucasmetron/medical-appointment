import {
  getSystemPrompt,
  getUserPromptTemplate,
  type IntentData,
  IntentSchema,
} from "../../prompts/v1/identifyIntent.ts";
import { professionals } from "../../services/appointmentService.ts";
import { OpenRouterService } from "../../services/openrouterService.ts";
import type { GraphState } from "../graph.ts";

export function createIdentifyIntentNode(llmClient: OpenRouterService) {
  return async (state: GraphState): Promise<Partial<GraphState>> => {
    console.log("Identifying intent...");
    const input = state.messages.at(-1)!.text;
    const localIntent = identifyIntentLocally(input);

    if (isCompleteLocalIntent(localIntent)) {
      return localIntent;
    }

    try {
      const systemPrompt = getSystemPrompt(professionals);
      const userPrompt = getUserPromptTemplate(input);
      const result = await llmClient.generateStructured(
        systemPrompt,
        userPrompt,
        IntentSchema,
      );

      if (!result.success) {
        return localIntent.intent === "unknown"
          ? {
              intent: "unknown",
              error: result.error || "Intent identification failed",
            }
          : localIntent;
      }

      return result.data;
    } catch (error) {
      console.error("Error in identifyIntent node:", error);

      return localIntent.intent === "unknown"
        ? {
            intent: "unknown",
            error:
              error instanceof Error
                ? error.message
                : "Intent identification failed",
          }
        : localIntent;
    }
  };
}

function isCompleteLocalIntent(intentData: IntentData) {
  if (intentData.intent === "unknown") {
    return false;
  }

  return Boolean(
    intentData.professionalId && intentData.datetime && intentData.patientName,
  );
}

function identifyIntentLocally(input: string): IntentData {
  const normalized = normalize(input);
  const professional = professionals.find((item) =>
    normalized.includes(normalize(item.name)),
  );
  const datetime = extractDateTime(normalized);
  const patientName = extractPatientName(input);

  if (/\b(cancel|cancele|cancelar|desmarcar|remover)\b/.test(normalized)) {
    return {
      intent: "cancel",
      professionalId: professional?.id,
      professionalName: professional?.name,
      datetime,
      patientName,
    };
  }

  if (/\b(agendar|agenda|consulta|schedule|book)\b/.test(normalized)) {
    return {
      intent: "schedule",
      professionalId: professional?.id,
      professionalName: professional?.name,
      datetime,
      patientName,
      reason: extractReason(input),
    };
  }

  return { intent: "unknown" };
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function extractDateTime(normalizedInput: string) {
  const date = new Date();

  if (normalizedInput.includes("amanha") || normalizedInput.includes("tomorrow")) {
    date.setDate(date.getDate() + 1);
  }

  const hourMatch = normalizedInput.match(
    /(?:as|at)\s*(\d{1,2})\s*h?|(\d{1,2})\s*(?:h|pm|am)/,
  );
  const hour = Number(hourMatch?.[1] ?? hourMatch?.[2]);

  if (!Number.isFinite(hour)) {
    return undefined;
  }

  date.setUTCHours(hour, 0, 0, 0);
  return date.toISOString();
}

function extractPatientName(input: string) {
  const match = input.match(
    /(?:sou|me chamo)\s+([A-Za-zÀ-ÿ ]+?)(?:\s+e\b|\s+que\b|\s+quero\b|,|$)/i,
  );
  return match?.[1]?.trim();
}

function extractReason(input: string) {
  const matches = [
    ...input.matchAll(/para\s+(?:um|uma)?\s*([^,.]+?)(?=\s+para\b|[,.]|$)/gi),
  ];
  const reason = matches.at(-1)?.[1]?.trim();

  return reason;
}
