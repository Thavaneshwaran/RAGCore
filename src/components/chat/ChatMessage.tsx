import { Message } from '@/types/chat';
import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle2, Bot, User, Copy, Check, ThumbsUp, ThumbsDown, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { supabase } from '@/integrations/supabase/client';

interface ChatMessageProps {
  message: Message;
  onFeedback?: (messageId: string, isPositive: boolean) => void;
}

export function ChatMessage({ message, onFeedback }: ChatMessageProps) {
  const { role, content, isStreaming, isError, isSuccess, feedback, sourceIds } = message;
  const [copied, setCopied] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleFeedback = (isPositive: boolean) => {
    if (onFeedback && sourceIds && sourceIds.length > 0) {
      onFeedback(message.id, isPositive);
      toast.success(isPositive ? 'Thank you for your feedback!' : 'Feedback recorded. We\'ll learn from this.');
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success('Message copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy message');
    }
  };

  const handlePlayAudio = async () => {
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    if (audioRef.current && audioRef.current.src) {
      audioRef.current.play();
      setIsPlaying(true);
      return;
    }

    setIsLoadingAudio(true);
    try {
      const { data, error } = await supabase.functions.invoke('text-to-speech', {
        body: { text: content, voice: 'alloy' }
      });

      if (error) throw error;

      const audioBlob = new Blob(
        [Uint8Array.from(atob(data.audioContent), c => c.charCodeAt(0))],
        { type: 'audio/mpeg' }
      );
      const audioUrl = URL.createObjectURL(audioBlob);
      
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => setIsPlaying(false);
      audio.onerror = () => {
        setIsPlaying(false);
        toast.error('Failed to play audio');
      };

      await audio.play();
      setIsPlaying(true);
    } catch (err) {
      console.error('Text-to-speech error:', err);
      toast.error('Failed to generate audio');
    } finally {
      setIsLoadingAudio(false);
    }
  };

  // System message (status/error banners)
  if (role === 'system') {
    return (
      <div
        className={cn(
          'message-enter mx-auto max-w-2xl px-4 py-2 rounded-lg text-sm flex items-center gap-2',
          isError && 'bg-destructive/10 text-destructive border border-destructive/20',
          isSuccess && 'bg-success/10 text-success border border-success/20',
          !isError && !isSuccess && 'bg-secondary text-muted-foreground'
        )}
      >
        {isError && <AlertCircle className="w-4 h-4 flex-shrink-0" />}
        {isSuccess && <CheckCircle2 className="w-4 h-4 flex-shrink-0" />}
        <span>{content}</span>
      </div>
    );
  }

  const isUser = role === 'user';

  return (
    <div
      className={cn(
        'message-enter message-bubble flex gap-4 px-4 py-6 rounded-lg',
        isUser ? 'bg-user-bubble' : 'bg-assistant-bubble'
      )}
    >
      <div className="max-w-3xl mx-auto w-full flex gap-4">
        {/* Avatar */}
        <div
          className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-transform duration-300 hover:scale-110',
            isUser ? 'bg-primary/20' : 'bg-primary'
          )}
        >
          {isUser ? (
            <User className="w-4 h-4 text-primary" />
          ) : (
            <Bot className="w-4 h-4 text-primary-foreground" />
          )}
        </div>

        {/* Message content */}
        <div className="flex-1 min-w-0 group">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-medium text-muted-foreground">
              {isUser ? 'You' : 'Assistant'}
            </p>
            
            <div className="flex items-center gap-1">
              {/* Audio playback button - only show for assistant messages with content */}
              {!isUser && content && !isStreaming && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePlayAudio}
                  disabled={isLoadingAudio}
                  className="opacity-0 group-hover:opacity-100 transition-opacity h-8 px-2"
                  aria-label={isPlaying ? "Stop audio" : "Play audio"}
                >
                  {isLoadingAudio ? (
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  ) : isPlaying ? (
                    <VolumeX className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </Button>
              )}

              {/* Copy button - only show for assistant messages with content */}
              {!isUser && content && !isStreaming && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  className="opacity-0 group-hover:opacity-100 transition-opacity h-8 px-2"
                  aria-label="Copy message"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-success" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              )}
              
              {/* Feedback buttons - only show for assistant messages with sources */}
              {!isUser && content && !isStreaming && sourceIds && sourceIds.length > 0 && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleFeedback(true)}
                    disabled={feedback !== undefined}
                    className={cn(
                      "h-8 px-2",
                      feedback === 'positive' && "text-success"
                    )}
                    aria-label="This answer was helpful"
                  >
                    <ThumbsUp className={cn("w-4 h-4", feedback === 'positive' && "fill-success")} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleFeedback(false)}
                    disabled={feedback !== undefined}
                    className={cn(
                      "h-8 px-2",
                      feedback === 'negative' && "text-destructive"
                    )}
                    aria-label="This answer was not helpful"
                  >
                    <ThumbsDown className={cn("w-4 h-4", feedback === 'negative' && "fill-destructive")} />
                  </Button>
                </div>
              )}
            </div>
          </div>
          
          <div
            className={cn(
              'text-foreground leading-relaxed prose prose-sm max-w-none dark:prose-invert',
              isStreaming && 'streaming-cursor'
            )}
          >
            {content ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
              </ReactMarkdown>
            ) : (
              isStreaming && <span className="text-muted-foreground">Thinking...</span>
            )}
          </div>

          {/* Typing indicator for empty streaming messages */}
          {isStreaming && !content && (
            <div className="typing-indicator mt-2">
              <span></span>
              <span></span>
              <span></span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
