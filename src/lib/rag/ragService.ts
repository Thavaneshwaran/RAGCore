import { 
  TextChunk, 
  OllamaConfig, 
  VectorSearchResult, 
  DEFAULT_MODEL_PARAMS, 
  DocumentSource, 
  SourcePriority,
  ABTest,
  SourceConfiguration,
  FeedbackEvent,
  SourceRecommendation
} from './types';
import { chunkDocument } from './chunker';
import { vectorStore } from './vectorStore';
import { generateEmbeddings, embedQuery } from './embeddings';
import { parsePDF } from './pdfParser';
import { parseURL } from './urlParser';
import { loadSettings, saveSettings, loadSettings as getSettings } from '../settings';
import { generateRemoteEmbedding, generateRemoteEmbeddings, streamRemoteLLM } from './remoteProvider';

export interface RAGServiceConfig {
  ollamaConfig: OllamaConfig;
}

export interface ProcessResult {
  chunks: number;
  pages?: number;
  source: string;
  sourceId: string;
}

const SOURCES_STORAGE_KEY = 'rag_document_sources';

class RAGService {
  private config: OllamaConfig | null = null;
  private sources: Map<string, DocumentSource> = new Map();
  private readonly AUTO_ADJUST_THRESHOLD = 5; // Minimum ratings before auto-adjusting
  private readonly TIME_DECAY_HALF_LIFE = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
  private activeABTest: ABTest | null = null;
  
  constructor() {
    this.loadSourcesFromStorage();
    this.loadABTest();
  }
  
  private loadSourcesFromStorage(): void {
    try {
      const stored = localStorage.getItem(SOURCES_STORAGE_KEY);
      if (stored) {
        const sources: DocumentSource[] = JSON.parse(stored);
        sources.forEach(source => this.sources.set(source.id, source));
      }
    } catch (error) {
      console.error('Failed to load sources from storage:', error);
    }
  }
  
  private saveSourcesToStorage(): void {
    try {
      const sources = Array.from(this.sources.values());
      localStorage.setItem(SOURCES_STORAGE_KEY, JSON.stringify(sources));
    } catch (error) {
      console.error('Failed to save sources to storage:', error);
    }
  }
  
  private loadABTest(): void {
    try {
      const stored = localStorage.getItem('rag_ab_test');
      if (stored) {
        const test = JSON.parse(stored);
        // Reconstruct Map objects
        if (test.configA?.sourcePriorities) {
          test.configA.sourcePriorities = new Map(Object.entries(test.configA.sourcePriorities));
        }
        if (test.configB?.sourcePriorities) {
          test.configB.sourcePriorities = new Map(Object.entries(test.configB.sourcePriorities));
        }
        this.activeABTest = test;
      }
    } catch (error) {
      console.error('Failed to load A/B test:', error);
    }
  }
  
  private saveABTest(): void {
    try {
      if (this.activeABTest) {
        // Convert Maps to objects for JSON serialization
        const serializable = {
          ...this.activeABTest,
          configA: {
            ...this.activeABTest.configA,
            sourcePriorities: Object.fromEntries(this.activeABTest.configA.sourcePriorities),
          },
          configB: {
            ...this.activeABTest.configB,
            sourcePriorities: Object.fromEntries(this.activeABTest.configB.sourcePriorities),
          },
        };
        localStorage.setItem('rag_ab_test', JSON.stringify(serializable));
      } else {
        localStorage.removeItem('rag_ab_test');
      }
    } catch (error) {
      console.error('Failed to save A/B test:', error);
    }
  }
  
  configure(config: OllamaConfig): void {
    this.config = config;
  }
  
  getConfig(): OllamaConfig | null {
    return this.config;
  }
  
  private isRemoteMode(): boolean {
    const settings = loadSettings();
    return settings.mode === 'remote' && !!settings.remoteConfig;
  }
  
  private getChunkOptions() {
    const settings = loadSettings();
    const overlapPercent = settings.chunkOverlap ?? 10; // Default 10%
    const chunkSize = settings.chunkSize ?? 500; // Configurable chunk size
    const chunkOverlap = Math.floor(chunkSize * (overlapPercent / 100));
    return { chunkSize, chunkOverlap };
  }
  
  isConfigured(): boolean {
    // Check if either local or remote mode is properly configured
    if (this.isRemoteMode()) {
      const settings = loadSettings();
      // Check LLM configuration (Lovable AI doesn't require API key)
      const llmConfigured = settings.remoteConfig?.llmProvider === 'lovable' || !!settings.remoteConfig?.llmApiKey;
      // Check embedding configuration (always requires API key - Lovable doesn't support embeddings)
      const embeddingConfigured = !!settings.remoteConfig?.embeddingApiKey;
      return llmConfigured && embeddingConfigured;
    }
    return this.config !== null && !!this.config.model && !!this.config.embeddingModel;
  }
  
