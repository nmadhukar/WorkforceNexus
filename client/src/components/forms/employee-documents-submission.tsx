import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Upload, 
  FileText, 
  FileImage,
  File,
  Plus, 
  Eye, 
  Replace,
  X,
  AlertTriangle,
  CheckCircle,
  Clock
} from "lucide-react";
import { cn } from "@/lib/utils";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_FILE_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png"
];

const additionalDocumentSchema = z.object({
  documentName: z.string().min(1, "Document name is required"),
  effectiveDate: z.string().optional(),
  endDate: z.string().optional(),
  notes: z.string().optional()
});

type AdditionalDocumentData = z.infer<typeof additionalDocumentSchema>;

interface DocumentUpload {
  id?: number;
  documentTypeId?: number;
  documentTypeName: string;
  fileName: string;
  uploadDate: string;
  effectiveDate?: string;
  endDate?: string;
  status: "uploaded" | "pending";
  fileUrl?: string;
  notes?: string;
  isRequired: boolean;
}

interface RequiredDocumentType {
  id: number;
  name: string;
  isRequired: boolean;
  description?: string;
}

interface EmployeeDocumentsSubmissionProps {
  data: any;
  onChange: (data: any) => void;
  employeeId?: number;
}

export function EmployeeDocumentsSubmission({ 
  data, 
  onChange, 
  employeeId 
}: EmployeeDocumentsSubmissionProps) {
  const { toast } = useToast();
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isAdditionalDialogOpen, setIsAdditionalDialogOpen] = useState(false);
  const [selectedDocumentType, setSelectedDocumentType] = useState<RequiredDocumentType | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [documentUploads, setDocumentUploads] = useState<DocumentUpload[]>(data.documentUploads || []);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const additionalFileInputRef = useRef<HTMLInputElement>(null);

  const additionalDocForm = useForm<AdditionalDocumentData>({
    resolver: zodResolver(additionalDocumentSchema),
    defaultValues: {
      documentName: "",
      effectiveDate: "",
      endDate: "",
      notes: ""
    }
  });

  // Fetch required document types
  const { data: requiredDocumentTypes = [], isLoading: loadingDocTypes } = useQuery({
    queryKey: ["/api/onboarding/required-documents"],
    queryFn: async () => {
      const response = await fetch("/api/onboarding/required-documents", {
        credentials: "include"
      });
      if (!response.ok) {
        throw new Error("Failed to fetch required documents");
      }
      return response.json();
    }
  });

  // Fetch existing uploads if employeeId is provided
  const { data: existingUploads = [] } = useQuery({
    queryKey: ["/api/employees", employeeId, "document-uploads"],
    enabled: !!employeeId,
    queryFn: async () => {
      const response = await fetch(`/api/employees/${employeeId}/document-uploads`, {
        credentials: "include"
      });
      if (!response.ok) {
        throw new Error("Failed to fetch document uploads");
      }
      return response.json();
    }
  });

  useEffect(() => {
    if (employeeId && existingUploads.length > 0) {
      setDocumentUploads(existingUploads);
    }
  }, [existingUploads, employeeId]);

  useEffect(() => {
    onChange({ ...data, documentUploads });
  }, [documentUploads]);

  // Merge required documents with uploads
  const documentsTableData = requiredDocumentTypes.map((docType: RequiredDocumentType) => {
    const upload = documentUploads.find(u => u.documentTypeId === docType.id);
    return {
      ...docType,
      fileName: upload?.fileName || "Not uploaded",
      uploadDate: upload?.uploadDate,
      effectiveDate: upload?.effectiveDate,
      endDate: upload?.endDate,
      status: upload ? "uploaded" : "pending",
      fileUrl: upload?.fileUrl,
      uploadId: upload?.id
    };
  });

  // Add additional documents to table
  const additionalDocuments = documentUploads.filter(
    upload => !upload.documentTypeId || !requiredDocumentTypes.find((rt: RequiredDocumentType) => rt.id === upload.documentTypeId)
  );

  const allDocuments = [...documentsTableData, ...additionalDocuments];

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png'].includes(extension || '')) {
      return <FileImage className="h-4 w-4" />;
    }
    if (extension === 'pdf') {
      return <FileText className="h-4 w-4 text-red-600" />;
    }
    return <File className="h-4 w-4" />;
  };

  const getStatusBadge = (status: string, documentTypeId?: number) => {
    if (status === 'uploaded') {
      return (
        <Badge 
          className="bg-green-100 text-green-800"
          data-testid={documentTypeId ? `status-${documentTypeId}` : undefined}
        >
          <CheckCircle className="h-3 w-3 mr-1" />
          Uploaded
        </Badge>
      );
    }
    return (
      <Badge 
        className="bg-yellow-100 text-yellow-800"
        data-testid={documentTypeId ? `status-${documentTypeId}` : undefined}
      >
        <Clock className="h-3 w-3 mr-1" />
        Pending
      </Badge>
    );
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const validateAndSetFile = (file: File) => {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "File too large",
        description: "File size must be less than 10MB",
        variant: "destructive"
      });
      return;
    }

    // Check file type
    const fileType = file.type;
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    
    if (!ACCEPTED_FILE_TYPES.includes(fileType) && 
        !['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'].includes(fileExtension || '')) {
      toast({
        title: "Invalid file type",
        description: "Only PDF, DOC, DOCX, JPG, and PNG files are accepted",
        variant: "destructive"
      });
      return;
    }

    setSelectedFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const handleUploadForRequired = async () => {
    if (!selectedFile || !selectedDocumentType) return;

    setIsUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('documentTypeId', selectedDocumentType.id.toString());
    formData.append('documentTypeName', selectedDocumentType.name);

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const response = await apiRequest(
        "POST",
        employeeId 
          ? `/api/employees/${employeeId}/document-uploads`
          : `/api/onboarding/document-uploads`,
        formData
      );

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        throw new Error("Failed to upload document");
      }

      const result = await response.json();

      // Update local state
      const newUpload: DocumentUpload = {
        id: result.id,
        documentTypeId: selectedDocumentType.id,
        documentTypeName: selectedDocumentType.name,
        fileName: selectedFile.name,
        uploadDate: new Date().toISOString(),
        status: "uploaded",
        fileUrl: result.fileUrl,
        isRequired: true
      };

      setDocumentUploads(prev => {
        const filtered = prev.filter(u => u.documentTypeId !== selectedDocumentType.id);
        return [...filtered, newUpload];
      });

      toast({
        title: "Document uploaded",
        description: `${selectedDocumentType.name} has been uploaded successfully`
      });

      // Reset and close
      setSelectedFile(null);
      setSelectedDocumentType(null);
      setIsUploadDialogOpen(false);
      
      // Invalidate queries if needed
      if (employeeId) {
        queryClient.invalidateQueries({ 
          queryKey: ["/api/employees", employeeId, "document-uploads"] 
        });
      }
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload document",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleUploadAdditional = async (formData: AdditionalDocumentData) => {
    if (!selectedFile) {
      toast({
        title: "No file selected",
        description: "Please select a file to upload",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    const uploadFormData = new FormData();
    uploadFormData.append('file', selectedFile);
    uploadFormData.append('documentName', formData.documentName);
    if (formData.effectiveDate) {
      uploadFormData.append('effectiveDate', formData.effectiveDate);
    }
    if (formData.endDate) {
      uploadFormData.append('endDate', formData.endDate);
    }
    if (formData.notes) {
      uploadFormData.append('notes', formData.notes);
    }

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const response = await apiRequest(
        "POST",
        employeeId 
          ? `/api/employees/${employeeId}/document-uploads`
          : `/api/onboarding/document-uploads`,
        uploadFormData
      );

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        throw new Error("Failed to upload document");
      }

      const result = await response.json();

      // Update local state
      const newUpload: DocumentUpload = {
        id: result.id,
        documentTypeName: formData.documentName,
        fileName: selectedFile.name,
        uploadDate: new Date().toISOString(),
        effectiveDate: formData.effectiveDate,
        endDate: formData.endDate,
        status: "uploaded",
        fileUrl: result.fileUrl,
        notes: formData.notes,
        isRequired: false
      };

      setDocumentUploads(prev => [...prev, newUpload]);

      toast({
        title: "Document uploaded",
        description: `${formData.documentName} has been uploaded successfully`
      });

      // Reset and close
      setSelectedFile(null);
      additionalDocForm.reset();
      setIsAdditionalDialogOpen(false);
      
      // Invalidate queries if needed
      if (employeeId) {
        queryClient.invalidateQueries({ 
          queryKey: ["/api/employees", employeeId, "document-uploads"] 
        });
      }
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload document",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleOpenUploadDialog = (documentType: RequiredDocumentType) => {
    setSelectedDocumentType(documentType);
    setSelectedFile(null);
    setIsUploadDialogOpen(true);
  };

  const handleViewDocument = (fileUrl?: string) => {
    if (fileUrl) {
      window.open(fileUrl, '_blank');
    }
  };

  const handleReplaceDocument = (documentType: RequiredDocumentType) => {
    handleOpenUploadDialog(documentType);
  };

  // Check if all required documents are uploaded
  const allRequiredUploaded = requiredDocumentTypes
    .filter((dt: RequiredDocumentType) => dt.isRequired)
    .every((dt: RequiredDocumentType) => 
      documentUploads.some(u => u.documentTypeId === dt.id && u.status === "uploaded")
    );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Documents Submission
              </CardTitle>
              <CardDescription>Upload required and additional documents</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {!allRequiredUploaded && (
            <Alert className="border-yellow-200 bg-yellow-50">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                Please upload all required documents marked with a red asterisk (*) before submitting the form.
              </AlertDescription>
            </Alert>
          )}

          {loadingDocTypes ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center space-y-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="text-muted-foreground">Loading required documents...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border overflow-hidden">
                <Table data-testid="table-required-documents">
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Document Type</TableHead>
                      <TableHead>File Name</TableHead>
                      <TableHead>Upload Date</TableHead>
                      <TableHead>Effective Date</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allDocuments.map((doc: any, index) => (
                      <TableRow key={doc.id || `doc-${index}`}>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <span>{doc.documentTypeName || doc.name}</span>
                            {doc.isRequired && (
                              <span className="text-red-500">*</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {doc.fileName !== "Not uploaded" && getFileIcon(doc.fileName)}
                            <span className={cn(
                              doc.fileName === "Not uploaded" && "text-muted-foreground italic"
                            )}>
                              {doc.fileName}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {doc.uploadDate 
                            ? format(new Date(doc.uploadDate), "MMM dd, yyyy")
                            : "-"
                          }
                        </TableCell>
                        <TableCell>
                          {doc.effectiveDate 
                            ? format(new Date(doc.effectiveDate), "MMM dd, yyyy")
                            : "-"
                          }
                        </TableCell>
                        <TableCell>
                          {doc.endDate 
                            ? format(new Date(doc.endDate), "MMM dd, yyyy")
                            : "-"
                          }
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(doc.status, doc.id)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {doc.status === "uploaded" ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleViewDocument(doc.fileUrl)}
                                  className="h-8"
                                >
                                  <Eye className="h-4 w-4 mr-1" />
                                  View
                                </Button>
                                {doc.id && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleReplaceDocument(doc)}
                                    className="h-8"
                                  >
                                    <Replace className="h-4 w-4 mr-1" />
                                    Replace
                                  </Button>
                                )}
                              </>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenUploadDialog(doc)}
                                data-testid={`button-upload-${doc.id}`}
                                className="h-8"
                              >
                                <Upload className="h-4 w-4 mr-1" />
                                Upload
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-start pt-4">
                <Button
                  onClick={() => {
                    setSelectedFile(null);
                    additionalDocForm.reset();
                    setIsAdditionalDialogOpen(true);
                  }}
                  variant="outline"
                  data-testid="button-add-document"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Document
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Dialog for Required Documents */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Upload {selectedDocumentType?.name}</DialogTitle>
            <DialogDescription>
              Upload the required document. Accepted formats: PDF, DOC, DOCX, JPG, PNG (Max 10MB)
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50",
                selectedFile && "border-green-500 bg-green-50"
              )}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              data-testid="file-upload-zone"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              {selectedFile ? (
                <div className="space-y-2">
                  <CheckCircle className="h-10 w-10 text-green-600 mx-auto" />
                  <p className="font-medium">{selectedFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                    }}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-10 w-10 text-muted-foreground mx-auto" />
                  <p className="font-medium">Drop your file here or click to browse</p>
                  <p className="text-sm text-muted-foreground">
                    PDF, DOC, DOCX, JPG, PNG (Max 10MB)
                  </p>
                </div>
              )}
            </div>

            {isUploading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Uploading...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsUploadDialogOpen(false);
                  setSelectedFile(null);
                }}
                disabled={isUploading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUploadForRequired}
                disabled={!selectedFile || isUploading}
              >
                {isUploading ? "Uploading..." : "Upload"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Additional Document Dialog */}
      <Dialog open={isAdditionalDialogOpen} onOpenChange={setIsAdditionalDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Add Additional Document</DialogTitle>
            <DialogDescription>
              Upload any additional documents that may be relevant
            </DialogDescription>
          </DialogHeader>
          
          <Form {...additionalDocForm}>
            <form onSubmit={additionalDocForm.handleSubmit(handleUploadAdditional)} className="space-y-4">
              <div
                className={cn(
                  "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                  isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50",
                  selectedFile && "border-green-500 bg-green-50"
                )}
                onClick={() => additionalFileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                data-testid="file-upload-zone"
              >
                <input
                  ref={additionalFileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                
                {selectedFile ? (
                  <div className="space-y-2">
                    <CheckCircle className="h-8 w-8 text-green-600 mx-auto" />
                    <p className="font-medium text-sm">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                      }}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Upload className="h-8 w-8 text-muted-foreground mx-auto" />
                    <p className="font-medium text-sm">Drop your file here or click to browse</p>
                    <p className="text-xs text-muted-foreground">
                      PDF, DOC, DOCX, JPG, PNG (Max 10MB)
                    </p>
                  </div>
                )}
              </div>

              <FormField
                control={additionalDocForm.control}
                name="documentName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Document Name *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter document name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={additionalDocForm.control}
                  name="effectiveDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Effective Date</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={additionalDocForm.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={additionalDocForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes / Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="Add any relevant notes or description"
                        className="resize-none"
                        rows={3}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isUploading && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Uploading...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsAdditionalDialogOpen(false);
                    setSelectedFile(null);
                    additionalDocForm.reset();
                  }}
                  disabled={isUploading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!selectedFile || isUploading}
                >
                  {isUploading ? "Uploading..." : "Upload"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}