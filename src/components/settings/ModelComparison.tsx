import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertCircle, Server, Cloud, Sparkles } from "lucide-react";

interface ComparisonFeature {
  label: string;
  local: boolean | string;
  lovable: boolean | string;
  custom: boolean | string;
}

const features: ComparisonFeature[] = [
  {
    label: "API Key Required",
    local: false,
    lovable: false,
    custom: true,
  },
  {
    label: "Powerful Device Required",
    local: true,
    lovable: false,
    custom: false,
  },
  {
    label: "Internet Required",
    local: "Setup only",
    lovable: true,
    custom: true,
  },
  {
    label: "Cost",
    local: "Free",
    lovable: "Usage-based",
    custom: "Varies by provider",
  },
  {
    label: "Privacy",
    local: "100% Local",
    lovable: "Cloud processed",
    custom: "Cloud processed",
  },
  {
    label: "Speed",
    local: "Hardware dependent",
    lovable: "Fast",
    custom: "Varies",
  },
  {
    label: "Setup Difficulty",
    local: "Advanced",
    lovable: "Instant",
    custom: "Moderate",
  },
  {
    label: "Model Selection",
    local: "Download required",
    lovable: "Pre-configured",
    custom: "Provider dependent",
  },
];

export function ModelComparison() {
  const renderValue = (value: boolean | string) => {
    if (typeof value === 'boolean') {
      return value ? (
        <XCircle className="w-5 h-5 text-destructive" />
      ) : (
        <CheckCircle2 className="w-5 h-5 text-green-500" />
      );
    }
    return <span className="text-sm text-muted-foreground">{value}</span>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Choose Your Model Setup</h3>
        <p className="text-sm text-muted-foreground">
          Compare different options to find the best fit for your needs and device capabilities.
        </p>
      </div>

      {/* Quick recommendations */}
      <div className="grid gap-3 md:grid-cols-3">
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <CardTitle className="text-sm">Best for Beginners</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-2">
              <strong>Lovable AI</strong> - No setup required, no API keys, works on any device
            </p>
            <Badge variant="secondary" className="text-xs">Recommended</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5 text-primary" />
              <CardTitle className="text-sm">Best for Privacy</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-2">
              <strong>Local Ollama</strong> - 100% private, data never leaves your device
            </p>
            <Badge variant="outline" className="text-xs">Requires powerful PC</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Cloud className="w-5 h-5 text-primary" />
              <CardTitle className="text-sm">Best for Flexibility</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-2">
              <strong>Custom APIs</strong> - Use your preferred provider (OpenAI, Gemini, etc.)
            </p>
            <Badge variant="outline" className="text-xs">Requires API key</Badge>
          </CardContent>
        </Card>
      </div>

      {/* Detailed comparison table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-3 text-sm font-medium">Feature</th>
                <th className="text-center p-3 text-sm font-medium">
                  <div className="flex flex-col items-center gap-1">
                    <Server className="w-4 h-4" />
                    <span>Local Ollama</span>
                  </div>
                </th>
                <th className="text-center p-3 text-sm font-medium">
                  <div className="flex flex-col items-center gap-1">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span>Lovable AI</span>
                  </div>
                </th>
                <th className="text-center p-3 text-sm font-medium">
                  <div className="flex flex-col items-center gap-1">
                    <Cloud className="w-4 h-4" />
                    <span>Custom APIs</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {features.map((feature, index) => (
                <tr key={index} className="border-t">
                  <td className="p-3 text-sm font-medium">{feature.label}</td>
                  <td className="p-3 text-center">{renderValue(feature.local)}</td>
                  <td className="p-3 text-center bg-primary/5">{renderValue(feature.lovable)}</td>
                  <td className="p-3 text-center">{renderValue(feature.custom)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Additional notes */}
      <div className="bg-muted/50 p-4 rounded-lg space-y-2">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 text-primary" />
          <div className="text-xs text-muted-foreground space-y-1">
            <p>
              <strong>Local Ollama:</strong> Best for users with powerful computers (8GB+ RAM, modern CPU/GPU) who prioritize privacy. 
              Requires installing Ollama and downloading models locally.
            </p>
            <p>
              <strong>Lovable AI:</strong> Perfect for users without powerful devices or those who want instant setup. 
              Uses usage-based pricing with free included usage. No API key management needed.
            </p>
            <p>
              <strong>Custom APIs:</strong> Ideal if you already have API keys for OpenAI, Google Gemini, or other providers. 
              Offers flexibility in choosing specific models and providers.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}