  async processPDF(
    file: File,
    onProgress?: (stage: string, current: number, total: number) => void
  ): Promise<ProcessResult> {
    if (!this.isConfigured()) {
      throw new Error('RAG service not configured. Please configure your LLM provider first.');
    }
    
    // Parse PDF
    onProgress?.('Parsing PDF', 0, 100);
    const parsed = await parsePDF(file, (current, total) => {
      onProgress?.('Parsing PDF', current, total);
    });
    
    // Chunk the document
    onProgress?.('Chunking document', 0, 1);
    const chunks = chunkDocument(parsed.pages, file.name, 'pdf', this.getChunkOptions());
    onProgress?.('Chunking document', 1, 1);
    
    // Generate embeddings
    let embeddedChunks: TextChunk[];
    
    if (this.isRemoteMode()) {
      const settings = loadSettings();
      if (!settings.remoteConfig) throw new Error('Remote config not found');
      
      const embeddings = await generateRemoteEmbeddings(
        chunks.map(c => c.content),
        settings.remoteConfig,
        (current, total) => {
          onProgress?.('Generating embeddings', current, total);
        }
      );
      
      embeddedChunks = chunks.map((chunk, i) => ({
        ...chunk,
        embedding: embeddings[i],
      }));
    } else {
      if (!this.config) throw new Error('Ollama not configured');
      embeddedChunks = await generateEmbeddings(
        chunks,
        this.config.baseUrl,
        this.config.embeddingModel,
        (current, total) => {
          onProgress?.('Generating embeddings', current, total);
        }
      );
    }
    
    // Store in vector store
    vectorStore.addMany(embeddedChunks);
    
    // Track source with default priority
    const sourceId = `pdf_${Date.now()}_${file.name}`;
    this.sources.set(sourceId, {
      id: sourceId,
      type: 'pdf',
      name: file.name,
      chunks: embeddedChunks.length,
      priority: 3,
      addedAt: Date.now(),
      usageStats: {
        timesUsed: 0,
        positiveRatings: 0,
        negativeRatings: 0,
        learningScore: 0.5,
        confidenceInterval: [0.3, 0.7],
        feedbackHistory: [],
      },
    });
    this.saveSourcesToStorage();
    
    return {
      chunks: embeddedChunks.length,
      pages: parsed.totalPages,
      source: file.name,
      sourceId,
    };
  }
  
  async processURL(
    url: string,
    onProgress?: (stage: string, current: number, total: number) => void
  ): Promise<ProcessResult> {
    if (!this.isConfigured()) {
      throw new Error('RAG service not configured. Please configure your LLM provider first.');
    }
    
    // Parse URL
    onProgress?.('Fetching URL', 0, 1);
    const parsed = await parseURL(url);
    onProgress?.('Fetching URL', 1, 1);
    
    // Chunk the document
    onProgress?.('Chunking content', 0, 1);
    const chunks = chunkDocument(parsed.pages, url, 'url', this.getChunkOptions());
    onProgress?.('Chunking content', 1, 1);
    
    // Generate embeddings
    let embeddedChunks: TextChunk[];
    
    if (this.isRemoteMode()) {
      const settings = loadSettings();
      if (!settings.remoteConfig) throw new Error('Remote config not found');
      
      const embeddings = await generateRemoteEmbeddings(
        chunks.map(c => c.content),
        settings.remoteConfig,
        (current, total) => {
          onProgress?.('Generating embeddings', current, total);
        }
      );
      
      embeddedChunks = chunks.map((chunk, i) => ({
        ...chunk,
        embedding: embeddings[i],
      }));
    } else {
      if (!this.config) throw new Error('Ollama not configured');
      embeddedChunks = await generateEmbeddings(
        chunks,
        this.config.baseUrl,
        this.config.embeddingModel,
        (current, total) => {
          onProgress?.('Generating embeddings', current, total);
        }
      );
    }
    
    // Store in vector store
    vectorStore.addMany(embeddedChunks);
    
    // Track source with default priority
    const sourceName = parsed.title || url;
    const sourceId = `url_${Date.now()}_${encodeURIComponent(url)}`;
    this.sources.set(sourceId, {
      id: sourceId,
      type: 'url',
      name: sourceName,
      chunks: embeddedChunks.length,
      priority: 3,
      addedAt: Date.now(),
      usageStats: {
        timesUsed: 0,
        positiveRatings: 0,
        negativeRatings: 0,
        learningScore: 0.5,
        confidenceInterval: [0.3, 0.7],
        feedbackHistory: [],
      },
    });
    this.saveSourcesToStorage();
    
    return {
      chunks: embeddedChunks.length,
      source: sourceName,
      sourceId,
    };
  }
  
