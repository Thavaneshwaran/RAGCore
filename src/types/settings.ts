export type Mode = 'local' | 'remote';

export type LLMProvider = 'openai' | 'gemini' | 'lovable' | 'custom';
export type EmbeddingProvider = 'openai' | 'gemini' | 'custom';

export interface RemoteProviderConfig {
  llmProvider: LLMProvider;
  llmApiKey: string;
  llmModel: string;
  llmBaseUrl?: string;
  llmCustomHeaders?: Record<string, string>;
  
  embeddingProvider: EmbeddingProvider;
  embeddingApiKey: string;
  embeddingModel: string;
  embeddingBaseUrl?: string;
  embeddingCustomHeaders?: Record<string, string>;
}

export interface AppSettings {
  mode: Mode;
  remoteConfig?: RemoteProviderConfig;
  chunkCount?: number;
  chunkOverlap?: number; // Overlap as percentage (0-50)
  chunkSize?: number; // Characters per chunk (200-2000)
}

export const LLM_PROVIDERS: Record<LLMProvider, { name: string; models: string[] }> = {
  lovable: {
    name: 'Lovable AI (No API Key Required)',
    models: ['google/gemini-2.5-flash', 'google/gemini-2.5-pro', 'openai/gpt-5-mini', 'openai/gpt-5'],
  },
  openai: {
    name: 'OpenAI',
    models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  },
  gemini: {
    name: 'Google Gemini',
    models: ['gemini-pro', 'gemini-pro-vision'],
  },
  custom: {
    name: 'Custom',
    models: [],
  },
};

export const EMBEDDING_PROVIDERS: Record<EmbeddingProvider, { name: string; models: string[] }> = {
  openai: {
    name: 'OpenAI',
    models: ['text-embedding-3-small', 'text-embedding-3-large', 'text-embedding-ada-002'],
  },
  gemini: {
    name: 'Google Gemini',
    models: ['embedding-001'],
  },
  custom: {
    name: 'Custom',
    models: [],
  },
};
