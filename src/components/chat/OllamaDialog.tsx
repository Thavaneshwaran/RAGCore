import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Check, AlertCircle, Server, RefreshCw, Settings, Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  OllamaModelParams,
  DEFAULT_MODEL_PARAMS,
  PREDEFINED_LLM_MODELS,
  PREDEFINED_EMBEDDING_MODELS,
} from '@/lib/rag/types';

interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
  digest: string;
}

interface OllamaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectModel: (
    model: string,
    baseUrl: string,
    embeddingModel: string,
    params: OllamaModelParams
  ) => void;
  currentModel?: string;
  currentEmbeddingModel?: string;
  currentParams?: OllamaModelParams;
}

export function OllamaDialog({
  open,
  onOpenChange,
  onSelectModel,
  currentModel,
  currentEmbeddingModel,
  currentParams,
}: OllamaDialogProps) {
  const [baseUrl, setBaseUrl] = useState('http://localhost:11434');
  const [installedModels, setInstalledModels] = useState<OllamaModel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  // Selected models
  const [selectedLLM, setSelectedLLM] = useState(currentModel || '');
  const [selectedEmbedding, setSelectedEmbedding] = useState(
    currentEmbeddingModel || 'nomic-embed-text:latest'
  );
  
  // Model parameters
  const [params, setParams] = useState<OllamaModelParams>(
    currentParams || DEFAULT_MODEL_PARAMS
  );

  const fetchModels = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${baseUrl}/api/tags`);
      
      if (!response.ok) {
        throw new Error(`Failed to connect: ${response.statusText}`);
      }
      
      const data = await response.json();
      setInstalledModels(data.models || []);
      setIsConnected(true);
      
      if (!data.models || data.models.length === 0) {
        setError('No models installed. Pull models using: ollama pull <model-name>');
      }
    } catch (err) {
      setIsConnected(false);
      if (err instanceof TypeError && err.message.includes('fetch')) {
        setError('Cannot connect to Ollama. Make sure Ollama is running on ' + baseUrl);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to fetch models');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchModels();
    }
  }, [open]);

  const formatSize = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) {
      return `${gb.toFixed(1)} GB`;
    }
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(0)} MB`;
  };

  const isModelInstalled = (modelName: string) => {
    return installedModels.some(m => m.name === modelName || m.name.startsWith(modelName.split(':')[0]));
  };

  const handleConfirm = () => {
    if (selectedLLM && selectedEmbedding) {
      onSelectModel(selectedLLM, baseUrl, selectedEmbedding, params);
      onOpenChange(false);
    }
  };

  const updateParam = (key: keyof OllamaModelParams, value: number) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="w-5 h-5 text-primary" />
            Configure Ollama
          </DialogTitle>
          <DialogDescription>
            Select LLM and embedding models for your RAGCore assistant.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Base URL input */}
          <div className="space-y-2">
            <Label>Ollama URL</Label>
            <div className="flex gap-2">
              <Input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="http://localhost:11434"
                className="flex-1"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={fetchModels}
                disabled={isLoading}
                aria-label="Refresh models"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Connection status */}
          {isConnected && !error && (
            <div className="flex items-center gap-2 text-sm text-green-500">
              <Check className="w-4 h-4" />
              Connected to Ollama ({installedModels.length} models installed)
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Tabs defaultValue="llm" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="llm">LLM Model</TabsTrigger>
              <TabsTrigger value="embedding">Embedding</TabsTrigger>
              <TabsTrigger value="params">Parameters</TabsTrigger>
            </TabsList>

            {/* LLM Model Selection */}
            <TabsContent value="llm" className="space-y-3">
              <Label className="text-sm font-medium">Select LLM Model</Label>
              <div className="max-h-48 overflow-y-auto space-y-1 custom-scrollbar">
                {installedModels.length > 0 ? (
                  installedModels.map((model) => (
                    <button
                      key={model.name}
                      onClick={() => setSelectedLLM(model.name)}
                      className={cn(
                        'w-full flex items-center justify-between p-2.5 rounded-lg text-left transition-colors',
                        'hover:bg-secondary/80 border border-transparent',
                        selectedLLM === model.name
                          ? 'bg-primary/10 border-primary/30'
                          : 'bg-secondary/50'
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground text-sm">
                            {model.name}
                          </span>
                          {selectedLLM === model.name && (
                            <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatSize(model.size)}
                        </span>
                      </div>
                    </button>
                  ))
                ) : (
                  PREDEFINED_LLM_MODELS.map((model) => {
                    const installed = isModelInstalled(model.name);
                    return (
                      <button
                        key={model.name}
                        onClick={() => setSelectedLLM(model.name)}
                        className={cn(
                          'w-full flex items-center justify-between p-2.5 rounded-lg text-left transition-colors',
                          'hover:bg-secondary/80 border border-transparent',
                          selectedLLM === model.name
                            ? 'bg-primary/10 border-primary/30'
                            : 'bg-secondary/50',
                          'opacity-60'
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground text-sm">
                              {model.name}
                            </span>
                            {selectedLLM === model.name && (
                              <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {model.description}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </TabsContent>

            {/* Embedding Model Selection */}
            <TabsContent value="embedding" className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Database className="w-4 h-4" />
                Select Embedding Model
              </Label>
              <div className="max-h-48 overflow-y-auto space-y-1 custom-scrollbar">
                {installedModels.length > 0 ? (
                  installedModels
                    .filter(model => 
                      model.name.includes('embed') || 
                      PREDEFINED_EMBEDDING_MODELS.some(p => model.name.includes(p.name.split(':')[0]))
                    )
                    .map((model) => (
                      <button
                        key={model.name}
                        onClick={() => setSelectedEmbedding(model.name)}
                        className={cn(
                          'w-full flex items-center justify-between p-2.5 rounded-lg text-left transition-colors',
                          'hover:bg-secondary/80 border border-transparent',
                          selectedEmbedding === model.name
                            ? 'bg-primary/10 border-primary/30'
                            : 'bg-secondary/50'
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground text-sm">
                              {model.name}
                            </span>
                            {selectedEmbedding === model.name && (
                              <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatSize(model.size)}
                          </span>
                        </div>
                      </button>
                    ))
                ) : (
                  PREDEFINED_EMBEDDING_MODELS.map((model) => {
                    const installed = isModelInstalled(model.name);
                    return (
                      <button
                        key={model.name}
                        onClick={() => setSelectedEmbedding(model.name)}
                        className={cn(
                          'w-full flex items-center justify-between p-2.5 rounded-lg text-left transition-colors',
                          'hover:bg-secondary/80 border border-transparent',
                          selectedEmbedding === model.name
                            ? 'bg-primary/10 border-primary/30'
                            : 'bg-secondary/50',
                          'opacity-60'
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground text-sm">
                              {model.name}
                            </span>
                            {selectedEmbedding === model.name && (
                              <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {model.description} • {model.dimensions}d
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </TabsContent>

            {/* Model Parameters */}
            <TabsContent value="params" className="space-y-4">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Model Parameters
              </Label>
              
              <div className="space-y-4">
                {/* Temperature */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Temperature</span>
                    <span className="text-muted-foreground">{params.temperature.toFixed(2)}</span>
                  </div>
                  <Slider
                    value={[params.temperature]}
                    onValueChange={([v]) => updateParam('temperature', v)}
                    min={0}
                    max={2}
                    step={0.1}
                  />
                  <p className="text-xs text-muted-foreground">
                    Controls randomness. Lower = more focused, higher = more creative.
                  </p>
                </div>

                {/* Context Length */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Context Length</span>
                    <span className="text-muted-foreground">{params.contextLength}</span>
                  </div>
                  <Slider
                    value={[params.contextLength]}
                    onValueChange={([v]) => updateParam('contextLength', v)}
                    min={512}
                    max={32768}
                    step={512}
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum tokens for context window.
                  </p>
                </div>

                {/* Top P */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Top P</span>
                    <span className="text-muted-foreground">{params.topP.toFixed(2)}</span>
                  </div>
                  <Slider
                    value={[params.topP]}
                    onValueChange={([v]) => updateParam('topP', v)}
                    min={0}
                    max={1}
                    step={0.05}
                  />
                </div>

                {/* Top K */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Top K</span>
                    <span className="text-muted-foreground">{params.topK}</span>
                  </div>
                  <Slider
                    value={[params.topK]}
                    onValueChange={([v]) => updateParam('topK', v)}
                    min={1}
                    max={100}
                    step={1}
                  />
                </div>

                {/* Repeat Penalty */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Repeat Penalty</span>
                    <span className="text-muted-foreground">{params.repeatPenalty.toFixed(2)}</span>
                  </div>
                  <Slider
                    value={[params.repeatPenalty]}
                    onValueChange={([v]) => updateParam('repeatPenalty', v)}
                    min={1}
                    max={2}
                    step={0.05}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Selection Summary */}
          <div className="p-3 rounded-lg bg-secondary/50 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">LLM:</span>
              <span className="font-medium">{selectedLLM || 'Not selected'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Embedding:</span>
              <span className="font-medium">{selectedEmbedding || 'Not selected'}</span>
            </div>
          </div>

          {/* Confirm Button */}
          <Button
            onClick={handleConfirm}
            disabled={!selectedLLM || !selectedEmbedding || !isConnected}
            className="w-full"
          >
            Apply Configuration
          </Button>

          {/* Help text */}
          <div className="text-xs text-muted-foreground border-t border-border pt-3 space-y-1">
            <p>Don't have Ollama? <a href="https://ollama.ai" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Download here</a></p>
            <p>Pull models: <code className="px-1 py-0.5 bg-secondary rounded">ollama pull llama3.1:8b</code></p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