  async processTextFile(
    file: File,
    onProgress?: (stage: string, current: number, total: number) => void
  ): Promise<ProcessResult> {
    if (!this.isConfigured()) {
      throw new Error('RAG service not configured. Please configure your LLM provider first.');
    }
    
    // Read text content
    onProgress?.('Reading file', 0, 1);
    const text = await file.text();
    onProgress?.('Reading file', 1, 1);
    
    // Create a single "page" with the text content
    const pages = [{ pageNumber: 1, text }];
    
    // Chunk the document
    onProgress?.('Chunking document', 0, 1);
    const chunks = chunkDocument(pages, file.name, 'text', this.getChunkOptions());
    onProgress?.('Chunking document', 1, 1);
    
    // Generate embeddings (same logic as PDF)
    let embeddedChunks: TextChunk[];
    
    if (this.isRemoteMode()) {
      const settings = loadSettings();
      if (!settings.remoteConfig) throw new Error('Remote config not found');
      
      const embeddings = await generateRemoteEmbeddings(
        chunks.map(c => c.content),
        settings.remoteConfig,
        (current, total) => {
          onProgress?.('Generating embeddings', current, total);
        }
      );
      
      embeddedChunks = chunks.map((chunk, i) => ({
        ...chunk,
        embedding: embeddings[i],
      }));
    } else {
      if (!this.config) throw new Error('Ollama not configured');
      embeddedChunks = await generateEmbeddings(
        chunks,
        this.config.baseUrl,
        this.config.embeddingModel,
        (current, total) => {
          onProgress?.('Generating embeddings', current, total);
        }
      );
    }
    
    // Store in vector store
    vectorStore.addMany(embeddedChunks);
    
    // Track source
    const sourceId = `text_${Date.now()}_${file.name}`;
    this.sources.set(sourceId, {
      id: sourceId,
      type: 'text',
      name: file.name,
      chunks: embeddedChunks.length,
      priority: 3,
      addedAt: Date.now(),
      usageStats: {
        timesUsed: 0,
        positiveRatings: 0,
        negativeRatings: 0,
        learningScore: 0.5,
        confidenceInterval: [0.3, 0.7],
        feedbackHistory: [],
      },
    });
    this.saveSourcesToStorage();
    
    return {
      chunks: embeddedChunks.length,
      pages: 1,
      source: file.name,
      sourceId,
    };
  }
  
  async processOfficeDocument(
    file: File,
    onProgress?: (stage: string, current: number, total: number) => void
  ): Promise<ProcessResult> {
    if (!this.isConfigured()) {
      throw new Error('RAG service not configured. Please configure your LLM provider first.');
    }
    
    // For Office documents, we'll try to extract text using FileReader
    // This is a simplified approach - in production, you'd use a proper parser
    onProgress?.('Processing document', 0, 100);
    
    try {
      const text = await file.text();
      const pages = [{ pageNumber: 1, text }];
      
      onProgress?.('Chunking document', 0, 1);
      const chunks = chunkDocument(pages, file.name, 'office', this.getChunkOptions());
      onProgress?.('Chunking document', 1, 1);
      
      // Generate embeddings
      let embeddedChunks: TextChunk[];
      
      if (this.isRemoteMode()) {
        const settings = loadSettings();
        if (!settings.remoteConfig) throw new Error('Remote config not found');
        
        const embeddings = await generateRemoteEmbeddings(
          chunks.map(c => c.content),
          settings.remoteConfig,
          (current, total) => {
            onProgress?.('Generating embeddings', current, total);
          }
        );
        
        embeddedChunks = chunks.map((chunk, i) => ({
          ...chunk,
          embedding: embeddings[i],
        }));
      } else {
        if (!this.config) throw new Error('Ollama not configured');
        embeddedChunks = await generateEmbeddings(
          chunks,
          this.config.baseUrl,
          this.config.embeddingModel,
          (current, total) => {
            onProgress?.('Generating embeddings', current, total);
          }
        );
      }
      
      vectorStore.addMany(embeddedChunks);
      
      const sourceId = `office_${Date.now()}_${file.name}`;
      this.sources.set(sourceId, {
        id: sourceId,
        type: 'office',
        name: file.name,
        chunks: embeddedChunks.length,
        priority: 3,
        addedAt: Date.now(),
        usageStats: {
          timesUsed: 0,
          positiveRatings: 0,
          negativeRatings: 0,
          learningScore: 0.5,
          confidenceInterval: [0.3, 0.7],
          feedbackHistory: [],
        },
      });
      this.saveSourcesToStorage();
      
      return {
        chunks: embeddedChunks.length,
        pages: 1,
        source: file.name,
        sourceId,
      };
    } catch (error) {
      throw new Error(`Failed to process Office document: ${error instanceof Error ? error.message : 'Unknown error'}. Note: Some binary Office formats may not be fully supported. Try saving as DOCX/PPTX or converting to PDF.`);
    }
  }
  
