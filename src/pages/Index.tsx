import { useState, useRef, useEffect, useCallback } from 'react';
import { Message, Source } from '@/types/chat';
import { uploadPdf, loadUrl, startStreaming, clearConversation, isRAGConfigured, getChunkCount } from '@/api';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { ChatInput } from '@/components/chat/ChatInput';
import { SourcesPanel } from '@/components/chat/SourcesPanel';
import { SourcesManager } from '@/components/chat/SourcesManager';
import { UploadZone } from '@/components/chat/UploadZone';
import { UrlInput } from '@/components/chat/UrlInput';
import { LearningMode } from '@/components/learning/LearningMode';
import { ConversationHistory } from '@/components/chat/ConversationHistory';
import { ragService } from '@/lib/rag/ragService';
import { OllamaModelParams, DEFAULT_MODEL_PARAMS } from '@/lib/rag/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Database } from 'lucide-react';
import { toast } from 'sonner';
import { loadSettings } from '@/lib/settings';

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  timestamp: number;
}

const CONVERSATIONS_KEY = 'ragcore_conversations';
const CURRENT_CONVERSATION_KEY = 'ragcore_current_conversation';

const Index = () => {
  // Conversation management
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    const saved = localStorage.getItem(CONVERSATIONS_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(() => {
    return localStorage.getItem(CURRENT_CONVERSATION_KEY);
  });
  
  // State
  const [messages, setMessages] = useState<Message[]>(() => {
    if (currentConversationId) {
      const conv = conversations.find(c => c.id === currentConversationId);
      return conv?.messages || [];
    }
    return [];
  });
  const [sources, setSources] = useState<Source[]>([]);
  const [documentLoaded, setDocumentLoaded] = useState(false);
  const [documentInfo, setDocumentInfo] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [showSourcesManager, setShowSourcesManager] = useState(false);
  const [showLearning, setShowLearning] = useState(false);
  const [thinkingMode, setThinkingMode] = useState(false);
  
  // Ollama configuration
  const [selectedModel, setSelectedModel] = useState<string | undefined>();
  const [selectedEmbeddingModel, setSelectedEmbeddingModel] = useState<string | undefined>();
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState<string>('http://localhost:11434');
  const [modelParams, setModelParams] = useState<OllamaModelParams>(DEFAULT_MODEL_PARAMS);

  // Handle Ollama model selection
  const handleSelectModel = (
    model: string, 
    baseUrl: string, 
    embeddingModel: string,
    params: OllamaModelParams
  ) => {
    setSelectedModel(model);
    setSelectedEmbeddingModel(embeddingModel);
    setOllamaBaseUrl(baseUrl);
    setModelParams(params);
    
    // Configure RAG service
    ragService.configure({
      baseUrl,
      model,
      embeddingModel,
      params,
    });
    
    addSystemMessage(`Connected to Ollama — LLM: ${model}, Embedding: ${embeddingModel}`, false, true);
    toast.success('Ollama configured successfully');
  };

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamCleanupRef = useRef<(() => void) | null>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Add a system message
  const addSystemMessage = useCallback((content: string, isError = false, isSuccess = false) => {
    const message: Message = {
      id: generateId(),
      role: 'system',
      content,
      timestamp: new Date(),
      isError,
      isSuccess,
    };
    setMessages((prev) => [...prev, message]);
  }, []);

  // Save conversations to localStorage
  useEffect(() => {
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
  }, [conversations]);

  // Save current conversation ID
  useEffect(() => {
    if (currentConversationId) {
      localStorage.setItem(CURRENT_CONVERSATION_KEY, currentConversationId);
    }
  }, [currentConversationId]);

  // Update current conversation when messages change
  useEffect(() => {
    if (currentConversationId && messages.length > 0) {
      setConversations(prev => prev.map(conv => {
        if (conv.id === currentConversationId) {
          // Generate title from first user message if not set
          const title = conv.title || messages.find(m => m.role === 'user')?.content.slice(0, 50) || 'New Chat';
          return {
            ...conv,
            messages,
            title,
            timestamp: Date.now(),
          };
        }
        return conv;
      }));
    }
  }, [messages, currentConversationId]);

  // Create new conversation
  const handleNewConversation = useCallback(() => {
    const newConv: Conversation = {
      id: generateId(),
      title: 'New Chat',
      messages: [],
      timestamp: Date.now(),
    };
    setConversations(prev => [newConv, ...prev]);
    setCurrentConversationId(newConv.id);
    setMessages([]);
    setSources([]);
    setDocumentLoaded(false);
    setDocumentInfo('');
    toast.success('Started new conversation');
  }, []);

  // Select conversation
  const handleSelectConversation = useCallback((id: string) => {
    const conv = conversations.find(c => c.id === id);
    if (conv) {
      setCurrentConversationId(id);
      setMessages(conv.messages);
      toast.success('Switched conversation');
    }
  }, [conversations]);

  // Delete conversation
  const handleDeleteConversation = useCallback((id: string) => {
    setConversations(prev => prev.filter(c => c.id !== id));
    if (currentConversationId === id) {
      handleNewConversation();
    }
    toast.success('Conversation deleted');
  }, [currentConversationId, handleNewConversation]);

  // Initialize with a conversation if none exists
  useEffect(() => {
    if (conversations.length === 0 && !currentConversationId) {
      handleNewConversation();
    }
  }, []);


  // Check if current model supports thinking mode
  const supportsThinkingMode = useCallback((): boolean => {
    const settings = loadSettings();
    
    // Check for remote API mode
    if (settings.mode === 'remote' && settings.remoteConfig) {
      const { llmModel, llmProvider } = settings.remoteConfig;
      
      // OpenAI o1 models support thinking
      if (llmProvider === 'openai' && llmModel.includes('o1')) {
        return true;
      }
      
      // Google Gemini thinking models
      if (llmProvider === 'gemini' && llmModel.includes('thinking')) {
        return true;
      }
      
      // Lovable AI thinking-capable models
      if (llmProvider === 'lovable') {
        const thinkingModels = ['google/gemini-3-pro', 'openai/gpt-5'];
        return thinkingModels.some(model => llmModel.includes(model));
      }
    }
    
    // Local Ollama models - check if deepseek or similar thinking models
    if (settings.mode === 'local' && selectedModel) {
      return selectedModel.includes('deepseek') || 
             selectedModel.includes('thinking') ||
             selectedModel.includes('o1');
    }
    
    return false;
  }, [selectedModel]);

  // Handle PDF upload
  const handleUpload = async (file: File) => {
    if (!isRAGConfigured()) {
      toast.error('Please configure your LLM provider first (Settings → Mode or Connect Ollama)');
      return;
    }
    
    setIsUploading(true);
    setUploadProgress('Starting...');
    setShowUpload(false);

    try {
      const result = await uploadPdf(file, (stage, current, total) => {
        const percent = Math.round((current / total) * 100);
        setUploadProgress(`${stage}: ${percent}%`);
      });
      
      setDocumentLoaded(true);
      setDocumentInfo(`${result.pages} pages, ${result.chunks} chunks`);
      addSystemMessage(
        `Uploaded "${file.name}" — ${result.pages} pages, ${result.chunks} chunks processed`,
        false,
        true
      );
      toast.success(`PDF processed: ${result.chunks} chunks embedded`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      addSystemMessage(errorMessage, true);
      toast.error(errorMessage);
    } finally {
      setIsUploading(false);
      setUploadProgress('');
    }
  };

  // Handle URL load
  const handleLoadUrl = async (url: string) => {
    if (!isRAGConfigured()) {
      toast.error('Please configure your LLM provider first (Settings → Mode or Connect Ollama)');
      return;
    }
    
    setIsLoadingUrl(true);
    setShowUrlInput(false);

    try {
      const result = await loadUrl(url, (stage, current, total) => {
        const percent = Math.round((current / total) * 100);
        setUploadProgress(`${stage}: ${percent}%`);
      });
      
      setDocumentLoaded(true);
      setDocumentInfo(`${result.chunks} chunks`);
      addSystemMessage(`Loaded URL — ${result.chunks} chunks processed`, false, true);
      toast.success(`URL processed: ${result.chunks} chunks embedded`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load URL';
      addSystemMessage(errorMessage, true);
      toast.error(errorMessage);
    } finally {
      setIsLoadingUrl(false);
      setUploadProgress('');
    }
  };

  // Handle sending a question
  const handleSend = useCallback((question: string, useThinkingMode = false) => {
    if (!isRAGConfigured()) {
      toast.error('Please configure your LLM provider first');
      return;
    }
    
    if (isStreaming) return;

    // Add user message
    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: question,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    // Add thinking indicator if thinking mode is enabled
    if (useThinkingMode) {
      const thinkingMessage: Message = {
        id: generateId(),
        role: 'system',
        content: '🧠 Thinking deeply about your question...',
        timestamp: new Date(),
        isSuccess: true,
      };
      setMessages((prev) => [...prev, thinkingMessage]);
    }

    // Create assistant message placeholder
    const assistantId = generateId();
    const assistantMessage: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    };
    setMessages((prev) => [...prev, assistantMessage]);
    setIsStreaming(true);

    // Start streaming
    const cleanup = startStreaming(
      question,
      // onToken
      (token: string) => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId
              ? { ...msg, content: msg.content + token }
              : msg
          )
        );
      },
      // onSources
      (sourcesArray: string[]) => {
        const newSources: Source[] = sourcesArray.map((content, index) => {
          // Parse priority and weighted score from source string
          // Format: "[source] (Priority: X | Base: Y% | Weighted: Z%)\ncontent"
          let priority: number | undefined;
          let weightedScore: number | undefined;
          let cleanContent = content;
          
          const priorityMatch = content.match(/Priority:\s*(\d+)/);
          if (priorityMatch) {
            priority = parseInt(priorityMatch[1]);
          }
          
          const weightedMatch = content.match(/Weighted:\s*([\d.]+)%/);
          if (weightedMatch) {
            weightedScore = parseFloat(weightedMatch[1]) / 100;
          }
          
          // Keep the original content as-is for display
          return {
            id: `${assistantId}-source-${index}`,
            content: cleanContent,
            priority,
            weightedScore,
          };
        });
        setSources(newSources);
        
        // Extract source IDs and attach to the assistant message
        const sourceIds = ragService.getSources().map(s => s.id);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId ? { ...msg, sourceIds } : msg
          )
        );
        
        // Record that these sources were used
        ragService.recordSourceUsage(sourceIds);
        
        if (newSources.length > 0) {
          // Auto-open sources panel on desktop
          if (window.innerWidth >= 1024) {
            setSourcesOpen(true);
          }
        }
      },
      // onDone
      () => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId ? { ...msg, isStreaming: false } : msg
          )
        );
        setIsStreaming(false);
        streamCleanupRef.current = null;
      },
      // onError
      (err: Error) => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId ? { ...msg, isStreaming: false } : msg
          )
        );
        addSystemMessage(err.message || 'Stream error occurred', true);
        setIsStreaming(false);
        streamCleanupRef.current = null;
      }
    );

    streamCleanupRef.current = cleanup;
  }, [isStreaming, addSystemMessage]);

  // Handle clear conversation
  const handleClear = async () => {
    // Cleanup any active stream
    if (streamCleanupRef.current) {
      streamCleanupRef.current();
      streamCleanupRef.current = null;
    }

    setMessages([]);
    setSources([]);
    setIsStreaming(false);
    setDocumentLoaded(false);
    setDocumentInfo('');
    
    // Clear RAG service
    await clearConversation();
    toast.success('Conversation and documents cleared');
  };

  // Handle user feedback on an answer
  const handleFeedback = useCallback((messageId: string, isPositive: boolean) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id === messageId) {
          // Process feedback with RAG service
          if (msg.sourceIds && msg.sourceIds.length > 0) {
            ragService.processFeedback(msg.sourceIds, isPositive);
          }
          return { ...msg, feedback: isPositive ? 'positive' : 'negative' };
        }
        return msg;
      })
    );
  }, []);

  const chunkCount = getChunkCount();
  const settings = loadSettings();

  return (
    <div className="flex h-screen bg-background">
      {showLearning ? (
        <div className="flex-1 flex flex-col min-w-0">
          <LearningMode onBack={() => setShowLearning(false)} />
        </div>
      ) : (
        <>
          {/* Conversation History Sidebar */}
          <ConversationHistory
            conversations={conversations}
            currentConversationId={currentConversationId}
            onSelectConversation={handleSelectConversation}
            onNewConversation={handleNewConversation}
            onDeleteConversation={handleDeleteConversation}
          />
          
          {/* Main chat area */}
          <div className="flex-1 flex flex-col min-w-0">{/* ... keep existing code */}
            {/* Header */}
            <ChatHeader
              documentLoaded={documentLoaded}
              documentInfo={documentInfo}
              onClear={handleClear}
              onToggleSources={() => setSourcesOpen(!sourcesOpen)}
              sourcesOpen={sourcesOpen}
              sourceCount={sources.length}
              selectedModel={selectedModel}
              selectedEmbeddingModel={selectedEmbeddingModel}
              modelParams={modelParams}
              onSelectModel={handleSelectModel}
              isLoading={isUploading || isLoadingUrl || isStreaming}
            />

            {/* Messages area */}
            <main className="flex-1 overflow-y-auto custom-scrollbar">
          {messages.length === 0 && !showUpload && !showUrlInput ? (
            // Welcome screen
            <div className="flex flex-col items-center justify-center h-full px-4 py-8">
              <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mb-6">
                <svg
                  className="w-8 h-8 text-primary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Welcome to RAGCore
              </h2>
              <p className="text-muted-foreground text-center max-w-md mb-4">
                {selectedModel ? (
                  <>Connected to <span className="text-primary font-medium">{selectedModel}</span>. Upload documents (PDF, PPT, DOC, TXT, images) or provide a URL to get started.</>
                ) : (
                  <>
                    <span className="text-primary font-medium">Quick Start Options:</span><br/>
                    • <span className="text-primary font-medium">Local Mode:</span> Click "Connect Ollama" for unlimited local processing<br/>
                    • <span className="text-primary font-medium">Cloud Mode:</span> Go to Settings → Mode → Remote, then configure API keys in Remote Providers tab
                  </>
                )}
              </p>
              
              {/* Status indicator */}
              {chunkCount > 0 && (
                <div className="mb-4 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm">
                  {chunkCount} chunks in vector store
                </div>
              )}

              {/* Quick action buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setShowUpload(true)}
                  disabled={!isRAGConfigured()}
                  className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg
                    className="w-5 h-5 text-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  <span className="text-sm font-medium">Upload Document</span>
                </button>
                <button
                  onClick={() => setShowUrlInput(true)}
                  disabled={!isRAGConfigured()}
                  className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg
                    className="w-5 h-5 text-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                    />
                  </svg>
                  <span className="text-sm font-medium">Provide URL</span>
                </button>
                
                {chunkCount > 0 && (
                  <Button
                    onClick={() => setShowSourcesManager(true)}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <Database className="w-5 h-5" />
                    <span className="text-sm font-medium">Manage Sources</span>
                  </Button>
                )}
              </div>
              
              {!isRAGConfigured() && (
                <p className="text-xs text-muted-foreground mt-4">
                  Configure your LLM provider (Settings → Mode or Connect Ollama) to enable document upload
                </p>
              )}
            </div>
          ) : (
            <div className="pb-4">
              {/* Upload zone */}
              {showUpload && (
                <div className="max-w-3xl mx-auto mt-4">
                  <UploadZone
                    onUpload={handleUpload}
                    isUploading={isUploading}
                    uploadProgress={uploadProgress}
                  />
                  {!isUploading && (
                    <button
                      onClick={() => setShowUpload(false)}
                      className="w-full text-center text-sm text-muted-foreground hover:text-foreground mt-2"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              )}

              {/* URL input */}
              {showUrlInput && (
                <div className="max-w-3xl mx-auto mt-4 px-4">
                  <UrlInput
                    onSubmit={handleLoadUrl}
                    onClose={() => setShowUrlInput(false)}
                    isLoading={isLoadingUrl}
                  />
                </div>
              )}

              {/* Messages */}
              {messages.map((message) => (
                <ChatMessage 
                  key={message.id} 
                  message={message}
                  onFeedback={handleFeedback}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </main>

        {/* Input area */}
        <ChatInput
          onSend={handleSend}
          onUploadClick={() => {
            if (!isRAGConfigured()) {
              toast.error('Please configure your LLM provider first');
              return;
            }
            setShowUpload(true);
            setShowUrlInput(false);
          }}
          onUrlClick={() => {
            if (!isRAGConfigured()) {
              toast.error('Please configure your LLM provider first');
              return;
            }
            setShowUrlInput(true);
            setShowUpload(false);
          }}
          onLearningClick={() => setShowLearning(true)}
          disabled={isStreaming}
          isLoading={isStreaming || isUploading || isLoadingUrl}
          hasDocument={documentLoaded || chunkCount > 0}
          supportsThinking={supportsThinkingMode()}
          thinkingMode={thinkingMode}
          onThinkingModeChange={setThinkingMode}
        />
      </div>

      {/* Sources panel */}
      <SourcesPanel
        sources={sources}
        isOpen={sourcesOpen}
        onClose={() => setSourcesOpen(false)}
      />
      
      {/* Sources manager dialog */}
      <Dialog open={showSourcesManager} onOpenChange={setShowSourcesManager}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Manage Document Sources
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2">
            <SourcesManager onUpdate={() => {
              // Refresh the document info
              const sources = ragService.getSources();
              if (sources.length > 0) {
                setDocumentLoaded(true);
                const totalChunks = sources.reduce((sum, s) => sum + s.chunks, 0);
                setDocumentInfo(`${sources.length} source${sources.length > 1 ? 's' : ''} loaded — ${totalChunks} chunks`);
              } else {
                setDocumentLoaded(false);
                setDocumentInfo('');
              }
            }} />
          </div>
        </DialogContent>
      </Dialog>
        </>
      )}
    </div>
  );
};

export default Index;
