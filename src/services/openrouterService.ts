import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod/v3";
import { type ModelConfig, config } from "../config.ts";

type StructuredResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export class OpenRouterService {
  private config: ModelConfig;
  private llmClient: ChatOpenAI;

  constructor(configOverride?: ModelConfig) {
    this.config = configOverride ?? config;
    this.llmClient = new ChatOpenAI({
      apiKey: this.config.apiKey,
      modelName: this.config.models.at(0),
      temperature: this.config.temperature,
      configuration: {
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: {
          "HTTP-Referer": this.config.httpReferer,
          "X-Title": this.config.xTitle,
        },
      },
      modelKwargs: {
        models: this.config.models,
        provider: this.config.provider,
      },
    });
  }

  async generateStructured<T>(
    systemPrompt: string,
    userPrompt: string,
    schema: z.ZodSchema<T>,
  ): Promise<StructuredResult<T>> {
    try {
      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(
          `${userPrompt}\n\nReturn only a valid JSON object matching the requested schema. Do not wrap it in markdown.`,
        ),
      ];

      const response = await this.llmClient.invoke(messages);
      const content =
        typeof response.content === "string"
          ? response.content
          : JSON.stringify(response.content);

      const parsedJson = JSON.parse(this.extractJsonObject(content));
      return { success: true, data: schema.parse(parsedJson) };
    } catch (error) {
      console.error("Error in OpenRouterService.generateStructured:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "An error occurred during structured generation",
      };
    }
  }

  private extractJsonObject(content: string) {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");

    if (start === -1 || end === -1 || end < start) {
      throw new Error(`Model did not return a JSON object: ${content}`);
    }

    return content.slice(start, end + 1);
  }
}
