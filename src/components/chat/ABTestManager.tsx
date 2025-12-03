import { useState } from 'react';
import { ABTest, SourceConfiguration, SourcePriority } from '@/lib/rag/types';
import { ragService } from '@/lib/rag/ragService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { 
  FlaskConical, 
  Play, 
  Square, 
  Trophy, 
  TrendingUp, 
  TrendingDown,
  Minus,
  RefreshCw,
  CheckCircle2,
  XCircle
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

interface ABTestManagerProps {
  onUpdate: () => void;
}

export function ABTestManager({ onUpdate }: ABTestManagerProps) {
  const [activeTest, setActiveTest] = useState<ABTest | null>(ragService.getActiveABTest());
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [testName, setTestName] = useState('');
  const [testDescription, setTestDescription] = useState('');
  const [experimentalPriorities, setExperimentalPriorities] = useState<Map<string, SourcePriority>>(new Map());
  const [showEndDialog, setShowEndDialog] = useState(false);

  const handleStartTest = () => {
    if (!testName.trim()) {
      toast.error('Please enter a test name');
      return;
    }

    const sources = ragService.getSources();
    if (sources.length === 0) {
      toast.error('No sources available to test');
      return;
    }

    // Use current priorities if no experimental priorities set
    const configB: SourceConfiguration = {
      name: testName,
      sourcePriorities: experimentalPriorities.size > 0 
        ? experimentalPriorities 
        : new Map(sources.map(s => [s.id, s.priority])),
    };

    const test = ragService.startABTest(testName, testDescription, configB);
    setActiveTest(test);
    setShowCreateForm(false);
    setTestName('');
    setTestDescription('');
    setExperimentalPriorities(new Map());
    onUpdate();
    toast.success('A/B test started');
  };

  const handleEndTest = () => {
    const result = ragService.endABTest();
    if (result) {
      setActiveTest(result);
      setShowEndDialog(false);
      onUpdate();
      toast.success('A/B test ended');
    }
  };

  const handleApplyWinner = () => {
    const success = ragService.applyWinningConfig();
    if (success) {
      setActiveTest(null);
      onUpdate();
      toast.success('Winning configuration applied');
    } else {
      toast.error('No clear winner to apply');
    }
  };

  const handleSwitchConfig = () => {
    ragService.switchABTestConfig();
    setActiveTest(ragService.getActiveABTest());
    onUpdate();
    toast.success('Switched test configuration');
  };

  const handleClearTest = () => {
    ragService.clearABTest();
    setActiveTest(null);
    onUpdate();
    toast.success('Test cleared');
  };

  const setPriority = (sourceId: string, priority: SourcePriority) => {
    const newMap = new Map(experimentalPriorities);
    newMap.set(sourceId, priority);
    setExperimentalPriorities(newMap);
  };

  if (activeTest) {
    const isEnded = !!activeTest.endedAt;
    const statsA = activeTest.results.configAStats;
    const statsB = activeTest.results.configBStats;
    const rateA = statsA.questionsAnswered > 0 ? (statsA.positiveRatings / statsA.questionsAnswered) * 100 : 0;
    const rateB = statsB.questionsAnswered > 0 ? (statsB.positiveRatings / statsB.questionsAnswered) * 100 : 0;

    return (
      <>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-foreground">Active A/B Test</h3>
              {!isEnded && (
                <Badge variant="default" className="bg-primary">
                  <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                  Running
                </Badge>
              )}
              {isEnded && activeTest.results.winner && (
                <Badge variant={activeTest.results.winner === 'inconclusive' ? 'secondary' : 'default'}>
                  {activeTest.results.winner === 'inconclusive' ? (
                    <Minus className="w-3 h-3 mr-1" />
                  ) : (
                    <Trophy className="w-3 h-3 mr-1" />
                  )}
                  {activeTest.results.winner === 'inconclusive' ? 'Inconclusive' : `Winner: ${activeTest.results.winner}`}
                </Badge>
              )}
            </div>
            <Badge variant="outline">
              Config {activeTest.activeConfig}
            </Badge>
          </div>

          <div>
            <h4 className="font-medium text-foreground">{activeTest.name}</h4>
            {activeTest.description && (
              <p className="text-sm text-muted-foreground mt-1">{activeTest.description}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Started {new Date(activeTest.startedAt).toLocaleString()}
              {isEnded && ` • Ended ${new Date(activeTest.endedAt!).toLocaleString()}`}
            </p>
          </div>

          {/* Results comparison */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-3 bg-secondary/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">Config A (Control)</span>
                {isEnded && activeTest.results.winner === 'A' && (
                  <Trophy className="w-4 h-4 text-primary" />
                )}
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Questions:</span>
                  <span className="font-medium text-foreground">{statsA.questionsAnswered}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Success Rate:</span>
                  <span className={`font-medium ${rateA >= 50 ? 'text-success' : 'text-destructive'}`}>
                    {rateA.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Confidence:</span>
                  <span className="font-medium text-foreground">
                    {(statsA.avgConfidence * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </Card>

            <Card className="p-3 bg-secondary/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">Config B (Test)</span>
                {isEnded && activeTest.results.winner === 'B' && (
                  <Trophy className="w-4 h-4 text-primary" />
                )}
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Questions:</span>
                  <span className="font-medium text-foreground">{statsB.questionsAnswered}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Success Rate:</span>
                  <span className={`font-medium ${rateB >= 50 ? 'text-success' : 'text-destructive'}`}>
                    {rateB.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Confidence:</span>
                  <span className="font-medium text-foreground">
                    {(statsB.avgConfidence * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </Card>
          </div>

          {/* Comparison indicator */}
          {statsA.questionsAnswered > 0 && statsB.questionsAnswered > 0 && (
            <div className="flex items-center justify-center gap-2 text-sm">
              {rateB > rateA ? (
                <>
                  <TrendingUp className="w-4 h-4 text-success" />
                  <span className="text-success font-medium">
                    Config B performing {(rateB - rateA).toFixed(1)}% better
                  </span>
                </>
              ) : rateA > rateB ? (
                <>
                  <TrendingDown className="w-4 h-4 text-destructive" />
                  <span className="text-destructive font-medium">
                    Config B performing {(rateA - rateB).toFixed(1)}% worse
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">Configs performing equally</span>
              )}
            </div>
          )}

          {/* Statistical significance */}
          {isEnded && activeTest.results.pValue !== undefined && (
            <div className="text-xs text-center text-muted-foreground">
              {activeTest.results.pValue < 0.05 ? (
                <span className="flex items-center justify-center gap-1 text-success">
                  <CheckCircle2 className="w-3 h-3" />
                  Statistically significant (p = {activeTest.results.pValue.toFixed(3)})
                </span>
              ) : (
                <span className="flex items-center justify-center gap-1 text-muted-foreground">
                  <XCircle className="w-3 h-3" />
                  Not statistically significant (p = {activeTest.results.pValue.toFixed(3)})
                </span>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            {!isEnded ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSwitchConfig}
                  className="flex-1"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Switch Config
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowEndDialog(true)}
                  className="flex-1"
                >
                  <Square className="w-4 h-4 mr-2" />
                  End Test
                </Button>
              </>
            ) : (
              <>
                {activeTest.results.winner && activeTest.results.winner !== 'inconclusive' && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleApplyWinner}
                    className="flex-1"
                  >
                    <Trophy className="w-4 h-4 mr-2" />
                    Apply Winner
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearTest}
                  className="flex-1"
                >
                  Clear Test
                </Button>
              </>
            )}
          </div>
        </div>

        {/* End test confirmation dialog */}
        <AlertDialog open={showEndDialog} onOpenChange={setShowEndDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>End A/B test?</AlertDialogTitle>
              <AlertDialogDescription>
                This will analyze the results and determine if there's a clear winner.
                You can then choose to apply the winning configuration.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleEndTest}>End Test</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  if (showCreateForm) {
    const sources = ragService.getSources();

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Create A/B Test</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowCreateForm(false)}
          >
            Cancel
          </Button>
        </div>

        <div className="space-y-3">
          <div>
            <Label htmlFor="test-name">Test Name</Label>
            <Input
              id="test-name"
              value={testName}
              onChange={(e) => setTestName(e.target.value)}
              placeholder="e.g., Higher priority for official docs"
            />
          </div>

          <div>
            <Label htmlFor="test-description">Description (optional)</Label>
            <Textarea
              id="test-description"
              value={testDescription}
              onChange={(e) => setTestDescription(e.target.value)}
              placeholder="What are you testing?"
              rows={2}
            />
          </div>

          <div>
            <Label>Experimental Priorities (Config B)</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Set different priorities to test. Leave unchanged to use current priorities.
            </p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {sources.map((source) => (
                <div key={source.id} className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-sm text-foreground truncate flex-1">{source.name}</span>
                  <div className="flex gap-1">
                    {([1, 2, 3, 4, 5] as SourcePriority[]).map((p) => (
                      <Button
                        key={p}
                        variant={
                          (experimentalPriorities.get(source.id) || source.priority) === p 
                            ? 'default' 
                            : 'outline'
                        }
                        size="sm"
                        onClick={() => setPriority(source.id, p)}
                        className="h-7 w-7 p-0 text-xs"
                      >
                        {p}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Button
          onClick={handleStartTest}
          className="w-full"
          disabled={!testName.trim()}
        >
          <Play className="w-4 h-4 mr-2" />
          Start Test
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center py-8">
        <FlaskConical className="w-12 h-12 mx-auto mb-3 opacity-50 text-muted-foreground" />
        <p className="text-muted-foreground mb-1">No active A/B test</p>
        <p className="text-sm text-muted-foreground mb-4">
          Test different source priority configurations to optimize answer quality
        </p>
        <Button onClick={() => setShowCreateForm(true)}>
          <Play className="w-4 h-4 mr-2" />
          Create A/B Test
        </Button>
      </div>
    </div>
  );
}
