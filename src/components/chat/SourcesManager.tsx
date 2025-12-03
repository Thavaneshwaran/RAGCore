import { useState } from 'react';
import { DocumentSource, SourcePriority } from '@/lib/rag/types';
import { ragService } from '@/lib/rag/ragService';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Globe, Trash2, Star, TrendingUp, Activity, Lightbulb, Eye } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ABTestManager } from './ABTestManager';
import { SourceRecommendations } from './SourceRecommendations';
import { DocumentPreview, DocumentPreviewData } from './DocumentPreview';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

interface SourcesManagerProps {
  onUpdate: () => void;
}

const PRIORITY_LABELS: Record<SourcePriority, { label: string; description: string }> = {
  1: { label: 'Very Low', description: 'Rarely referenced' },
  2: { label: 'Low', description: 'Occasionally referenced' },
  3: { label: 'Normal', description: 'Standard priority' },
  4: { label: 'High', description: 'Frequently referenced' },
  5: { label: 'Very High', description: 'Always prioritized' },
};

export function SourcesManager({ onUpdate }: SourcesManagerProps) {
  const [sources, setSources] = useState<DocumentSource[]>(ragService.getSources());
  const [deleteSourceId, setDeleteSourceId] = useState<string | null>(null);
  const [previewDocument, setPreviewDocument] = useState<DocumentPreviewData | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const handlePriorityChange = (sourceId: string, priority: SourcePriority) => {
    ragService.updateSourcePriority(sourceId, priority);
    setSources(ragService.getSources());
    onUpdate();
    toast.success('Source priority updated');
  };

  const handleDelete = (sourceId: string) => {
    setDeleteSourceId(sourceId);
  };

  const confirmDelete = () => {
    if (deleteSourceId) {
      const source = sources.find(s => s.id === deleteSourceId);
      ragService.removeSource(deleteSourceId);
      setSources(ragService.getSources());
      onUpdate();
      toast.success(`Removed source: ${source?.name}`);
      setDeleteSourceId(null);
    }
  };

  const handlePreview = (source: DocumentSource) => {
    // Get all chunks for this source to show full document preview
    const chunks = ragService.getAllChunks().filter(
      chunk => chunk.metadata.source === source.name
    );
    
    const fullContent = chunks
      .sort((a, b) => a.metadata.chunkIndex - b.metadata.chunkIndex)
      .map(chunk => chunk.content)
      .join('\n\n');
    
    setPreviewDocument({
      id: source.id,
      content: fullContent || `No content available for ${source.name}`,
      metadata: {
        source: source.name,
        sourceType: source.type,
        priority: source.priority,
        totalChunks: chunks.length,
      },
    });
    setIsPreviewOpen(true);
  };

  if (sources.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No documents loaded yet</p>
        <p className="text-sm mt-1">Upload PDFs or load URLs to get started</p>
      </div>
    );
  }

  return (
    <>
      <Tabs defaultValue="sources" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="sources">
            <Activity className="w-4 h-4 mr-2" />
            Sources
          </TabsTrigger>
          <TabsTrigger value="recommendations">
            <Lightbulb className="w-4 h-4 mr-2" />
            Optimize
          </TabsTrigger>
          <TabsTrigger value="abtest">
            <TrendingUp className="w-4 h-4 mr-2" />
            A/B Test
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sources" className="space-y-4 mt-4">
          {sources.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No documents loaded yet</p>
              <p className="text-sm mt-1">Upload PDFs or load URLs to get started</p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {sources.map((source) => (
            <div
              key={source.id}
              className="bg-secondary/50 rounded-lg p-4 space-y-3"
            >
              {/* Source info */}
              <div className="flex items-start gap-3">
                <div className="mt-1">
                  {source.type === 'pdf' ? (
                    <FileText className="w-5 h-5 text-primary" />
                  ) : (
                    <Globe className="w-5 h-5 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-foreground truncate">
                      {source.name}
                    </h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePreview(source)}
                      className="h-7 text-xs shrink-0"
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      Preview
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {source.chunks} chunks • Added {new Date(source.addedAt).toLocaleDateString()}
                  </p>
                  
                  {/* Usage statistics */}
                  {source.usageStats && (source.usageStats.timesUsed > 0 || source.usageStats.positiveRatings + source.usageStats.negativeRatings > 0) && (
                    <div className="mt-1 space-y-1">
                      <div className="flex flex-wrap gap-2 text-xs">
                        {source.usageStats.timesUsed > 0 && (
                          <span className="text-muted-foreground">
                            Used {source.usageStats.timesUsed}x
                          </span>
                        )}
                        {(source.usageStats.positiveRatings + source.usageStats.negativeRatings) > 0 && (
                          <>
                            <span className="text-success">
                              👍 {source.usageStats.positiveRatings}
                            </span>
                            <span className="text-destructive">
                              👎 {source.usageStats.negativeRatings}
                            </span>
                            <span className="text-primary font-medium">
                              Score: {(source.usageStats.learningScore * 100).toFixed(0)}%
                            </span>
                          </>
                        )}
                      </div>
                      {/* Confidence interval */}
                      {source.usageStats.confidenceInterval && (
                        <div className="text-xs text-muted-foreground">
                          95% CI: [{(source.usageStats.confidenceInterval[0] * 100).toFixed(0)}%, {(source.usageStats.confidenceInterval[1] * 100).toFixed(0)}%]
                          {' • '}
                          Confidence: {((1 - (source.usageStats.confidenceInterval[1] - source.usageStats.confidenceInterval[0])) * 100).toFixed(0)}%
                        </div>
                      )}
                      {/* Time decay indicator */}
                      {source.usageStats.feedbackHistory.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          {source.usageStats.feedbackHistory.length} feedback events
                          {source.usageStats.lastUsed && (
                            <> • Last used {new Date(source.usageStats.lastUsed).toLocaleDateString()}</>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(source.id)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Delete source"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              {/* Priority selector */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">
                    Priority: {PRIORITY_LABELS[source.priority].label}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground ml-6">
                  {PRIORITY_LABELS[source.priority].description}
                </p>
                <div className="flex gap-2 ml-6">
                  {([1, 2, 3, 4, 5] as SourcePriority[]).map((priority) => (
                    <Button
                      key={priority}
                      variant={source.priority === priority ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handlePriorityChange(source.id, priority)}
                      className="h-8 px-3 text-xs"
                    >
                      {priority}
                    </Button>
                  ))}
                </div>
              </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="bg-secondary/30 rounded-lg p-3 border border-border">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total sources:</span>
              <Badge variant="secondary">{sources.length}</Badge>
            </div>
            <div className="flex items-center justify-between text-sm mt-2">
              <span className="text-muted-foreground">Total chunks:</span>
              <Badge variant="secondary">{ragService.getChunkCount()}</Badge>
            </div>
          </div>
    </>
      )}
    </TabsContent>

    <TabsContent value="recommendations" className="mt-4">
      <SourceRecommendations onUpdate={onUpdate} />
    </TabsContent>

    <TabsContent value="abtest" className="mt-4">
      <ABTestManager onUpdate={onUpdate} />
    </TabsContent>
  </Tabs>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteSourceId !== null} onOpenChange={() => setDeleteSourceId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove source?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all chunks from this source from the knowledge base.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DocumentPreview
        document={previewDocument}
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
      />
    </>
  );
}
