import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod/v3";
import { type ModelConfig, config } from "../config.ts";
import { createAgent, providerStrategy } from "langchain";
import { th } from "zod/v4/locales";

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
  ) {
    try {
      const agent = createAgent({
        model: this.llmClient,
        tools: [],
        responseFormat: providerStrategy(schema),
      });

      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(
          `${userPrompt}\n\nReturn only a valid JSON object matching the requested schema. Do not wrap it in markdown.`,
        ),
      ];

      const data = await agent.invoke({ messages });

      return { success: true, data: data.structuredResponse };
    } catch (error) {
      console.error("❌ Error in OpenRouterService.generateStructured:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "An error occurred during structured generation",
      };
    }
  }
}