  async processImage(
    file: File,
    onProgress?: (stage: string, current: number, total: number) => void
  ): Promise<ProcessResult> {
    if (!this.isConfigured()) {
      throw new Error('RAG service not configured. Please configure your LLM provider first.');
    }
    
    onProgress?.('Processing image', 0, 100);
    
    // Convert image to base64 for OCR
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = '';
    const chunkSize = 8192;
    
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    
    const imageBase64 = btoa(binary);
    
    onProgress?.('Extracting text (OCR)', 20, 100);
    
    // Call OCR edge function
    let extractedText = '';
    try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${SUPABASE_URL}/functions/v1/ocr-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          imageBase64,
          mimeType: file.type 
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        extractedText = data.text || '';
        console.log('OCR extracted text length:', extractedText.length);
      } else {
        const errorData = await response.json();
        console.warn('OCR failed, using metadata fallback:', errorData.error);
      }
    } catch (error) {
      console.warn('OCR request failed, using metadata fallback:', error);
    }
    
    // Fallback to metadata if OCR fails or returns empty
    const textContent = extractedText.trim() || 
      `Image: ${file.name}\nSize: ${(file.size / 1024).toFixed(2)}KB\nType: ${file.type}\n\n[OCR extraction unavailable]`;
    
    const pages = [{ pageNumber: 1, text: textContent }];
    
    onProgress?.('Chunking content', 50, 100);
    const chunks = chunkDocument(pages, file.name, 'image', this.getChunkOptions());
    
    // Generate embeddings
    let embeddedChunks: TextChunk[];
    
    if (this.isRemoteMode()) {
      const settings = loadSettings();
      if (!settings.remoteConfig) throw new Error('Remote config not found');
      
      const embeddings = await generateRemoteEmbeddings(
        chunks.map(c => c.content),
        settings.remoteConfig,
        (current, total) => {
          const progress = 50 + Math.round((current / total) * 40);
          onProgress?.('Generating embeddings', progress, 100);
        }
      );
      
      embeddedChunks = chunks.map((chunk, i) => ({
        ...chunk,
        embedding: embeddings[i],
      }));
    } else {
      if (!this.config) throw new Error('Ollama not configured');
      embeddedChunks = await generateEmbeddings(
        chunks,
        this.config.baseUrl,
        this.config.embeddingModel,
        (current, total) => {
          const progress = 50 + Math.round((current / total) * 40);
          onProgress?.('Generating embeddings', progress, 100);
        }
      );
    }
    
    vectorStore.addMany(embeddedChunks);
    
    const sourceId = `image_${Date.now()}_${file.name}`;
    this.sources.set(sourceId, {
      id: sourceId,
      type: 'image',
      name: file.name,
      chunks: embeddedChunks.length,
      priority: 3,
      addedAt: Date.now(),
      usageStats: {
        timesUsed: 0,
        positiveRatings: 0,
        negativeRatings: 0,
        learningScore: 0.5,
        confidenceInterval: [0.3, 0.7],
        feedbackHistory: [],
      },
    });
    this.saveSourcesToStorage();
    
    onProgress?.('Complete', 100, 100);
    
    return {
      chunks: embeddedChunks.length,
      pages: 1,
      source: file.name,
      sourceId,
    };
  }
  
  async query(
    question: string,
    topK: number = 5
  ): Promise<VectorSearchResult[]> {
    if (vectorStore.size() === 0) {
      return [];
    }
    
    // Embed the query
    let queryEmbedding: number[];
    
    if (this.isRemoteMode()) {
      const settings = loadSettings();
      if (!settings.remoteConfig) throw new Error('Remote config not found');
      queryEmbedding = await generateRemoteEmbedding(question, settings.remoteConfig);
    } else {
      if (!this.config) throw new Error('RAG service not configured');
      queryEmbedding = await embedQuery(
        question,
        this.config.baseUrl,
        this.config.embeddingModel
      );
    }
    
    // Create priority map from sources
    const priorityMap = new Map<string, number>();
    for (const [_, source] of this.sources) {
      priorityMap.set(source.name, source.priority);
    }
    
    // Search with weighted scoring
    return vectorStore.searchWeighted(queryEmbedding, topK, priorityMap);
  }
  
  async generateResponse(
    question: string,
    context: VectorSearchResult[],
    onToken: (token: string) => void,
    onDone: () => void,
    onError: (error: Error) => void
  ): Promise<void> {
    // Build context from retrieved chunks
    const contextText = context
      .map((result, index) => {
        const source = result.chunk.metadata.source;
        const page = result.chunk.metadata.pageNumber;
        const pageInfo = page ? ` (Page ${page})` : '';
        return `[Source ${index + 1}: ${source}${pageInfo}]\n${result.chunk.content}`;
      })
      .join('\n\n');
    
    // Build the prompt
    const systemPrompt = `You are a helpful assistant that answers questions based on the provided context. 
Use the context to answer the user's question accurately and concisely.
If the context doesn't contain enough information to answer the question, say so.
Always cite which source(s) you used in your answer.

Important: Use relevant emojis throughout your responses to make them more engaging and easier to read, similar to ChatGPT's style:
- Add emojis to headings and key points (📚, 💡, ⭐, 🎯, ✨, 🔑, etc.)
- Use emojis for lists and bullet points (✓, ➡️, ⚡, 🔹, etc.)
- Add visual breaks with appropriate emojis
- Keep emoji usage natural and helpful, not excessive`;
    
    const userPrompt = context.length > 0
      ? `Context:\n${contextText}\n\nQuestion: ${question}\n\nAnswer based on the context above:`
      : `Question: ${question}\n\nNote: No relevant context was found in the loaded documents. Please provide a general answer or ask the user to upload relevant documents.`;
    
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];
    
    try {
      // Use remote API if in remote mode
      if (this.isRemoteMode()) {
        const settings = loadSettings();
        if (!settings.remoteConfig) {
          onError(new Error('Remote config not found'));
          return;
        }
        
        await streamRemoteLLM(messages, settings.remoteConfig, onToken, onDone, onError);
        return;
      }
      
      // Use local Ollama
      if (!this.config) {
        onError(new Error('RAG service not configured'));
        return;
      }
      
      const response = await fetch(`${this.config.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          stream: true,
          options: {
            temperature: this.config.params.temperature,
            num_ctx: this.config.params.contextLength,
            top_p: this.config.params.topP,
            top_k: this.config.params.topK,
            repeat_penalty: this.config.params.repeatPenalty,
          },
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Ollama request failed: ${response.statusText}`);
      }
      
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }
      
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.message?.content) {
              onToken(data.message.content);
            }
            if (data.done) {
              onDone();
              return;
            }
          } catch {
            // Skip invalid JSON lines
          }
        }
      }
      
      onDone();
    } catch (error) {
      onError(error instanceof Error ? error : new Error('Unknown error'));
    }
  }

  private getSourceIdByName(sourceName: string): string | null {
    for (const [id, source] of this.sources) {
      if (source.name === sourceName) {
        return id;
      }
    }
    return null;
  }

  getSources(): DocumentSource[] {
    return Array.from(this.sources.values()).sort((a, b) => b.addedAt - a.addedAt);
  }
  
  getSource(id: string): DocumentSource | undefined {
    return this.sources.get(id);
  }
  
  updateSourcePriority(sourceId: string, priority: SourcePriority): void {
    const source = this.sources.get(sourceId);
    if (source) {
      source.priority = priority;
      this.saveSourcesToStorage();
    }
  }
  
  removeSource(sourceId: string): void {
    const source = this.sources.get(sourceId);
    if (source) {
      // Remove chunks from vector store
      vectorStore.removeBySource(source.name);
      this.sources.delete(sourceId);
      this.saveSourcesToStorage();
    }
  }
  
  getChunkCount(): number {
    return vectorStore.size();
  }
  
  getAllChunks(): TextChunk[] {
    return vectorStore.getAll();
  }
  
  clear(): void {
    vectorStore.clear();
    this.sources.clear();
    this.saveSourcesToStorage();
  }
  
  // Record that sources were used in an answer
  recordSourceUsage(sourceIds: string[]): void {
    const now = Date.now();
    sourceIds.forEach(sourceId => {
      const source = this.sources.get(sourceId);
      if (source) {
        source.usageStats.timesUsed++;
        source.usageStats.lastUsed = now;
        this.sources.set(sourceId, source);
      }
    });
    this.saveSourcesToStorage();
  }

  // Process user feedback on an answer
  processFeedback(sourceIds: string[], isPositive: boolean): void {
    if (!sourceIds || sourceIds.length === 0) return;

    const now = Date.now();

    sourceIds.forEach(sourceId => {
      const source = this.sources.get(sourceId);
      if (!source) return;

      // Add feedback event to history
      const event: FeedbackEvent = {
        timestamp: now,
        isPositive,
        weight: 1.0, // Initial weight, will decay over time
      };
      source.usageStats.feedbackHistory.push(event);

      // Update raw counts
      if (isPositive) {
        source.usageStats.positiveRatings++;
      } else {
        source.usageStats.negativeRatings++;
      }

      // Recalculate with time-decay
      this.updateLearningScoreWithDecay(source, now);

      // Auto-adjust priority if enough feedback collected
      const totalRatings = source.usageStats.positiveRatings + source.usageStats.negativeRatings;
      if (totalRatings >= this.AUTO_ADJUST_THRESHOLD) {
        this.autoAdjustPriority(sourceId, source);
      }

      this.sources.set(sourceId, source);
    });

    // Update A/B test stats if active
    if (this.activeABTest && !this.activeABTest.endedAt) {
      const config = this.activeABTest.activeConfig;
      const stats = config === 'A' ? this.activeABTest.results.configAStats : this.activeABTest.results.configBStats;
      
      stats.questionsAnswered++;
      if (isPositive) {
        stats.positiveRatings++;
      } else {
        stats.negativeRatings++;
      }
      
      // Update average confidence
      const allSources = Array.from(this.sources.values());
      const avgConf = allSources.reduce((sum, s) => {
        const [lower, upper] = s.usageStats.confidenceInterval;
        return sum + (upper - lower);
      }, 0) / allSources.length;
      stats.avgConfidence = 1 - avgConf;
      
      this.saveABTest();
    }

    this.saveSourcesToStorage();
  }

  // Calculate time-decayed learning score and confidence interval
  private updateLearningScoreWithDecay(source: DocumentSource, currentTime: number): void {
    const history = source.usageStats.feedbackHistory;
    
    if (history.length === 0) {
      source.usageStats.learningScore = 0.5;
      source.usageStats.confidenceInterval = [0.3, 0.7];
      return;
    }

    // Calculate time-decayed weights
    let weightedPositive = 0;
    let weightedTotal = 0;
    const weights: number[] = [];

    history.forEach(event => {
      const age = currentTime - event.timestamp;
      // Exponential decay: weight = e^(-age / half_life * ln(2))
      const weight = Math.exp((-age / this.TIME_DECAY_HALF_LIFE) * Math.log(2));
      event.weight = weight;
      
      weights.push(weight);
      weightedTotal += weight;
      if (event.isPositive) {
        weightedPositive += weight;
      }
    });

    // Calculate weighted score with Laplace smoothing
    const smoothing = 2;
    source.usageStats.learningScore = (weightedPositive + 1) / (weightedTotal + smoothing);

    // Calculate 95% confidence interval using Wilson score interval
    const n = weightedTotal;
    const p = weightedPositive / weightedTotal;
    const z = 1.96; // 95% confidence

    if (n > 0) {
      const denominator = 1 + (z * z) / n;
      const center = (p + (z * z) / (2 * n)) / denominator;
      const margin = (z / denominator) * Math.sqrt((p * (1 - p) / n) + (z * z) / (4 * n * n));
      
      source.usageStats.confidenceInterval = [
        Math.max(0, center - margin),
        Math.min(1, center + margin)
      ];
    } else {
      source.usageStats.confidenceInterval = [0.3, 0.7];
    }
  }

  // Automatically adjust source priority based on learning score
  private autoAdjustPriority(sourceId: string, source: DocumentSource): void {
    const score = source.usageStats.learningScore;
    const [lower, upper] = source.usageStats.confidenceInterval;
    const confidence = upper - lower;

    // Only auto-adjust if confidence interval is narrow enough (< 0.3)
    if (confidence > 0.3) {
      console.log(`Skipping auto-adjust for "${source.name}" - confidence too low (${(confidence * 100).toFixed(1)}%)`);
      return;
    }

    let newPriority: SourcePriority;

    // Map learning score to priority levels
    if (score >= 0.8) {
      newPriority = 5; // Very High
    } else if (score >= 0.65) {
      newPriority = 4; // High
    } else if (score >= 0.35) {
      newPriority = 3; // Normal
    } else if (score >= 0.2) {
      newPriority = 2; // Low
    } else {
      newPriority = 1; // Very Low
    }

    // Only update if priority actually changed
    if (newPriority !== source.priority) {
      const oldPriority = source.priority;
      source.priority = newPriority;
      console.log(
        `Auto-adjusted priority for "${source.name}" from ${oldPriority} to ${newPriority} (score: ${score.toFixed(2)}, confidence: ${((1-confidence) * 100).toFixed(1)}%)`
      );
    }
  }

  // A/B Testing methods
  startABTest(name: string, description: string, configB: SourceConfiguration): ABTest {
    // Create control configuration (current state)
    const configA: SourceConfiguration = {
      name: 'Control (Current)',
      sourcePriorities: new Map(
        Array.from(this.sources.values()).map(s => [s.id, s.priority])
      ),
    };

    const test: ABTest = {
      id: `ab_${Date.now()}`,
      name,
      description,
      startedAt: Date.now(),
      configA,
      configB,
      activeConfig: Math.random() < 0.5 ? 'A' : 'B', // Random assignment
      results: {
        configAStats: { questionsAnswered: 0, positiveRatings: 0, negativeRatings: 0, avgConfidence: 0 },
        configBStats: { questionsAnswered: 0, positiveRatings: 0, negativeRatings: 0, avgConfidence: 0 },
      },
    };

    this.activeABTest = test;
    this.applyABTestConfig(test.activeConfig);
    this.saveABTest();

    console.log(`Started A/B test: ${name} (active config: ${test.activeConfig})`);
    return test;
  }

  private applyABTestConfig(config: 'A' | 'B'): void {
    if (!this.activeABTest) return;

    const configData = config === 'A' ? this.activeABTest.configA : this.activeABTest.configB;
    
    // Apply priorities from configuration
    configData.sourcePriorities.forEach((priority, sourceId) => {
      const source = this.sources.get(sourceId);
      if (source) {
        source.priority = priority;
      }
    });

    this.saveSourcesToStorage();
  }

  switchABTestConfig(): void {
    if (!this.activeABTest || this.activeABTest.endedAt) return;

    this.activeABTest.activeConfig = this.activeABTest.activeConfig === 'A' ? 'B' : 'A';
    this.applyABTestConfig(this.activeABTest.activeConfig);
    this.saveABTest();

    console.log(`Switched to config ${this.activeABTest.activeConfig}`);
  }

  endABTest(): ABTest | null {
    if (!this.activeABTest || this.activeABTest.endedAt) return null;

    this.activeABTest.endedAt = Date.now();

    // Calculate statistical significance (simple chi-square test approximation)
    const statsA = this.activeABTest.results.configAStats;
    const statsB = this.activeABTest.results.configBStats;

    const rateA = statsA.questionsAnswered > 0 ? statsA.positiveRatings / statsA.questionsAnswered : 0;
    const rateB = statsB.questionsAnswered > 0 ? statsB.positiveRatings / statsB.questionsAnswered : 0;

    // Determine winner
    if (Math.abs(rateA - rateB) < 0.05 || statsA.questionsAnswered < 10 || statsB.questionsAnswered < 10) {
      this.activeABTest.results.winner = 'inconclusive';
    } else {
      this.activeABTest.results.winner = rateA > rateB ? 'A' : 'B';
    }

    // Simple p-value approximation
    const n = statsA.questionsAnswered + statsB.questionsAnswered;
    if (n > 20) {
      const pooledRate = (statsA.positiveRatings + statsB.positiveRatings) / n;
      const se = Math.sqrt(pooledRate * (1 - pooledRate) * (1/statsA.questionsAnswered + 1/statsB.questionsAnswered));
      const z = Math.abs(rateA - rateB) / se;
      this.activeABTest.results.pValue = 2 * (1 - this.normalCDF(z));
    }

    const result = { ...this.activeABTest };
    this.saveABTest();

    console.log(`Ended A/B test: ${this.activeABTest.name}. Winner: ${this.activeABTest.results.winner}`);
    return result;
  }

  private normalCDF(z: number): number {
    // Approximation of standard normal CDF
    return 0.5 * (1 + Math.sign(z) * Math.sqrt(1 - Math.exp(-2 * z * z / Math.PI)));
  }

  getActiveABTest(): ABTest | null {
    return this.activeABTest;
  }

  applyWinningConfig(): boolean {
    if (!this.activeABTest || !this.activeABTest.endedAt || !this.activeABTest.results.winner) {
      return false;
    }

    const winner = this.activeABTest.results.winner;
    if (winner === 'inconclusive') return false;

    this.applyABTestConfig(winner);
    this.activeABTest = null;
    this.saveABTest();

    console.log(`Applied winning config: ${winner}`);
    return true;
  }

  clearABTest(): void {
    this.activeABTest = null;
    this.saveABTest();
  }

  // Export/Import configuration
  exportConfiguration(): string {
    const config = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      appSettings: loadSettings(),
      ollamaConfig: this.config,
      sources: Array.from(this.sources.values()),
      activeABTest: this.activeABTest,
    };
    return JSON.stringify(config, null, 2);
  }

  importConfiguration(jsonString: string): { success: boolean; message: string; warnings?: string[] } {
    try {
      const config = JSON.parse(jsonString);
      const warnings: string[] = [];

      // Validate structure
      if (!config.version) {
        return { success: false, message: 'Invalid configuration file: missing version' };
      }

      // Import app settings
      if (config.appSettings) {
        saveSettings(config.appSettings);
        console.log('Imported app settings');
      }

      // Import Ollama config
      if (config.ollamaConfig) {
        this.config = config.ollamaConfig;
        console.log('Imported Ollama configuration');
      }

      // Import sources (note: embeddings are not included, sources are references only)
      if (config.sources && Array.isArray(config.sources)) {
        this.sources = new Map(config.sources.map((s: DocumentSource) => [s.id, s]));
        this.saveSourcesToStorage();
        warnings.push(
          `Imported ${config.sources.length} source(s). Note: Vector embeddings are not included - you'll need to re-upload documents.`
        );
        console.log('Imported sources metadata');
      }

      // Import A/B test
      if (config.activeABTest) {
        this.activeABTest = config.activeABTest;
        this.saveABTest();
        console.log('Imported active A/B test');
      }

      return {
        success: true,
        message: 'Configuration imported successfully',
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      console.error('Import failed:', error);
      return {
        success: false,
        message: `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // Generate intelligent recommendations for source management
  generateRecommendations(): SourceRecommendation[] {
    const recommendations: SourceRecommendation[] = [];
    const now = Date.now();

    for (const source of this.sources.values()) {
      const stats = source.usageStats;
      const totalRatings = stats.positiveRatings + stats.negativeRatings;
      const positiveRate = totalRatings > 0 ? stats.positiveRatings / totalRatings : 0;
      const [lower, upper] = stats.confidenceInterval;
      const confidenceWidth = upper - lower;
      const daysSinceLastUse = stats.lastUsed ? (now - stats.lastUsed) / (1000 * 60 * 60 * 24) : undefined;

      // Insufficient data - need more feedback
      if (totalRatings < 3) {
        recommendations.push({
          sourceId: source.id,
          sourceName: source.name,
          type: 'keep_current',
          currentPriority: source.priority,
          reason: 'Insufficient feedback data. Continue using to gather performance metrics.',
          confidence: 'low',
          impact: 'low',
          metrics: {
            learningScore: stats.learningScore,
            confidenceInterval: stats.confidenceInterval,
            totalRatings,
            positiveRate,
            timesUsed: stats.timesUsed,
            daysSinceLastUse,
          },
        });
        continue;
      }

      // High confidence recommendations
      if (confidenceWidth < 0.2) {
        // Excellent performer - should be high priority
        if (stats.learningScore >= 0.85 && source.priority < 5) {
          recommendations.push({
            sourceId: source.id,
            sourceName: source.name,
            type: 'increase_priority',
            currentPriority: source.priority,
            suggestedPriority: Math.min(5, source.priority + 1) as SourcePriority,
            reason: `Excellent performance with ${(positiveRate * 100).toFixed(0)}% positive feedback. High confidence in quality.`,
            confidence: 'high',
            impact: 'high',
            metrics: {
              learningScore: stats.learningScore,
              confidenceInterval: stats.confidenceInterval,
              totalRatings,
              positiveRate,
              timesUsed: stats.timesUsed,
              daysSinceLastUse,
            },
          });
        }
        // Good performer but currently low priority
        else if (stats.learningScore >= 0.7 && source.priority <= 2) {
          recommendations.push({
            sourceId: source.id,
            sourceName: source.name,
            type: 'increase_priority',
            currentPriority: source.priority,
            suggestedPriority: 3 as SourcePriority,
            reason: `Strong positive feedback (${(positiveRate * 100).toFixed(0)}%) suggests this source deserves higher priority.`,
            confidence: 'high',
            impact: 'medium',
            metrics: {
              learningScore: stats.learningScore,
              confidenceInterval: stats.confidenceInterval,
              totalRatings,
              positiveRate,
              timesUsed: stats.timesUsed,
              daysSinceLastUse,
            },
          });
        }
        // Poor performer - consider removing or lowering priority
        else if (stats.learningScore <= 0.3) {
          if (totalRatings >= 10) {
            recommendations.push({
              sourceId: source.id,
              sourceName: source.name,
              type: 'remove',
              currentPriority: source.priority,
              reason: `Consistently poor performance with only ${(positiveRate * 100).toFixed(0)}% positive feedback across ${totalRatings} ratings. Consider removing.`,
              confidence: 'high',
              impact: 'high',
              metrics: {
                learningScore: stats.learningScore,
                confidenceInterval: stats.confidenceInterval,
                totalRatings,
                positiveRate,
                timesUsed: stats.timesUsed,
                daysSinceLastUse,
              },
            });
          } else if (source.priority > 1) {
            recommendations.push({
              sourceId: source.id,
              sourceName: source.name,
              type: 'decrease_priority',
              currentPriority: source.priority,
              suggestedPriority: Math.max(1, source.priority - 1) as SourcePriority,
              reason: `Low performance (${(positiveRate * 100).toFixed(0)}% positive). Reduce priority or gather more feedback.`,
              confidence: 'medium',
              impact: 'medium',
              metrics: {
                learningScore: stats.learningScore,
                confidenceInterval: stats.confidenceInterval,
                totalRatings,
                positiveRate,
                timesUsed: stats.timesUsed,
                daysSinceLastUse,
              },
            });
          }
        }
        // Mediocre performer with high priority
        else if (stats.learningScore < 0.5 && source.priority >= 4) {
          recommendations.push({
            sourceId: source.id,
            sourceName: source.name,
            type: 'decrease_priority',
            currentPriority: source.priority,
            suggestedPriority: 3 as SourcePriority,
            reason: `Average performance (${(positiveRate * 100).toFixed(0)}% positive) doesn't justify high priority.`,
            confidence: 'high',
            impact: 'medium',
            metrics: {
              learningScore: stats.learningScore,
              confidenceInterval: stats.confidenceInterval,
              totalRatings,
              positiveRate,
              timesUsed: stats.timesUsed,
              daysSinceLastUse,
            },
          });
        }
      }
      // Medium confidence recommendations
      else if (confidenceWidth < 0.4) {
        if (stats.learningScore >= 0.75 && source.priority < 4) {
          recommendations.push({
            sourceId: source.id,
            sourceName: source.name,
            type: 'increase_priority',
            currentPriority: source.priority,
            suggestedPriority: Math.min(5, source.priority + 1) as SourcePriority,
            reason: `Good early results (${(positiveRate * 100).toFixed(0)}% positive). Consider increasing priority as more data confirms performance.`,
            confidence: 'medium',
            impact: 'medium',
            metrics: {
              learningScore: stats.learningScore,
              confidenceInterval: stats.confidenceInterval,
              totalRatings,
              positiveRate,
              timesUsed: stats.timesUsed,
              daysSinceLastUse,
            },
          });
        } else if (stats.learningScore <= 0.25 && totalRatings >= 5) {
          recommendations.push({
            sourceId: source.id,
            sourceName: source.name,
            type: 'decrease_priority',
            currentPriority: source.priority,
            suggestedPriority: Math.max(1, source.priority - 1) as SourcePriority,
            reason: `Concerning trend with ${(positiveRate * 100).toFixed(0)}% positive feedback. Monitor closely or reduce priority.`,
            confidence: 'medium',
            impact: 'medium',
            metrics: {
              learningScore: stats.learningScore,
              confidenceInterval: stats.confidenceInterval,
              totalRatings,
              positiveRate,
              timesUsed: stats.timesUsed,
              daysSinceLastUse,
            },
          });
        }
      }

      // Unused source recommendations
      if (daysSinceLastUse !== undefined && daysSinceLastUse > 30 && stats.timesUsed < 5) {
        recommendations.push({
          sourceId: source.id,
          sourceName: source.name,
          type: 'remove',
          currentPriority: source.priority,
          reason: `Not used in ${Math.floor(daysSinceLastUse)} days and rarely referenced. Consider removing to reduce noise.`,
          confidence: 'medium',
          impact: 'low',
          metrics: {
            learningScore: stats.learningScore,
            confidenceInterval: stats.confidenceInterval,
            totalRatings,
            positiveRate,
            timesUsed: stats.timesUsed,
            daysSinceLastUse,
          },
        });
      }
    }

    // Sort by impact (high first), then confidence (high first)
    return recommendations.sort((a, b) => {
      const impactOrder = { high: 0, medium: 1, low: 2 };
      const confidenceOrder = { high: 0, medium: 1, low: 2 };
      
      const impactDiff = impactOrder[a.impact] - impactOrder[b.impact];
      if (impactDiff !== 0) return impactDiff;
      
      return confidenceOrder[a.confidence] - confidenceOrder[b.confidence];
    });
  }

  // Apply a recommendation
  applyRecommendation(recommendation: SourceRecommendation): boolean {
    const source = this.sources.get(recommendation.sourceId);
    if (!source) return false;

    switch (recommendation.type) {
      case 'increase_priority':
      case 'decrease_priority':
        if (recommendation.suggestedPriority) {
          source.priority = recommendation.suggestedPriority;
          this.saveSourcesToStorage();
          console.log(`Applied recommendation: ${source.name} priority ${recommendation.currentPriority} → ${recommendation.suggestedPriority}`);
          return true;
        }
        break;
      
      case 'remove':
        this.removeSource(recommendation.sourceId);
        console.log(`Applied recommendation: Removed ${source.name}`);
        return true;
      
      case 'keep_current':
        // No action needed
        return true;
    }

    return false;
  }
}

// Singleton instance
export const ragService = new RAGService();
