export interface ChunkMetadata {
  source: string;
  sourceType: 'pdf' | 'url' | 'text' | 'office' | 'image';
  pageNumber?: number;
  chunkIndex: number;
  totalChunks: number;
  priority?: number; // 1-5, where 5 is highest priority
}

export interface TextChunk {
  id: string;
  content: string;
  metadata: ChunkMetadata;
  embedding?: number[];
}

export interface VectorSearchResult {
  chunk: TextChunk;
  score: number;
  weightedScore?: number; // Score adjusted by source priority
}

export type SourcePriority = 1 | 2 | 3 | 4 | 5;

export interface DocumentSource {
  id: string;
  name: string;
  type: 'pdf' | 'url' | 'text' | 'office' | 'image';
  chunks: number;
  priority: SourcePriority;
  addedAt: number;
  usageStats: SourceUsageStats;
}

export interface SourceUsageStats {
  timesUsed: number; // How many times this source appeared in answers
  positiveRatings: number; // Number of positive ratings on answers using this source
  negativeRatings: number; // Number of negative ratings on answers using this source
  lastUsed?: number; // Timestamp of last use
  learningScore: number; // Calculated score for automatic priority adjustment (0-1)
  confidenceInterval: [number, number]; // 95% confidence interval [lower, upper]
  feedbackHistory: FeedbackEvent[]; // History of all feedback events
}

export interface FeedbackEvent {
  timestamp: number;
  isPositive: boolean;
  weight: number; // Time-decayed weight (1.0 = recent, < 1.0 = older)
}

export interface ABTest {
  id: string;
  name: string;
  description: string;
  startedAt: number;
  endedAt?: number;
  configA: SourceConfiguration; // Control configuration
  configB: SourceConfiguration; // Experimental configuration
  activeConfig: 'A' | 'B'; // Currently active configuration
  results: ABTestResults;
}

export interface SourceConfiguration {
  name: string;
  sourcePriorities: Map<string, SourcePriority>; // sourceId -> priority
}

export interface ABTestResults {
  configAStats: {
    questionsAnswered: number;
    positiveRatings: number;
    negativeRatings: number;
    avgConfidence: number;
  };
  configBStats: {
    questionsAnswered: number;
    positiveRatings: number;
    negativeRatings: number;
    avgConfidence: number;
  };
  winner?: 'A' | 'B' | 'inconclusive';
  pValue?: number; // Statistical significance
}

export interface SourceRecommendation {
  sourceId: string;
  sourceName: string;
  type: 'increase_priority' | 'decrease_priority' | 'remove' | 'keep_current';
  currentPriority: SourcePriority;
  suggestedPriority?: SourcePriority;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  impact: 'high' | 'medium' | 'low';
  metrics: {
    learningScore: number;
    confidenceInterval: [number, number];
    totalRatings: number;
    positiveRate: number;
    timesUsed: number;
    daysSinceLastUse?: number;
  };
}

export interface OllamaModelParams {
  temperature: number;
  contextLength: number;
  topP: number;
  topK: number;
  repeatPenalty: number;
}

export interface OllamaConfig {
  baseUrl: string;
  model: string;
  embeddingModel: string;
  params: OllamaModelParams;
}

export const DEFAULT_MODEL_PARAMS: OllamaModelParams = {
  temperature: 0.7,
  contextLength: 4096,
  topP: 0.9,
  topK: 40,
  repeatPenalty: 1.1,
};

