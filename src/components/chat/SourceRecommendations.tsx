import { useState, useEffect } from 'react';
import { SourceRecommendation } from '@/lib/rag/types';
import { ragService } from '@/lib/rag/ragService';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { 
  Lightbulb, 
  TrendingUp, 
  TrendingDown, 
  Trash2, 
  Check,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Info
} from 'lucide-react';
import { toast } from 'sonner';
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
import { cn } from '@/lib/utils';

interface SourceRecommendationsProps {
  onUpdate: () => void;
}

export function SourceRecommendations({ onUpdate }: SourceRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<SourceRecommendation[]>([]);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [confirmAction, setConfirmAction] = useState<SourceRecommendation | null>(null);

  useEffect(() => {
    loadRecommendations();
  }, []);

  const loadRecommendations = () => {
    const recs = ragService.generateRecommendations();
    setRecommendations(recs);
    setAppliedIds(new Set());
  };

  const handleApply = (recommendation: SourceRecommendation) => {
    // Show confirmation for high-impact actions
    if (recommendation.type === 'remove' || (recommendation.impact === 'high' && recommendation.type === 'decrease_priority')) {
      setConfirmAction(recommendation);
    } else {
      applyRecommendation(recommendation);
    }
  };

  const applyRecommendation = (recommendation: SourceRecommendation) => {
    const success = ragService.applyRecommendation(recommendation);
    if (success) {
      setAppliedIds(prev => new Set(prev).add(recommendation.sourceId));
      onUpdate();
      
      const actionText = recommendation.type === 'remove' 
        ? 'Source removed'
        : `Priority updated to ${recommendation.suggestedPriority}`;
      toast.success(actionText);
      
      // Reload recommendations after a short delay
      setTimeout(loadRecommendations, 500);
    } else {
      toast.error('Failed to apply recommendation');
    }
    setConfirmAction(null);
  };

  const getIcon = (type: SourceRecommendation['type']) => {
    switch (type) {
      case 'increase_priority':
        return <TrendingUp className="w-5 h-5 text-success" />;
      case 'decrease_priority':
        return <TrendingDown className="w-5 h-5 text-warning" />;
      case 'remove':
        return <Trash2 className="w-5 h-5 text-destructive" />;
      case 'keep_current':
        return <Check className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getActionText = (recommendation: SourceRecommendation) => {
    switch (recommendation.type) {
      case 'increase_priority':
        return `Increase to ${recommendation.suggestedPriority}`;
      case 'decrease_priority':
        return `Decrease to ${recommendation.suggestedPriority}`;
      case 'remove':
        return 'Remove Source';
      case 'keep_current':
        return 'Keep Current';
    }
  };

  const getConfidenceBadge = (confidence: string) => {
    const variants = {
      high: 'default',
      medium: 'secondary',
      low: 'outline',
    } as const;
    
    const icons = {
      high: CheckCircle2,
      medium: AlertCircle,
      low: Info,
    };
    
    const Icon = icons[confidence as keyof typeof icons];
    
    return (
      <Badge variant={variants[confidence as keyof typeof variants]} className="text-xs">
        <Icon className="w-3 h-3 mr-1" />
        {confidence} confidence
      </Badge>
    );
  };

  const getImpactBadge = (impact: string) => {
    const colors = {
      high: 'text-primary',
      medium: 'text-warning',
      low: 'text-muted-foreground',
    };
    
    return (
      <span className={cn('text-xs font-medium', colors[impact as keyof typeof colors])}>
        {impact} impact
      </span>
    );
  };

  // Filter out already applied recommendations and "keep_current" type
  const activeRecommendations = recommendations.filter(
    rec => !appliedIds.has(rec.sourceId) && rec.type !== 'keep_current'
  );

  if (recommendations.length === 0) {
    return (
      <div className="text-center py-8">
        <Lightbulb className="w-12 h-12 mx-auto mb-3 opacity-50 text-muted-foreground" />
        <p className="text-muted-foreground mb-1">No recommendations yet</p>
        <p className="text-sm text-muted-foreground">
          Use sources and provide feedback to receive intelligent optimization suggestions
        </p>
      </div>
    );
  }

  if (activeRecommendations.length === 0 && appliedIds.size > 0) {
    return (
      <div className="text-center py-8">
        <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-success" />
        <p className="text-foreground mb-1">All recommendations applied!</p>
        <p className="text-sm text-muted-foreground mb-4">
          Your sources are well optimized based on current performance data
        </p>
        <Button onClick={loadRecommendations} variant="outline" size="sm">
          <Lightbulb className="w-4 h-4 mr-2" />
          Refresh Recommendations
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {activeRecommendations.length > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-primary" />
              <span className="font-semibold text-foreground">
                {activeRecommendations.length} Recommendation{activeRecommendations.length !== 1 ? 's' : ''}
              </span>
            </div>
            <Button onClick={loadRecommendations} variant="ghost" size="sm">
              Refresh
            </Button>
          </div>
        )}

        <div className="space-y-3">
          {activeRecommendations.map((rec) => (
            <Card key={rec.sourceId} className="p-4 space-y-3">
              {/* Header */}
              <div className="flex items-start gap-3">
                <div className="mt-0.5">{getIcon(rec.type)}</div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-foreground truncate">
                    {rec.sourceName}
                  </h4>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {getConfidenceBadge(rec.confidence)}
                    <span className="text-muted-foreground">•</span>
                    {getImpactBadge(rec.impact)}
                  </div>
                </div>
              </div>

              {/* Reason */}
              <p className="text-sm text-muted-foreground leading-relaxed">
                {rec.reason}
              </p>

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-2 text-xs bg-secondary/30 rounded p-2">
                <div>
                  <span className="text-muted-foreground">Score:</span>
                  <span className="ml-1 font-medium text-foreground">
                    {(rec.metrics.learningScore * 100).toFixed(0)}%
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Ratings:</span>
                  <span className="ml-1 font-medium text-foreground">
                    {rec.metrics.totalRatings}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Positive:</span>
                  <span className="ml-1 font-medium text-success">
                    {(rec.metrics.positiveRate * 100).toFixed(0)}%
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Used:</span>
                  <span className="ml-1 font-medium text-foreground">
                    {rec.metrics.timesUsed}x
                  </span>
                </div>
              </div>

              {/* Action */}
              <div className="flex gap-2">
                <Button
                  onClick={() => handleApply(rec)}
                  variant={rec.type === 'remove' ? 'destructive' : 'default'}
                  size="sm"
                  className="flex-1"
                >
                  {getActionText(rec)}
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {appliedIds.size > 0 && (
          <div className="text-center text-sm text-muted-foreground">
            {appliedIds.size} recommendation{appliedIds.size !== 1 ? 's' : ''} applied
          </div>
        )}
      </div>

      {/* Confirmation dialog */}
      <AlertDialog open={confirmAction !== null} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === 'remove' ? 'Remove Source?' : 'Apply Recommendation?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === 'remove' ? (
                <>
                  This will permanently remove <strong>{confirmAction.sourceName}</strong> and all its chunks 
                  from the knowledge base. This action cannot be undone.
                </>
              ) : (
                <>
                  Change priority of <strong>{confirmAction?.sourceName}</strong> from{' '}
                  {confirmAction?.currentPriority} to {confirmAction?.suggestedPriority}.
                  <br /><br />
                  Reason: {confirmAction?.reason}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => confirmAction && applyRecommendation(confirmAction)}
              className={confirmAction?.type === 'remove' ? 'bg-destructive hover:bg-destructive/90' : ''}
            >
              {confirmAction?.type === 'remove' ? 'Remove' : 'Apply'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
