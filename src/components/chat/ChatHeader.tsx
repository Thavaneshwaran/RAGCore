import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Trash2, PanelRight, Server, ChevronDown, Database, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OllamaDialog } from './OllamaDialog';
import { OllamaModelParams } from '@/lib/rag/types';
import { SettingsDialog } from '@/components/settings/SettingsDialog';
import { ModeIndicator } from '@/components/settings/ModeIndicator';
import ragcoreLogo from '@/assets/ragcore-logo.png';

interface ChatHeaderProps {
  documentLoaded: boolean;
  documentInfo?: string;
  onClear: () => void;
  onToggleSources: () => void;
  sourcesOpen: boolean;
  sourceCount: number;
  selectedModel?: string;
  selectedEmbeddingModel?: string;
  modelParams?: OllamaModelParams;
  onSelectModel: (model: string, baseUrl: string, embeddingModel: string, params: OllamaModelParams) => void;
  isLoading?: boolean;
}

export function ChatHeader({
  documentLoaded,
  documentInfo,
  onClear,
  onToggleSources,
  sourcesOpen,
  sourceCount,
  selectedModel,
  selectedEmbeddingModel,
  modelParams,
  onSelectModel,
  isLoading = false,
}: ChatHeaderProps) {
  const [ollamaDialogOpen, setOllamaDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          {/* Logo/Title */}
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-primary/20 cursor-pointer",
              isLoading && "animate-pulse"
            )}>
              <img src={ragcoreLogo} alt="RAGCore Logo" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-sm font-semibold text-foreground">RAGCore</h1>
            <ModeIndicator />
          </div>

          {/* Document status badge */}
          {documentLoaded && documentInfo && (
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 bg-green-500/10 text-green-500 rounded-full text-xs">
              <FileText className="w-3 h-3" />
              <span>{documentInfo}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Settings button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSettingsOpen(true)}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Settings"
          >
            <Settings className="w-4 h-4 mr-1.5" />
            <span className="hidden sm:inline">Settings</span>
          </Button>

          {/* Ollama connection button */}
          <Button
            variant={selectedModel ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setOllamaDialogOpen(true)}
            className={cn(
              'text-muted-foreground hover:text-foreground',
              selectedModel && 'text-foreground border-primary/30'
            )}
            aria-label="Connect to Ollama"
          >
            <Server className="w-4 h-4 mr-1.5" />
            {selectedModel ? (
              <>
                <span className="hidden sm:inline max-w-24 truncate">{selectedModel}</span>
                <ChevronDown className="w-3 h-3 ml-1" />
              </>
            ) : (
              <span className="hidden sm:inline">Connect Ollama</span>
            )}
          </Button>
          
          {/* Embedding model indicator */}
          {selectedEmbeddingModel && (
            <div className="hidden lg:flex items-center gap-1.5 px-2 py-1 bg-secondary rounded text-xs text-muted-foreground">
              <Database className="w-3 h-3" />
              <span className="max-w-20 truncate">{selectedEmbeddingModel.split(':')[0]}</span>
            </div>
          )}

          {/* Clear button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Clear conversation"
          >
            <Trash2 className="w-4 h-4 mr-1.5" />
            <span className="hidden sm:inline">Clear</span>
          </Button>

          {/* Sources toggle */}
          <Button
            variant={sourcesOpen ? 'secondary' : 'ghost'}
            size="sm"
            onClick={onToggleSources}
            className={cn(
              'text-muted-foreground hover:text-foreground',
              sourcesOpen && 'text-foreground'
            )}
            aria-label="Toggle sources panel"
          >
            <PanelRight className="w-4 h-4 mr-1.5" />
            <span className="hidden sm:inline">Sources</span>
            {sourceCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-primary/20 text-primary">
                {sourceCount}
              </span>
            )}
          </Button>
        </div>
      </header>

      <OllamaDialog
        open={ollamaDialogOpen}
        onOpenChange={setOllamaDialogOpen}
        onSelectModel={onSelectModel}
        currentModel={selectedModel}
        currentEmbeddingModel={selectedEmbeddingModel}
        currentParams={modelParams}
      />
      
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
