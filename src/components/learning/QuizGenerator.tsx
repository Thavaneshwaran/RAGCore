import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Sparkles, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';
import { ragService } from '@/lib/rag/ragService';
import { toast } from 'sonner';

interface Question {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
}

interface QuizGeneratorProps {
  onBack: () => void;
}

export function QuizGenerator({ onBack }: QuizGeneratorProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [showResults, setShowResults] = useState(false);
  const [quizStarted, setQuizStarted] = useState(false);

  const generateQuiz = async () => {
    setIsGenerating(true);

    try {
      // Get context from all documents
      const context = await ragService.query('generate quiz questions from all documents', 20);
      
      if (context.length === 0) {
        toast.error('No documents found to generate quiz from');
        setIsGenerating(false);
        return;
      }

      const instructions = `Create 5 multiple-choice questions to test understanding of the provided content.

CRITICAL: You MUST respond with ONLY valid JSON in this EXACT format with no additional text:
{
  "questions": [
    {
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Brief explanation of why this is correct"
    }
  ]
}

Rules:
- correctAnswer must be the index (0-3) of the correct option
- Include exactly 4 options per question
- Make questions clear and unambiguous
- Provide helpful explanations with relevant emojis (💡, ✅, 📌)
- Use emojis in questions to make them engaging (🤔, 📚, ⚡, etc.)
- NO markdown, NO code blocks, NO extra text - ONLY the JSON object`;

      const contextText = context.map(r => r.chunk.content).join('\n\n');

      let fullResponse = '';
      await ragService.generateResponse(
        `${instructions}\n\nCreate quiz questions from this content:\n\n${contextText}`,
        context,
        (token) => {
          fullResponse += token;
        },
        () => {
          try {
            // Extract JSON from response
            let jsonStr = fullResponse.trim();
            
            // Remove markdown code blocks if present
            jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
            
            // Try to find JSON object
            const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              jsonStr = jsonMatch[0];
            }
            
            const parsed = JSON.parse(jsonStr);
            
            if (parsed.questions && Array.isArray(parsed.questions)) {
              setQuestions(parsed.questions);
              setQuizStarted(true);
              toast.success(`Generated ${parsed.questions.length} questions`);
            } else {
              throw new Error('Invalid quiz format');
            }
          } catch (error) {
            console.error('Error parsing quiz:', error);
            console.error('Response was:', fullResponse);
            toast.error('Failed to parse quiz questions. Please try again.');
          }
          setIsGenerating(false);
        },
        (error) => {
          console.error('Error generating quiz:', error);
          toast.error('Failed to generate quiz');
          setIsGenerating(false);
        }
      );
    } catch (error) {
      console.error('Error generating quiz:', error);
      toast.error('Failed to generate quiz');
      setIsGenerating(false);
    }
  };

  const handleAnswerSelect = (questionIndex: number, answerIndex: number) => {
    setSelectedAnswers(prev => ({ ...prev, [questionIndex]: answerIndex }));
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const handleSubmit = () => {
    if (Object.keys(selectedAnswers).length < questions.length) {
      toast.error('Please answer all questions before submitting');
      return;
    }
    setShowResults(true);
  };

  const calculateScore = () => {
    let correct = 0;
    questions.forEach((q, index) => {
      if (selectedAnswers[index] === q.correctAnswer) {
        correct++;
      }
    });
    return correct;
  };

  const resetQuiz = () => {
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setSelectedAnswers({});
    setShowResults(false);
    setQuizStarted(false);
  };

  if (!quizStarted && !isGenerating) {
    return (
      <div className="h-full flex flex-col p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h2 className="text-2xl font-bold">Generate Quiz</h2>
          <div className="w-20" />
        </div>

        <Card className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-2xl font-semibold">Test Your Knowledge</h3>
            <p className="text-muted-foreground max-w-md">
              Generate multiple-choice questions from your documents to test your understanding
            </p>
            <Button onClick={generateQuiz} size="lg" className="mt-4">
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Quiz
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
            <p className="text-lg">Generating quiz questions...</p>
          </div>
        </Card>
      </div>
    );
  }

  if (showResults) {
    const score = calculateScore();
    const percentage = Math.round((score / questions.length) * 100);

    return (
      <div className="h-full flex flex-col p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h2 className="text-2xl font-bold">Quiz Results</h2>
          <Button variant="outline" onClick={resetQuiz}>
            <RotateCcw className="w-4 h-4 mr-2" />
            New Quiz
          </Button>
        </div>

        <Card className="p-8 space-y-6">
          <div className="text-center space-y-4">
            <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full ${
              percentage >= 70 ? 'bg-green-500/10' : 'bg-yellow-500/10'
            }`}>
              <span className={`text-3xl font-bold ${
                percentage >= 70 ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'
              }`}>
                {percentage}%
              </span>
            </div>
            <h3 className="text-2xl font-bold">
              You scored {score} out of {questions.length}
            </h3>
            <p className="text-muted-foreground">
              {percentage >= 90 ? 'Excellent work!' : 
               percentage >= 70 ? 'Good job!' : 
               percentage >= 50 ? 'Not bad, keep studying!' : 
               'Keep practicing!'}
            </p>
          </div>

          <div className="space-y-6 mt-8">
            <h4 className="text-lg font-semibold">Review Answers</h4>
            {questions.map((question, qIndex) => {
              const userAnswer = selectedAnswers[qIndex];
              const isCorrect = userAnswer === question.correctAnswer;

              return (
                <Card key={qIndex} className={`p-6 border-2 ${
                  isCorrect ? 'border-green-500/20 bg-green-500/5' : 'border-red-500/20 bg-red-500/5'
                }`}>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      {isCorrect ? (
                        <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <p className="font-semibold mb-3">
                          {qIndex + 1}. {question.question}
                        </p>
                        <div className="space-y-2">
                          {question.options.map((option, oIndex) => (
                            <div
                              key={oIndex}
                              className={`p-3 rounded-lg ${
                                oIndex === question.correctAnswer
                                  ? 'bg-green-500/10 border border-green-500/30'
                                  : oIndex === userAnswer && !isCorrect
                                  ? 'bg-red-500/10 border border-red-500/30'
                                  : 'bg-muted/30'
                              }`}
                            >
                              <p className="text-sm">
                                {option}
                                {oIndex === question.correctAnswer && (
                                  <span className="ml-2 text-green-600 dark:text-green-400 font-medium">
                                    ✓ Correct
                                  </span>
                                )}
                                {oIndex === userAnswer && !isCorrect && (
                                  <span className="ml-2 text-red-600 dark:text-red-400 font-medium">
                                    ✗ Your answer
                                  </span>
                                )}
                              </p>
                            </div>
                          ))}
                        </div>
                        {question.explanation && (
                          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                            <p className="text-sm text-muted-foreground">
                              <strong>Explanation:</strong> {question.explanation}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </Card>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
  const allAnswered = Object.keys(selectedAnswers).length === questions.length;

  return (
    <div className="h-full flex flex-col p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div className="text-center">
          <h2 className="text-2xl font-bold">Quiz</h2>
          <p className="text-sm text-muted-foreground">
            Question {currentQuestionIndex + 1} of {questions.length}
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

      <Card className="flex-1 p-8">
        <div className="space-y-6">
          <h3 className="text-xl font-semibold">
            {currentQuestion.question}
          </h3>

          <RadioGroup
            value={selectedAnswers[currentQuestionIndex]?.toString()}
            onValueChange={(value) => handleAnswerSelect(currentQuestionIndex, parseInt(value))}
          >
            <div className="space-y-3">
              {currentQuestion.options.map((option, index) => (
                <div
                  key={index}
                  className={`flex items-center space-x-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    selectedAnswers[currentQuestionIndex] === index
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => handleAnswerSelect(currentQuestionIndex, index)}
                >
                  <RadioGroupItem value={index.toString()} id={`option-${index}`} />
                  <Label
                    htmlFor={`option-${index}`}
                    className="flex-1 cursor-pointer"
                  >
                    {option}
                  </Label>
                </div>
              ))}
            </div>
          </RadioGroup>
        </div>
      </Card>

      <div className="flex items-center justify-between mt-6">
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={currentQuestionIndex === 0}
        >
          Previous
        </Button>

        <div className="text-sm text-muted-foreground">
          {Object.keys(selectedAnswers).length} of {questions.length} answered
        </div>

        {currentQuestionIndex < questions.length - 1 ? (
          <Button onClick={handleNext}>
            Next
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={!allAnswered}
            className="bg-green-600 hover:bg-green-700"
          >
            Submit Quiz
          </Button>
        )}
      </div>
    </div>
  );
}
