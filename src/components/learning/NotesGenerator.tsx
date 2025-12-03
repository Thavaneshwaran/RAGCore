import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Download, Sparkles, Copy, Check, FileText } from 'lucide-react';
import { ragService } from '@/lib/rag/ragService';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import html2pdf from 'html2pdf.js';

interface NotesGeneratorProps {
  onBack: () => void;
}

export function NotesGenerator({ onBack }: NotesGeneratorProps) {
  const [notes, setNotes] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [copied, setCopied] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const notesContentRef = useRef<HTMLDivElement>(null);

  const generateNotes = async (prompt?: string) => {
    setIsGenerating(true);
    setNotes('');

    try {
      // Get context from all documents
      const context = await ragService.query('summarize and create notes from all documents', 20);
      
      if (context.length === 0) {
        toast.error('No documents found to generate notes from');
        setIsGenerating(false);
        return;
      }

      const instructions = prompt || `Create comprehensive, well-structured notes from the provided document content. 

Format your notes with:
- Clear headings and subheadings with relevant emojis (📚, 💡, ⭐, 🎯, etc.)
- Bullet points for key concepts with emojis to highlight importance
- Bold text for important terms
- Code blocks for technical content
- Organized sections with visual hierarchy
- Use emojis throughout to make the content engaging and easier to scan

Style guidelines:
- Add emojis at the start of headings (## 📚 Main Topic)
- Use emojis for bullet points (✓, •, →, ⚡, 🔑)
- Add visual breaks with emoji separators
- Make it visually appealing and easy to read

Be thorough but concise, and make the notes engaging with appropriate emoji usage.`;

      const contextText = context.map(r => r.chunk.content).join('\n\n');

      let fullNotes = '';
      await ragService.generateResponse(
        `${instructions}\n\nCreate detailed notes from this content:\n\n${contextText}`,
        context,
        (token) => {
          fullNotes += token;
          setNotes(fullNotes);
        },
        () => {
          setIsGenerating(false);
          toast.success('Notes generated successfully');
        },
        (error) => {
          console.error('Error generating notes:', error);
          toast.error('Failed to generate notes');
          setIsGenerating(false);
        }
      );
    } catch (error) {
      console.error('Error generating notes:', error);
      toast.error('Failed to generate notes');
      setIsGenerating(false);
    }
  };

  const downloadNotes = () => {
    const blob = new Blob([notes], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notes-${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Notes downloaded');
  };

  const copyNotes = () => {
    navigator.clipboard.writeText(notes);
    setCopied(true);
    toast.success('Notes copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadPdf = async () => {
    if (!notesContentRef.current) return;
    
    setIsExportingPdf(true);
    
    try {
      const element = notesContentRef.current;
      
      const opt = {
        margin: [15, 15, 15, 15] as [number, number, number, number],
        filename: `notes-${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { 
          scale: 2,
          useCORS: true,
          letterRendering: true,
          scrollY: 0,
          scrollX: 0,
        },
        jsPDF: { 
          unit: 'mm', 
          format: 'a4', 
          orientation: 'portrait' as const,
          compress: true,
        },
        pagebreak: { 
          mode: ['avoid-all', 'css', 'legacy'],
          before: '.page-break-before',
          after: '.page-break-after',
        }
      };

      await html2pdf().set(opt).from(element).save();
      toast.success('PDF downloaded successfully');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF');
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="h-full flex flex-col p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h2 className="text-2xl font-bold">Generate Notes</h2>
        </div>
        <div className="flex gap-2">
          {notes && (
            <>
              <Button variant="outline" onClick={copyNotes} disabled={isExportingPdf}>
                {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
              <Button variant="outline" onClick={downloadNotes} disabled={isExportingPdf}>
                <Download className="w-4 h-4 mr-2" />
                Markdown
              </Button>
              <Button 
                variant="outline" 
                onClick={downloadPdf}
                disabled={isExportingPdf}
              >
                <FileText className="w-4 h-4 mr-2" />
                {isExportingPdf ? 'Generating...' : 'PDF'}
              </Button>
            </>
          )}
        </div>
      </div>

      {!notes && !isGenerating && (
        <Card className="p-8 space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Custom Instructions (Optional)</h3>
            <Textarea
              placeholder="Enter custom instructions for note generation (e.g., 'Focus on technical details', 'Create a summary for beginners', 'Extract only definitions')"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>
          <Button 
            onClick={() => generateNotes(customPrompt || undefined)} 
            className="w-full"
            size="lg"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Generate Notes
          </Button>
        </Card>
      )}

      {isGenerating && (
        <Card className="p-8">
          <div className="flex items-center justify-center gap-3">
            <Sparkles className="w-5 h-5 animate-pulse text-primary" />
            <p className="text-lg">Generating your notes...</p>
          </div>
        </Card>
      )}

      {notes && (
        <Card className="flex-1 overflow-auto p-8">
          <div 
            ref={notesContentRef}
            className="prose prose-slate dark:prose-invert max-w-none"
            style={{
              // Styles for better PDF rendering
              fontSize: '14px',
              lineHeight: '1.6',
              color: '#1a1a1a',
            }}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {notes}
            </ReactMarkdown>
          </div>
        </Card>
      )}
    </div>
  );
}
