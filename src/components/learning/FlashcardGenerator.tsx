import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Sparkles, RotateCcw, BookOpen, CheckCircle, XCircle } from 'lucide-react';
import { ragService } from '@/lib/rag/ragService';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Flashcard {
  id: string;
  front: string;
  back: string;
  easeFactor: number; // 2.5 is default, gets harder/easier based on performance
  interval: number; // days until next review
  nextReview: Date;
  repetitions: number;
}

interface FlashcardGeneratorProps {
  onBack: () => void;
}

export function FlashcardGenerator({ onBack }: FlashcardGeneratorProps) {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [studyMode, setStudyMode] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [studyStats, setStudyStats] = useState({ easy: 0, good: 0, hard: 0 });

  const generateFlashcards = async () => {
    setIsGenerating(true);

    try {
      const context = await ragService.query('generate flashcards from all documents', 20);
      
      if (context.length === 0) {
        toast.error('No documents found to generate flashcards from');
        setIsGenerating(false);
        return;
      }

      const instructions = `Create 10 flashcards to help memorize key concepts from the provided content.

CRITICAL: You MUST respond with ONLY valid JSON in this EXACT format with no additional text:
{
  "flashcards": [
    {
      "front": "🤔 Question or concept on the front",
      "back": "💡 Answer or explanation on the back"
    }
  ]
}

Rules:
- Make front side clear and concise (question or key term)
- Make back side informative but not too long
- Add relevant emojis to both front and back (🤔, 💡, ✨, 📚, 🎯, ⭐, etc.)
- Focus on important concepts, definitions, and relationships
- Create cards that test understanding, not just memorization
- NO markdown, NO code blocks, NO extra text - ONLY the JSON object`;

      const contextText = context.map(r => r.chunk.content).join('\n\n');

      let fullResponse = '';
      await ragService.generateResponse(
        `${instructions}\n\nCreate flashcards from this content:\n\n${contextText}`,
        context,
        (token) => {
          fullResponse += token;
        },
        () => {
          try {
            let jsonStr = fullResponse.trim();
            
            // Remove markdown code blocks if present
            jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
            
            // Try to find JSON object
            const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              jsonStr = jsonMatch[0];
            }
            
            const parsed = JSON.parse(jsonStr);
            
            if (parsed.flashcards && Array.isArray(parsed.flashcards)) {
              const cards: Flashcard[] = parsed.flashcards.map((card: any, index: number) => ({
                id: `card-${index}`,
                front: card.front,
                back: card.back,
                easeFactor: 2.5,
                interval: 0,
                nextReview: new Date(),
                repetitions: 0,
              }));
              
              setFlashcards(cards);
              toast.success(`Generated ${cards.length} flashcards`);
            } else {
              throw new Error('Invalid flashcard format');
            }
          } catch (error) {
            console.error('Error parsing flashcards:', error);
            console.error('Response was:', fullResponse);
            toast.error('Failed to parse flashcards. Please try again.');
          }
          setIsGenerating(false);
        },
        (error) => {
          console.error('Error generating flashcards:', error);
          toast.error('Failed to generate flashcards');
          setIsGenerating(false);
        }
      );
    } catch (error) {
      console.error('Error generating flashcards:', error);
      toast.error('Failed to generate flashcards');
      setIsGenerating(false);
    }
  };

  // Spaced repetition algorithm (SM-2)
  const updateCardDifficulty = (quality: 'hard' | 'good' | 'easy') => {
    const card = flashcards[currentCardIndex];
    let newEaseFactor = card.easeFactor;
    let newInterval = card.interval;
    let newRepetitions = card.repetitions;

    // Quality: hard=0, good=1, easy=2
    const q = quality === 'hard' ? 0 : quality === 'good' ? 1 : 2;

    if (q >= 1) {
      // Correct response
      if (newRepetitions === 0) {
        newInterval = 1;
      } else if (newRepetitions === 1) {
        newInterval = 6;
      } else {
        newInterval = Math.round(newInterval * newEaseFactor);
      }
      newRepetitions += 1;
    } else {
      // Incorrect response - restart
      newRepetitions = 0;
      newInterval = 1;
    }

    // Update ease factor
    newEaseFactor = Math.max(1.3, newEaseFactor + (0.1 - (2 - q) * (0.08 + (2 - q) * 0.02)));

    // Calculate next review date
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + newInterval);

    // Update the card
    const updatedCards = [...flashcards];
    updatedCards[currentCardIndex] = {
      ...card,
      easeFactor: newEaseFactor,
      interval: newInterval,
      repetitions: newRepetitions,
      nextReview,
    };

    setFlashcards(updatedCards);

    // Update stats
    setStudyStats(prev => ({
      ...prev,
      [quality]: prev[quality] + 1,
    }));

    // Move to next card
    setIsFlipped(false);
    if (currentCardIndex < flashcards.length - 1) {
      setCurrentCardIndex(prev => prev + 1);
    } else {
      // Finished studying
      setStudyMode(false);
      setCurrentCardIndex(0);
      toast.success('Study session complete!');
    }
  };

  const startStudying = () => {
    setStudyMode(true);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setStudyStats({ easy: 0, good: 0, hard: 0 });
  };

  const resetFlashcards = () => {
    setFlashcards([]);
    setStudyMode(false);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setStudyStats({ easy: 0, good: 0, hard: 0 });
  };

  if (!flashcards.length && !isGenerating) {
    return (
      <div className="h-full flex flex-col p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h2 className="text-2xl font-bold">Generate Flashcards</h2>
          <div className="w-20" />
        </div>

        <Card className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <BookOpen className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-2xl font-semibold">Master Your Material</h3>
            <p className="text-muted-foreground max-w-md">
              Generate interactive flashcards with spaced repetition to help you memorize key concepts
            </p>
            <Button onClick={generateFlashcards} size="lg" className="mt-4">
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Flashcards
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (isGenerating) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <Card className="p-8">
          <div className="flex items-center justify-center gap-3">
            <Sparkles className="w-5 h-5 animate-pulse text-primary" />
            <p className="text-lg">Generating flashcards...</p>
          </div>
        </Card>
      </div>
    );
  }

  if (studyMode) {
    const currentCard = flashcards[currentCardIndex];
    const progress = ((currentCardIndex + 1) / flashcards.length) * 100;

    return (
      <div className="h-full flex flex-col p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={() => setStudyMode(false)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="text-center">
            <h2 className="text-2xl font-bold">Study Session</h2>
            <p className="text-sm text-muted-foreground">
              Card {currentCardIndex + 1} of {flashcards.length}
            </p>
          </div>
          <div className="w-20" />
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Flashcard */}
        <div className="flex-1 flex items-center justify-center mb-6">
          <div
            className={cn(
              "relative w-full max-w-2xl h-96 cursor-pointer transition-transform duration-500 preserve-3d",
              isFlipped && "rotate-y-180"
            )}
            onClick={() => setIsFlipped(!isFlipped)}
            style={{ transformStyle: 'preserve-3d' }}
          >
            {/* Front */}
            <Card
              className={cn(
                "absolute inset-0 p-8 flex items-center justify-center text-center backface-hidden",
                "border-2 hover:shadow-lg transition-shadow"
              )}
              style={{ backfaceVisibility: 'hidden' }}
            >
              <div className="space-y-4">
                <BookOpen className="w-8 h-8 text-primary mx-auto" />
                <p className="text-2xl font-semibold">{currentCard.front}</p>
                <p className="text-sm text-muted-foreground">Click to reveal answer</p>
              </div>
            </Card>

            {/* Back */}
            <Card
              className={cn(
                "absolute inset-0 p-8 flex items-center justify-center text-center backface-hidden bg-primary/5",
                "border-2 hover:shadow-lg transition-shadow"
              )}
              style={{ 
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)'
              }}
            >
              <div className="space-y-4">
                <CheckCircle className="w-8 h-8 text-primary mx-auto" />
                <p className="text-xl">{currentCard.back}</p>
              </div>
            </Card>
          </div>
        </div>

        {/* Rating buttons */}
        {isFlipped && (
          <div className="space-y-4">
            <p className="text-center text-sm text-muted-foreground">
              How well did you know this?
            </p>
            <div className="grid grid-cols-3 gap-4">
              <Button
                variant="outline"
                size="lg"
                onClick={() => updateCardDifficulty('hard')}
                className="border-red-500/50 hover:bg-red-500/10"
              >
                <XCircle className="w-5 h-5 mr-2 text-red-600 dark:text-red-400" />
                Hard
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => updateCardDifficulty('good')}
                className="border-yellow-500/50 hover:bg-yellow-500/10"
              >
                <BookOpen className="w-5 h-5 mr-2 text-yellow-600 dark:text-yellow-400" />
                Good
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => updateCardDifficulty('easy')}
                className="border-green-500/50 hover:bg-green-500/10"
              >
                <CheckCircle className="w-5 h-5 mr-2 text-green-600 dark:text-green-400" />
                Easy
              </Button>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="mt-6 flex justify-center gap-6 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500" />
            Easy: {studyStats.easy}
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-yellow-500" />
            Good: {studyStats.good}
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500" />
            Hard: {studyStats.hard}
          </span>
        </div>
      </div>
    );
  }

  // Flashcard overview
  const dueToday = flashcards.filter(card => card.nextReview <= new Date()).length;

  return (
    <div className="h-full flex flex-col p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <h2 className="text-2xl font-bold">Flashcards</h2>
        <Button variant="outline" onClick={resetFlashcards}>
          <RotateCcw className="w-4 h-4 mr-2" />
          New Set
        </Button>
      </div>

      <div className="space-y-6">
        {/* Stats Card */}
        <Card className="p-6">
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <p className="text-3xl font-bold text-primary">{flashcards.length}</p>
              <p className="text-sm text-muted-foreground">Total Cards</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">{dueToday}</p>
              <p className="text-sm text-muted-foreground">Due Today</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {flashcards.filter(c => c.repetitions > 0).length}
              </p>
              <p className="text-sm text-muted-foreground">Mastered</p>
            </div>
          </div>
        </Card>

        {/* Study Button */}
        <Button onClick={startStudying} size="lg" className="w-full">
          <BookOpen className="w-5 h-5 mr-2" />
          Start Study Session
        </Button>

        {/* Flashcard List */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">All Flashcards</h3>
          <div className="space-y-2">
            {flashcards.map((card, index) => (
              <Card key={card.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-medium mb-1">{card.front}</p>
                    <p className="text-sm text-muted-foreground">{card.back}</p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <p>Interval: {card.interval} days</p>
                    <p>Reps: {card.repetitions}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
