export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  isError?: boolean;
  isSuccess?: boolean;
  sourceIds?: string[]; // IDs of sources used in this answer
  feedback?: 'positive' | 'negative'; // User feedback on answer quality
}

export interface Source {
  id: string;
  content: string;
  expanded?: boolean;
  priority?: number;
  weightedScore?: number;
}
