import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Globe, Copy, Check, X, Star } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export interface DocumentPreviewData {
  id: string;
  content: string;
  metadata: {
    source: string;
    sourceType: 'pdf' | 'url' | 'text' | 'office' | 'image';
    pageNumber?: number;
    priority?: number;
    chunkIndex?: number;
    totalChunks?: number;
  };
  weightedScore?: number;
}

interface DocumentPreviewProps {
  document: DocumentPreviewData | null;
  isOpen: boolean;
  onClose: () => void;
}

export function DocumentPreview({ document, isOpen, onClose }: DocumentPreviewProps) {
  const [copied, setCopied] = useState(false);

  if (!document) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(document.content);
      setCopied(true);
      toast.success('Content copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy content');
    }
  };

  const isPDF = document.metadata.sourceType === 'pdf';
  const isText = document.metadata.sourceType === 'text';
  const isOffice = document.metadata.sourceType === 'office';
  const isImage = document.metadata.sourceType === 'image';
  const sourceFileName = document.metadata.source.split('/').pop() || document.metadata.source;
  
  const getDocumentTypeLabel = () => {
    switch (document.metadata.sourceType) {
      case 'pdf': return 'PDF Document';
      case 'url': return 'Web Page';
      case 'text': return 'Text File';
      case 'office': return 'Office Document';
      case 'image': return 'Image';
      default: return 'Document';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 border-b border-border">
          <div className="flex items-start gap-3">
            <div className="mt-1">
              {isPDF ? (
                <FileText className="w-6 h-6 text-primary" />
              ) : (
                <Globe className="w-6 h-6 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg truncate">
                {sourceFileName}
              </DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-2 mt-2">
                <Badge variant="secondary" className="text-xs">
                  {getDocumentTypeLabel()}
                </Badge>
                {document.metadata.pageNumber && (
                  <Badge variant="outline" className="text-xs">
                    Page {document.metadata.pageNumber}
                  </Badge>
                )}
                {document.metadata.priority !== undefined && (
                  <Badge 
                    variant="outline" 
                    className="text-xs flex items-center gap-1"
                  >
                    <Star className="w-3 h-3" />
                    Priority {document.metadata.priority}
                  </Badge>
                )}
                {document.weightedScore !== undefined && (
                  <Badge variant="outline" className="text-xs">
                    Relevance: {(document.weightedScore * 100).toFixed(1)}%
                  </Badge>
                )}
                {document.metadata.chunkIndex !== undefined && document.metadata.totalChunks && (
                  <Badge variant="outline" className="text-xs">
                    Chunk {document.metadata.chunkIndex + 1} of {document.metadata.totalChunks}
                  </Badge>
                )}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-9"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-2 text-success" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-9 w-9"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>
        
        <ScrollArea className="flex-1 px-6 py-4">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <div className="whitespace-pre-wrap text-foreground leading-relaxed">
              {document.content}
            </div>
          </div>
        </ScrollArea>

        <div className="px-6 py-4 border-t border-border bg-secondary/30">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {document.content.length.toLocaleString()} characters
            </span>
            <span>
              {document.content.split(/\s+/).length.toLocaleString()} words
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
