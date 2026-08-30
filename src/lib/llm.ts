export type LlmProviderId = "deepseek" | "openai" | "azure";

export type LlmModelId = "deepseek-v4-flash" | "deepseek-v4-pro";

export const LLM_PROVIDERS: {
  id: LlmProviderId;
  label: string;
  implemented: boolean;
}[] = [
  { id: "deepseek", label: "DeepSeek", implemented: true },
  { id: "openai", label: "OpenAI", implemented: false },
  { id: "azure", label: "Azure OpenAI", implemented: false },
];

export const DEEPSEEK_MODELS: { id: LlmModelId; labelKey: "flash" | "pro" }[] = [
  { id: "deepseek-v4-flash", labelKey: "flash" },
  { id: "deepseek-v4-pro", labelKey: "pro" },
];

export const DEFAULT_DEEPSEEK_MODEL: LlmModelId = "deepseek-v4-flash";

export function isDeepSeekModel(value: string | null): value is LlmModelId {
  return value === "deepseek-v4-flash" || value === "deepseek-v4-pro";
}
