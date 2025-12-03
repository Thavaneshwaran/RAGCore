import { useState } from 'react';
import { Source } from '@/types/chat';
import { cn } from '@/lib/utils';
import { ChevronRight, Copy, Check, X, FileText, ChevronDown, ChevronUp, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DocumentPreview, DocumentPreviewData } from './DocumentPreview';

interface SourcesPanelProps {
  sources: Source[];
  isOpen: boolean;
  onClose: () => void;
}

export function SourcesPanel({ sources, isOpen, onClose }: SourcesPanelProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [previewDocument, setPreviewDocument] = useState<DocumentPreviewData | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handlePreview = (source: Source) => {
    // Parse metadata from source content if available
    // Source content format: "[source] (Page X) (Priority: Y | Score: Z%)\ncontent"
    const lines = source.content.split('\n');
    const metadataLine = lines[0];
    const content = lines.slice(1).join('\n');
    
    // Extract metadata
    const sourceMatch = metadataLine.match(/\[(.*?)\]/);
    const pageMatch = metadataLine.match(/\(Page (\d+)\)/);
    const priorityMatch = metadataLine.match(/Priority: (\d+)/);
    
    const sourceName = sourceMatch ? sourceMatch[1] : 'Unknown Source';
    const sourceType: 'pdf' | 'url' = sourceName.startsWith('http') ? 'url' : 'pdf';
    
    setPreviewDocument({
      id: source.id,
      content: content || source.content,
      metadata: {
        source: sourceName,
        sourceType,
        pageNumber: pageMatch ? parseInt(pageMatch[1]) : undefined,
        priority: source.priority,
      },
      weightedScore: source.weightedScore,
    });
    setIsPreviewOpen(true);
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <aside
        className={cn(
          'fixed right-0 top-0 h-full w-80 bg-sources-panel border-l border-border z-50',
          'transform transition-transform duration-300 ease-in-out',
          'lg:relative lg:transform-none lg:transition-none',
          isOpen ? 'translate-x-0' : 'translate-x-full lg:hidden'
        )}
      >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-foreground">Sources</h2>
              {sources.length > 0 && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-primary/20 text-primary">
                  {sources.length}
                </span>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="lg:hidden"
              aria-label="Close sources panel"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Sources list */}
          <div className="overflow-y-auto custom-scrollbar h-[calc(100%-65px)] p-4 space-y-3">
            {sources.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No sources available yet. Ask a question to see relevant sources.
              </p>
            ) : (
              sources.map((source) => {
                const isExpanded = expandedIds.has(source.id);
                const isCopied = copiedId === source.id;
                const displayContent = isExpanded
                  ? source.content
                  : source.content.slice(0, 200) + (source.content.length > 200 ? '...' : '');

                return (
                  <div
                    key={source.id}
                    className="source-card bg-secondary rounded-lg p-3 space-y-2"
                  >
                    {/* Priority indicator */}
                    {source.priority !== undefined && (
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn(
                          "text-xs font-medium px-2 py-0.5 rounded",
                          source.priority >= 4 ? "bg-primary/20 text-primary" :
                          source.priority === 3 ? "bg-secondary text-muted-foreground" :
                          "bg-muted text-muted-foreground"
                        )}>
                          Priority: {source.priority}
                        </span>
                        {source.weightedScore !== undefined && (
                          <span className="text-xs text-muted-foreground">
                            (Score: {(source.weightedScore * 100).toFixed(1)}%)
                          </span>
                        )}
                      </div>
                    )}

                    <p className="text-sm text-foreground leading-relaxed">
                      {displayContent}
                    </p>

                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePreview(source)}
                        className="h-7 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        Preview
                      </Button>

                      {source.content.length > 200 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpanded(source.id)}
                          className="h-7 text-xs text-muted-foreground hover:text-foreground"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="w-3 h-3 mr-1" />
                              Show less
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3 h-3 mr-1" />
                              Expand
                            </>
                          )}
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(source.content, source.id)}
                        className="h-7 text-xs text-muted-foreground hover:text-foreground ml-auto"
                        aria-label="Copy source text"
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3 h-3 mr-1 text-success" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 mr-1" />
                            Copy
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
      </aside>

      <DocumentPreview
        document={previewDocument}
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
      />
    </>
  );
}
