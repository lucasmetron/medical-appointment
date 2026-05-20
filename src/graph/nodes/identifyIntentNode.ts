import {
  getSystemPrompt,
  getUserPromptTemplate,
  IntentSchema,
} from "../../prompts/v1/identifyIntent.ts";
import { professionals } from "../../services/appointmentService.ts";
import type { GraphState } from "../graph.ts";
import { OpenRouterService } from "../../services/openrouterService.ts";

export function createIdentifyIntentNode(llmClient: OpenRouterService) {
  return async (state: GraphState): Promise<Partial<GraphState>> => {
    console.log(`🔍 Identifying intent...`);
    const input = state.messages.at(-1)!.text;

    try {
      const systemPrompt = getSystemPrompt(professionals);
      const userPrompt = getUserPromptTemplate(input);
      const result = await llmClient.generateStructured(
        systemPrompt,
        userPrompt,
        IntentSchema,
      );

      if (!result.success) {
        return {
          intent: "unknown",
          error: result.error || "Intent identification failed",
        };
      }

      const intentData = result.data!;
      console.log("✌️intentData --->", intentData.intent);

      return {
        ...intentData,
      };
    } catch (error) {
      console.error("❌ Error in identifyIntent node:", error);
      return {
        ...state,
        intent: "unknown",
        error:
          error instanceof Error
            ? error.message
            : "Intent identification failed",
      };
    }
  };
}
