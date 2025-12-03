import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Download, Sparkles, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { ragService } from '@/lib/rag/ragService';
import { toast } from 'sonner';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  BackgroundVariant,
} from 'reactflow';
import 'reactflow/dist/style.css';

interface MindmapGeneratorProps {
  onBack: () => void;
}

interface MindmapData {
  nodes: { id: string; label: string; level: number }[];
  edges: { from: string; to: string }[];
}

export function MindmapGenerator({ onBack }: MindmapGeneratorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const generateMindmap = async () => {
    setIsGenerating(true);

    try {
      const context = await ragService.query('extract all concepts and relationships', 20);
      
      if (context.length === 0) {
        toast.error('No documents found to generate mindmap from');
        setIsGenerating(false);
        return;
      }

      const instructions = `Analyze the content and create a hierarchical mindmap structure with emojis.

Return ONLY a valid JSON object with this exact structure:
{
  "nodes": [
    {"id": "1", "label": "📚 Main Topic", "level": 0},
    {"id": "2", "label": "💡 Subtopic 1", "level": 1},
    {"id": "3", "label": "⭐ Subtopic 2", "level": 1}
  ],
  "edges": [
    {"from": "1", "to": "2"},
    {"from": "1", "to": "3"}
  ]
}

Rules:
- level 0 = central topic (1 node only)
- level 1 = main concepts (3-5 nodes)
- level 2 = subconcepts (multiple nodes)
- Keep labels concise (2-5 words)
- Add relevant emojis at the start of each label (📚, 💡, ⭐, 🎯, ✨, 🔑, 📌, ⚡, etc.)
- Create logical parent-child relationships
- Return ONLY the JSON, no other text`;

      const contextText = context.map(r => r.chunk.content).join('\n\n');

      let responseText = '';
      await ragService.generateResponse(
        `${instructions}\n\nAnalyze this content and create a mindmap:\n\n${contextText}`,
        context,
        (token) => {
          responseText += token;
        },
        () => {
          try {
            // Extract JSON from response
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
              throw new Error('No JSON found in response');
            }
            
            const mindmapData: MindmapData = JSON.parse(jsonMatch[0]);
            createFlowNodes(mindmapData);
            setIsGenerating(false);
            toast.success('Mindmap generated successfully');
          } catch (error) {
            console.error('Error parsing mindmap:', error);
            toast.error('Failed to parse mindmap data');
            setIsGenerating(false);
          }
        },
        (error) => {
          console.error('Error generating mindmap:', error);
          toast.error('Failed to generate mindmap');
          setIsGenerating(false);
        }
      );
    } catch (error) {
      console.error('Error generating mindmap:', error);
      toast.error('Failed to generate mindmap');
      setIsGenerating(false);
    }
  };

  const createFlowNodes = (data: MindmapData) => {
    const levelSpacing = 250;
    const nodeSpacing = 150;
    const nodesPerLevel: { [key: number]: number } = {};

    const flowNodes: Node[] = data.nodes.map((node) => {
      const level = node.level;
      nodesPerLevel[level] = (nodesPerLevel[level] || 0) + 1;
      const indexInLevel = nodesPerLevel[level] - 1;

      const x = level * levelSpacing;
      const y = indexInLevel * nodeSpacing - (nodesPerLevel[level] * nodeSpacing) / 4;

      return {
        id: node.id,
        data: { label: node.label },
        position: { x, y },
        style: {
          background: level === 0 ? 'hsl(var(--primary))' : 'hsl(var(--card))',
          color: level === 0 ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))',
          border: '2px solid hsl(var(--border))',
          borderRadius: '12px',
          padding: '16px',
          fontSize: level === 0 ? '16px' : '14px',
          fontWeight: level === 0 ? '700' : '500',
          minWidth: '150px',
          textAlign: 'center',
        },
      };
    });

    const flowEdges: Edge[] = data.edges.map((edge, index) => ({
      id: `e${edge.from}-${edge.to}-${index}`,
      source: edge.from,
      target: edge.to,
      type: 'smoothstep',
      animated: true,
      style: { stroke: 'hsl(var(--primary))', strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: 'hsl(var(--primary))',
      },
    }));

    setNodes(flowNodes);
    setEdges(flowEdges);
  };

  const downloadMindmap = () => {
    const mindmapData = {
      nodes: nodes.map(n => ({
        id: n.id,
        label: n.data.label,
        position: n.position,
      })),
      edges: edges.map(e => ({
        from: e.source,
        to: e.target,
      })),
    };

    const blob = new Blob([JSON.stringify(mindmapData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mindmap-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Mindmap downloaded');
  };

  return (
    <div className="h-full flex flex-col p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h2 className="text-2xl font-bold">Generate Mindmap</h2>
        </div>
        <div className="flex gap-2">
          {nodes.length > 0 && (
            <Button variant="outline" onClick={downloadMindmap}>
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          )}
        </div>
      </div>

      {nodes.length === 0 && !isGenerating && (
        <Card className="p-8">
          <div className="flex flex-col items-center justify-center gap-6">
            <div className="text-center space-y-2">
              <h3 className="text-xl font-semibold">Create Interactive Mindmap</h3>
              <p className="text-muted-foreground">
                Visualize concepts and relationships from your documents
              </p>
            </div>
            <Button onClick={generateMindmap} size="lg">
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Mindmap
            </Button>
          </div>
        </Card>
      )}

      {isGenerating && (
        <Card className="p-8">
          <div className="flex items-center justify-center gap-3">
            <Sparkles className="w-5 h-5 animate-pulse text-primary" />
            <p className="text-lg">Analyzing documents and creating mindmap...</p>
          </div>
        </Card>
      )}

      {nodes.length > 0 && (
        <Card className="flex-1 overflow-hidden">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            fitView
          >
            <Controls />
            <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
          </ReactFlow>
        </Card>
      )}
    </div>
  );
}
