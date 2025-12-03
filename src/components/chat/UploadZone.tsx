import { useState, useRef, DragEvent } from 'react';
import { Upload, FileText, X, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface UploadZoneProps {
  onUpload: (file: File) => Promise<void>;
  isUploading: boolean;
  uploadProgress?: string;
}

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

export function UploadZone({ onUpload, isUploading, uploadProgress }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showSizeWarning, setShowSizeWarning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      const validTypes = [
        'application/pdf',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp'
      ];
      
      if (validTypes.includes(file.type) || file.name.match(/\.(pdf|ppt|pptx|doc|docx|txt|jpg|jpeg|png|webp)$/i)) {
        handleFileSelect(file);
      }
    }
  };

  const handleFileSelect = (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      setSelectedFile(file);
      setShowSizeWarning(true);
    } else {
      setSelectedFile(file);
      setShowSizeWarning(false);
      onUpload(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const confirmLargeUpload = () => {
    if (selectedFile) {
      setShowSizeWarning(false);
      onUpload(selectedFile);
    }
  };

  const cancelUpload = () => {
    setSelectedFile(null);
    setShowSizeWarning(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="p-4">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.ppt,.pptx,.doc,.docx,.txt,.jpg,.jpeg,.png,.webp,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,image/jpeg,image/png,image/webp"
        onChange={handleFileInputChange}
        className="hidden"
        aria-label="Upload document or image"
      />

      {/* Size warning dialog */}
      {showSizeWarning && selectedFile && (
        <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-destructive">Large file warning</p>
              <p className="text-sm text-muted-foreground mt-1">
                "{selectedFile.name}" is {(selectedFile.size / (1024 * 1024)).toFixed(1)}MB.
                Files over 25MB may take longer to process.
              </p>
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={confirmLargeUpload}
                >
                  Upload anyway
                </Button>
                <Button size="sm" variant="outline" onClick={cancelUpload}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload zone */}
      {isUploading ? (
        <div className="flex flex-col items-center justify-center py-8 px-4 bg-secondary rounded-xl space-y-4">
          {selectedFile && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="w-4 h-4" />
              <span className="truncate max-w-xs">{selectedFile.name}</span>
            </div>
          )}
          
          {/* Extract percentage from uploadProgress string */}
          {(() => {
            const progressText = uploadProgress || 'Uploading...';
            const percentMatch = progressText.match(/(\d+)%/);
            const percentage = percentMatch ? parseInt(percentMatch[1]) : 0;
            const stage = progressText.split(':')[0] || progressText;
            
            return (
              <div className="w-full max-w-sm space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground font-medium">{stage}</span>
                  <span className="text-primary font-semibold">{percentage}%</span>
                </div>
                <Progress value={percentage} className="h-2" />
              </div>
            );
          })()}
          
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            'drop-zone cursor-pointer flex flex-col items-center justify-center py-8 px-4',
            isDragging && 'active'
          )}
        >
          <Upload className="w-8 h-8 text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-foreground">
            Drop a document or image here or click to upload
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Supported: PDF, PPT, DOC, TXT, JPG, PNG (Max: 25MB)
          </p>
        </div>
      )}
    </div>
  );
}
