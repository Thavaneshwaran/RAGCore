import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Network, Sparkles, ArrowLeft, ClipboardList, BookOpen } from 'lucide-react';
import { NotesGenerator } from './NotesGenerator';
import { MindmapGenerator } from './MindmapGenerator';
import { QuizGenerator } from './QuizGenerator';
import { FlashcardGenerator } from './FlashcardGenerator';
import { getChunkCount } from '@/api';

type LearningView = 'menu' | 'notes' | 'mindmap' | 'quiz' | 'flashcards';

interface LearningModeProps {
  onBack?: () => void;
}

export function LearningMode({ onBack }: LearningModeProps) {
  const [view, setView] = useState<LearningView>('menu');
  const hasDocuments = getChunkCount() > 0;

  if (view === 'notes') {
    return <NotesGenerator onBack={() => setView('menu')} />;
  }

  if (view === 'mindmap') {
    return <MindmapGenerator onBack={() => setView('menu')} />;
  }

  if (view === 'quiz') {
    return <QuizGenerator onBack={() => setView('menu')} />;
  }

  if (view === 'flashcards') {
    return <FlashcardGenerator onBack={() => setView('menu')} />;
  }

  return (
    <div className="flex flex-col h-full">
      {onBack && (
        <div className="p-4 border-b border-border">
          <Button variant="ghost" onClick={onBack} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Chat
          </Button>
        </div>
      )}
      <div className="flex items-center justify-center flex-1 p-8">
        <div className="max-w-4xl w-full space-y-8">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-4xl font-bold">Learning Mode</h1>
            <p className="text-muted-foreground text-lg">
              Transform your documents into structured knowledge
            </p>
          </div>

          {!hasDocuments && (
            <Card className="p-6 bg-muted/50 border-dashed">
              <p className="text-center text-muted-foreground">
                Upload documents first to use learning features
              </p>
            </Card>
          )}

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card 
              className={`p-8 hover:shadow-lg transition-all cursor-pointer ${
                !hasDocuments ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary'
              }`}
              onClick={() => hasDocuments && setView('notes')}
            >
              <div className="space-y-4">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Generate Notes</h3>
                <p className="text-muted-foreground text-sm">
                  Extract key points and structured notes from your documents
                </p>
                <Button 
                  className="w-full" 
                  disabled={!hasDocuments}
                  onClick={(e) => {
                    e.stopPropagation();
                    setView('notes');
                  }}
                >
                  Start
                </Button>
              </div>
            </Card>

            <Card 
              className={`p-8 hover:shadow-lg transition-all cursor-pointer ${
                !hasDocuments ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary'
              }`}
              onClick={() => hasDocuments && setView('mindmap')}
            >
              <div className="space-y-4">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10">
                  <Network className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Generate Mindmap</h3>
                <p className="text-muted-foreground text-sm">
                  Visualize concepts and relationships in an interactive mindmap
                </p>
                <Button 
                  className="w-full" 
                  disabled={!hasDocuments}
                  onClick={(e) => {
                    e.stopPropagation();
                    setView('mindmap');
                  }}
                >
                  Create
                </Button>
              </div>
            </Card>

            <Card 
              className={`p-8 hover:shadow-lg transition-all cursor-pointer ${
                !hasDocuments ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary'
              }`}
              onClick={() => hasDocuments && setView('quiz')}
            >
              <div className="space-y-4">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10">
                  <ClipboardList className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Take Quiz</h3>
                <p className="text-muted-foreground text-sm">
                  Test your understanding with auto-generated questions
                </p>
                <Button 
                  className="w-full" 
                  disabled={!hasDocuments}
                  onClick={(e) => {
                    e.stopPropagation();
                    setView('quiz');
                  }}
                >
                  Start Quiz
                </Button>
              </div>
            </Card>

            <Card 
              className={`p-8 hover:shadow-lg transition-all cursor-pointer ${
                !hasDocuments ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary'
              }`}
              onClick={() => hasDocuments && setView('flashcards')}
            >
              <div className="space-y-4">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10">
                  <BookOpen className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Flashcards</h3>
                <p className="text-muted-foreground text-sm">
                  Study with spaced repetition flashcards
                </p>
                <Button 
                  className="w-full" 
                  disabled={!hasDocuments}
                  onClick={(e) => {
                    e.stopPropagation();
                    setView('flashcards');
                  }}
                >
                  Study
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