export const PREDEFINED_LLM_MODELS = [
  // Llama Models
  { name: 'llama3.3:70b', description: 'Meta Llama 3.3 70B - Most capable' },
  { name: 'llama3.1:70b', description: 'Meta Llama 3.1 70B - High performance' },
  { name: 'llama3.1:8b', description: 'Meta Llama 3.1 8B - Great all-rounder' },
  { name: 'llama3.2:3b', description: 'Meta Llama 3.2 3B - Very fast' },
  { name: 'llama3.2:1b', description: 'Meta Llama 3.2 1B - Ultra lightweight' },
  { name: 'llama2:70b', description: 'Meta Llama 2 70B - Large and powerful' },
  { name: 'llama2:13b', description: 'Meta Llama 2 13B - Good balance' },
  { name: 'llama2:7b', description: 'Meta Llama 2 7B - Efficient' },
  
  // Mistral Models
  { name: 'mistral:7b', description: 'Mistral 7B - Fast and efficient' },
  { name: 'mistral-nemo:12b', description: 'Mistral Nemo 12B - Advanced reasoning' },
  { name: 'mistral-small:22b', description: 'Mistral Small 22B - High quality' },
  { name: 'mixtral:8x7b', description: 'Mixtral 8x7B - Mixture of experts' },
  { name: 'mixtral:8x22b', description: 'Mixtral 8x22B - Largest MoE' },
  
  // DeepSeek Models
  { name: 'deepseek-r1:70b', description: 'DeepSeek R1 70B - Best reasoning' },
  { name: 'deepseek-r1:32b', description: 'DeepSeek R1 32B - Strong reasoning' },
  { name: 'deepseek-r1:14b', description: 'DeepSeek R1 14B - Balanced reasoning' },
  { name: 'deepseek-r1:8b', description: 'DeepSeek R1 8B - Fast reasoning' },
  { name: 'deepseek-r1:7b', description: 'DeepSeek R1 7B - Efficient reasoning' },
  { name: 'deepseek-r1:1.5b', description: 'DeepSeek R1 1.5B - Lightweight reasoning' },
  { name: 'deepseek-coder-v2:16b', description: 'DeepSeek Coder V2 16B - Code expert' },
  { name: 'deepseek-coder-v2:236b', description: 'DeepSeek Coder V2 236B - Ultimate coder' },
  
  // Qwen Models
  { name: 'qwen3:8b', description: 'Qwen 3 8B - Multilingual' },
  { name: 'qwen2.5:72b', description: 'Qwen 2.5 72B - Largest Qwen' },
  { name: 'qwen2.5:32b', description: 'Qwen 2.5 32B - High capability' },
  { name: 'qwen2.5:14b', description: 'Qwen 2.5 14B - Balanced' },
  { name: 'qwen2.5:7b', description: 'Qwen 2.5 7B - Efficient' },
  { name: 'qwen2.5:3b', description: 'Qwen 2.5 3B - Fast' },
  { name: 'qwen2.5-coder:32b', description: 'Qwen 2.5 Coder 32B - Advanced coding' },
  { name: 'qwen2.5-coder:7b', description: 'Qwen 2.5 Coder 7B - Code focused' },
  { name: 'qwen2.5-coder:1.5b', description: 'Qwen 2.5 Coder 1.5B - Quick coding' },
  { name: 'qwen2:72b', description: 'Qwen 2 72B - Previous generation large' },
  { name: 'qwen2:7b', description: 'Qwen 2 7B - Stable' },
  
  // Gemma Models
  { name: 'gemma3:27b', description: 'Google Gemma 3 27B - Largest Gemma' },
  { name: 'gemma3:9b', description: 'Google Gemma 3 9B - Balanced' },
  { name: 'gemma3:4b', description: 'Google Gemma 3 4B - Lightweight' },
  { name: 'gemma2:27b', description: 'Google Gemma 2 27B - High performance' },
  { name: 'gemma2:9b', description: 'Google Gemma 2 9B - Efficient' },
  { name: 'gemma2:2b', description: 'Google Gemma 2 2B - Ultra fast' },
  { name: 'gemma:7b', description: 'Google Gemma 7B - Original' },
  { name: 'gemma:2b', description: 'Google Gemma 2B - Compact' },
  
  // Phi Models
  { name: 'phi4:14b', description: 'Microsoft Phi 4 14B - Latest generation' },
  { name: 'phi3.5:3.8b', description: 'Microsoft Phi 3.5 3.8B - Compact expert' },
  { name: 'phi3:14b', description: 'Microsoft Phi 3 14B - High quality' },
  { name: 'phi3:3.8b', description: 'Microsoft Phi 3 3.8B - Small but capable' },
  
  // Command R Models
  { name: 'command-r:35b', description: 'Cohere Command R 35B - RAG optimized' },
  { name: 'command-r-plus:104b', description: 'Cohere Command R+ 104B - Premium RAG' },
  
  // Dolphin Models
  { name: 'dolphin-llama3:70b', description: 'Dolphin Llama 3 70B - Uncensored' },
  { name: 'dolphin-llama3:8b', description: 'Dolphin Llama 3 8B - Uncensored' },
  { name: 'dolphin-mistral:7b', description: 'Dolphin Mistral 7B - Uncensored' },
  
  // Orca Models
  { name: 'orca2:13b', description: 'Orca 2 13B - Reasoning focused' },
  { name: 'orca2:7b', description: 'Orca 2 7B - Efficient reasoning' },
  
  // Neural Chat & Starling
  { name: 'neural-chat:7b', description: 'Neural Chat 7B - Conversation expert' },
  { name: 'starling-lm:7b', description: 'Starling LM 7B - RLHF trained' },
  
  // Wizard Models
  { name: 'wizardlm2:8x22b', description: 'WizardLM 2 8x22B - Complex reasoning' },
  { name: 'wizardlm2:7b', description: 'WizardLM 2 7B - Instruction following' },
  { name: 'wizardcoder:34b', description: 'WizardCoder 34B - Code specialist' },
  
  // Code Specialist Models
  { name: 'codellama:70b', description: 'Code Llama 70B - Advanced coding' },
  { name: 'codellama:34b', description: 'Code Llama 34B - Strong coding' },
  { name: 'codellama:13b', description: 'Code Llama 13B - Balanced coding' },
  { name: 'codellama:7b', description: 'Code Llama 7B - Fast coding' },
  { name: 'codegemma:7b', description: 'Code Gemma 7B - Google code model' },
  { name: 'starcoder2:15b', description: 'StarCoder 2 15B - Code generation' },
  { name: 'starcoder2:7b', description: 'StarCoder 2 7B - Efficient coding' },
  
  // Yi Models
  { name: 'yi:34b', description: 'Yi 34B - High capability' },
  { name: 'yi:6b', description: 'Yi 6B - Efficient' },
  
  // Other Popular Models
  { name: 'solar:10.7b', description: 'Solar 10.7B - Depth upscaled' },
  { name: 'vicuna:13b', description: 'Vicuna 13B - Chatbot expert' },
  { name: 'vicuna:7b', description: 'Vicuna 7B - Efficient chatbot' },
  { name: 'openhermes:7b', description: 'OpenHermes 7B - Instruction tuned' },
  { name: 'falcon:40b', description: 'Falcon 40B - Open source leader' },
  { name: 'falcon:7b', description: 'Falcon 7B - Compact' },
];

