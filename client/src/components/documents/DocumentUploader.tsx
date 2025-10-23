import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useDocuments } from "@/hooks/useDocuments";
import { Upload, X, FileText, Image as ImageIcon, File as FileIcon, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Props for DocumentUploader component
 */
export interface DocumentUploaderProps {
  employeeId?: number;
  locationId?: number;
  documentType?: string;
  allowedTypes?: string[];
  maxSizeBytes?: number;
  onUploadComplete?: () => void;
}

/**
 * File with preview information
 */
interface FileWithPreview {
  file: File;
  preview?: string;
  progress: number;
  uploaded: boolean;
  error?: string;
}

const DEFAULT_ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

const DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10MB

const DOCUMENT_TYPES = [
  'Medical License',
  'DEA License',
  'State License',
  'Board Certification',
  'I-9 Form',
  'W-4 Form',
  'Training Certificate',
  'Insurance Document',
  'Contract',
  'Compliance Document',
  'Other'
];

/**
 * Reusable document uploader component with drag-and-drop support
 * 
 * @component
 * @param {DocumentUploaderProps} props - Component props
 * @returns {JSX.Element} Document uploader interface
 * 
 * @example
 * ```tsx
 * <DocumentUploader 
 *   employeeId={123}
 *   onUploadComplete={() => console.log('Upload complete')}
 * />
 * ```
 * 
 * @description
 * - Drag-and-drop file upload zone with visual feedback
 * - Multiple file upload support
 * - File type and size validation
 * - Image preview thumbnails
 * - Upload progress indicators
 * - Success/error state handling
 * - Integrates with useDocuments hook for API calls
 * - Automatic query invalidation after successful uploads
 * - Accessible with keyboard navigation
 * - All interactive elements have data-testid attributes
 */
export function DocumentUploader({
  employeeId,
  locationId,
  documentType: defaultDocumentType,
  allowedTypes = DEFAULT_ALLOWED_TYPES,
  maxSizeBytes = DEFAULT_MAX_SIZE,
  onUploadComplete
}: DocumentUploaderProps) {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedDocumentType, setSelectedDocumentType] = useState(defaultDocumentType || '');
  const [notes, setNotes] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { upload } = useDocuments({ employeeId, locationId });

  /**
   * Validate file type and size
   */
  const validateFile = (file: File): string | null => {
    if (!allowedTypes.includes(file.type)) {
      return `File type ${file.type} is not allowed`;
    }
    
    if (file.size > maxSizeBytes) {
      return `File size exceeds ${Math.round(maxSizeBytes / 1024 / 1024)}MB limit`;
    }
    
    return null;
  };

  /**
   * Generate preview URL for images
   */
  const generatePreview = (file: File): string | undefined => {
    if (file.type.startsWith('image/')) {
      return URL.createObjectURL(file);
    }
    return undefined;
  };

  /**
   * Add files to upload queue
   */
  const addFiles = (newFiles: FileList | File[]) => {
    const filesArray = Array.from(newFiles);
    
    const validatedFiles: FileWithPreview[] = filesArray
      .map(file => {
        const error = validateFile(file);
        return {
          file,
          preview: generatePreview(file),
          progress: 0,
          uploaded: false,
          error: error || undefined
        };
      });
    
    setFiles(prev => [...prev, ...validatedFiles]);
  };

  /**
   * Handle drag over event
   */
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  /**
   * Handle drag leave event
   */
  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  /**
   * Handle drop event
   */
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      addFiles(droppedFiles);
    }
  };

  /**
   * Handle file input change
   */
  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
    }
  };

  /**
   * Remove file from queue
   */
  const removeFile = (index: number) => {
    setFiles(prev => {
      const newFiles = [...prev];
      if (newFiles[index].preview) {
        URL.revokeObjectURL(newFiles[index].preview!);
      }
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  /**
   * Upload all files
   */
  const handleUpload = async () => {
    if (!selectedDocumentType) {
      return;
    }

    const validFiles = files.filter(f => !f.error && !f.uploaded);
    
    for (let i = 0; i < validFiles.length; i++) {
      const fileIndex = files.findIndex(f => f.file === validFiles[i].file);
      
      setFiles(prev => {
        const newFiles = [...prev];
        newFiles[fileIndex].progress = 10;
        return newFiles;
      });

      try {
        await upload.mutateAsync({
          file: validFiles[i].file,
          documentType: selectedDocumentType,
          notes,
          employeeId
        });

        setFiles(prev => {
          const newFiles = [...prev];
          newFiles[fileIndex].progress = 100;
          newFiles[fileIndex].uploaded = true;
          return newFiles;
        });
      } catch (error) {
        setFiles(prev => {
          const newFiles = [...prev];
          newFiles[fileIndex].error = error instanceof Error ? error.message : 'Upload failed';
          newFiles[fileIndex].progress = 0;
          return newFiles;
        });
      }
    }

    const allUploaded = files.every(f => f.uploaded || f.error);
    if (allUploaded && onUploadComplete) {
      onUploadComplete();
    }
  };

  /**
   * Clear all files
   */
  const clearAll = () => {
    files.forEach(f => {
      if (f.preview) {
        URL.revokeObjectURL(f.preview);
      }
    });
    setFiles([]);
    setNotes('');
  };

  /**
   * Get file icon based on type
   */
  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) {
      return <ImageIcon className="w-6 h-6 text-blue-500" />;
    } else if (type.includes('pdf')) {
      return <FileText className="w-6 h-6 text-red-500" />;
    }
    return <FileIcon className="w-6 h-6 text-gray-500" />;
  };

  /**
   * Format file size
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const hasValidFiles = files.some(f => !f.error && !f.uploaded);
  const hasErrors = files.some(f => f.error);

  return (
    <Card className="shadow-sm">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center text-lg">
          <Upload className="w-5 h-5 mr-2 text-primary" />
          Upload Documents
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        {/* Document Type Selection */}
        <div className="space-y-2">
          <Label htmlFor="document-type">Document Type *</Label>
          <Select 
            value={selectedDocumentType} 
            onValueChange={setSelectedDocumentType}
            disabled={!!defaultDocumentType}
          >
            <SelectTrigger id="document-type" data-testid="select-document-type">
              <SelectValue placeholder="Select document type" />
            </SelectTrigger>
            <SelectContent>
              {DOCUMENT_TYPES.map(type => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Drag and Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
            isDragging 
              ? "border-primary bg-blue-50 dark:bg-blue-950" 
              : "border-slate-300 hover:border-primary hover:bg-slate-50 dark:hover:bg-slate-900"
          )}
          data-testid="dropzone-upload"
        >
          <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-sm font-medium text-foreground mb-1">
            Drag and drop files here, or click to browse
          </p>
          <p className="text-xs text-muted-foreground">
            Supported: PDF, DOC, DOCX, JPG, PNG (max {Math.round(maxSizeBytes / 1024 / 1024)}MB)
          </p>
          
          <Input
            ref={fileInputRef}
            type="file"
            multiple
            accept={allowedTypes.join(',')}
            onChange={handleFileSelect}
            className="hidden"
            data-testid="input-file-upload"
          />
        </div>

        {/* File List */}
        {files.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">
                Selected Files ({files.length})
              </Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                data-testid="button-clear-all"
              >
                Clear All
              </Button>
            </div>
            
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {files.map((fileItem, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border",
                    fileItem.error ? "border-destructive bg-destructive/5" : "border-border bg-card"
                  )}
                  data-testid={`file-preview-${index}`}
                >
                  {/* File preview or icon */}
                  {fileItem.preview ? (
                    <img
                      src={fileItem.preview}
                      alt={fileItem.file.name}
                      className="w-12 h-12 object-cover rounded"
                    />
                  ) : (
                    <div className="w-12 h-12 flex items-center justify-center bg-muted rounded">
                      {getFileIcon(fileItem.file.type)}
                    </div>
                  )}

                  {/* File info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" title={fileItem.file.name}>
                      {fileItem.file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(fileItem.file.size)}
                    </p>
                    
                    {/* Progress bar */}
                    {fileItem.progress > 0 && fileItem.progress < 100 && (
                      <Progress value={fileItem.progress} className="h-1 mt-1" />
                    )}
                    
                    {/* Error message */}
                    {fileItem.error && (
                      <p className="text-xs text-destructive mt-1">{fileItem.error}</p>
                    )}
                  </div>

                  {/* Status icon */}
                  {fileItem.uploaded ? (
                    <Badge variant="default" className="bg-green-600">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Uploaded
                    </Badge>
                  ) : !fileItem.error && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(index);
                      }}
                      data-testid={`button-remove-${index}`}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes">Notes (Optional)</Label>
          <Input
            id="notes"
            placeholder="Add any additional notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            data-testid="input-notes"
          />
        </div>

        {/* Error Summary */}
        {hasErrors && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-sm text-destructive">
              Some files have errors. Please remove them or fix the issues before uploading.
            </p>
          </div>
        )}

        {/* Upload Button */}
        <div className="flex gap-2">
          <Button
            onClick={handleUpload}
            disabled={!selectedDocumentType || !hasValidFiles || upload.isPending}
            className="flex-1"
            data-testid="button-upload"
          >
            {upload.isPending ? 'Uploading...' : `Upload ${files.filter(f => !f.error && !f.uploaded).length} File(s)`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