export const PREDEFINED_EMBEDDING_MODELS = [
  // Nomic Models
  { name: 'nomic-embed-text:latest', description: 'Nomic Embed - Best quality', dimensions: 768 },
  { name: 'nomic-embed-text:v1.5', description: 'Nomic Embed v1.5 - Stable version', dimensions: 768 },
  
  // MixedBread Models
  { name: 'mxbai-embed-large:latest', description: 'MixedBread Large - High quality', dimensions: 1024 },
  { name: 'mxbai-embed-large:335m', description: 'MixedBread Large 335M - High quality', dimensions: 1024 },
  
  // BGE Models
  { name: 'bge-large:335m', description: 'BGE Large - High performance', dimensions: 1024 },
  { name: 'bge-m3:567m', description: 'BGE M3 - Multilingual', dimensions: 1024 },
  { name: 'bge-base:109m', description: 'BGE Base - Balanced', dimensions: 768 },
  { name: 'bge-small:33m', description: 'BGE Small - Fast', dimensions: 384 },
  
  // All-MiniLM Models
  { name: 'all-minilm:latest', description: 'MiniLM - Very fast', dimensions: 384 },
  { name: 'all-minilm:33m', description: 'MiniLM 33M - Efficient', dimensions: 384 },
  { name: 'all-minilm:22m', description: 'MiniLM 22M - Ultra fast', dimensions: 384 },
  
  // Snowflake Models
  { name: 'snowflake-arctic-embed:335m', description: 'Arctic Embed 335M - Enterprise', dimensions: 1024 },
  { name: 'snowflake-arctic-embed:137m', description: 'Arctic Embed 137M - Balanced', dimensions: 768 },
  { name: 'snowflake-arctic-embed:33m', description: 'Arctic Embed 33M - Fast', dimensions: 384 },
  
  // Other Embedding Models
  { name: 'llama3-embeddings:8b', description: 'Llama 3 Embeddings - Llama based', dimensions: 4096 },
  { name: 'e5-large:335m', description: 'E5 Large - General purpose', dimensions: 1024 },
  { name: 'e5-base:109m', description: 'E5 Base - Efficient', dimensions: 768 },
  { name: 'gte-large:335m', description: 'GTE Large - High quality', dimensions: 1024 },
  { name: 'paraphrase-multilingual:278m', description: 'Paraphrase Multilingual - 50+ languages', dimensions: 768 },
];
