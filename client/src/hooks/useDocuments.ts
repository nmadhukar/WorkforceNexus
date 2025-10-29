import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

/**
 * Document type from schema
 */
export interface Document {
  id: number;
  employeeId?: number;
  documentType: string;
  documentName: string;
  fileName: string;
  filePath?: string;
  storageType: 'local' | 's3';
  storageKey: string;
  fileSize: number;
  mimeType: string;
  signedDate?: string;
  uploadedDate: string;
  expirationDate?: string;
  isVerified: boolean;
  verifiedBy?: string;
  verificationDate?: string;
  notes?: string;
  s3Etag?: string;
  s3VersionId?: string;
  createdAt: string;
}

/**
 * Options for useDocuments hook
 */
export interface UseDocumentsOptions {
  employeeId?: number;
  locationId?: number;
  documentType?: string;
  enabled?: boolean;
}

/**
 * Upload document options
 */
export interface UploadDocumentOptions {
  file: File;
  documentType: string;
  documentName?: string;
  notes?: string;
  signedDate?: string;
  employeeId?: number;
  locationId?: number;
}

/**
 * Custom hook for document management with React Query
 * 
 * @param options - Configuration options
 * @returns Document management utilities and state
 * 
 * @example
 * ```typescript
 * const { documents, isLoading, upload, deleteDoc } = useDocuments({ employeeId: 123 });
 * 
 * // Upload a document
 * upload.mutate({
 *   file: selectedFile,
 *   documentType: 'Medical License',
 *   notes: 'Updated license'
 * });
 * 
 * // Delete a document
 * deleteDoc.mutate(documentId);
 * ```
 */
export function useDocuments(options: UseDocumentsOptions = {}) {
  const { employeeId, locationId, documentType, enabled = true } = options;
  const { toast } = useToast();

  // Construct query key based on filters
  const queryKey = employeeId 
    ? ['/api/documents/employee', employeeId]
    : locationId
    ? ['/api/compliance-documents', locationId]
    : ['/api/documents'];

  // Fetch documents
  const { data: documents = [], isLoading, error, refetch } = useQuery<Document[]>({
    queryKey,
    queryFn: async () => {
      let url = '';
      
      if (employeeId) {
        url = `/api/documents/employee/${employeeId}`;
      } else if (locationId) {
        url = `/api/documents/compliance/${locationId}`;
      } else {
        url = '/api/documents';
      }

      const params = new URLSearchParams();
      if (documentType) {
        params.append('type', documentType);
      }

      const fullUrl = params.toString() ? `${url}?${params}` : url;
      const res = await fetch(fullUrl, { credentials: 'include' });
      
      if (!res.ok) {
        throw new Error('Failed to fetch documents');
      }
      
      const data = await res.json();
      
      // Handle different response formats
      if (Array.isArray(data)) {
        return data;
      } else if (data.documents && Array.isArray(data.documents)) {
        return data.documents;
      }
      
      return [];
    },
    enabled
  });

  // Upload document mutation
  const uploadMutation = useMutation({
    mutationFn: async (options: UploadDocumentOptions) => {
      const formData = new FormData();
      formData.append('document', options.file);
      formData.append('documentType', options.documentType);
      
      if (options.documentName) {
        formData.append('documentName', options.documentName);
      }
      if (options.notes) {
        formData.append('notes', options.notes);
      }
      if (options.signedDate) {
        formData.append('signedDate', options.signedDate);
      }
      
      // Determine which ID to use (from options or from hook context)
      const targetEmployeeId = options.employeeId || employeeId;
      const targetLocationId = options.locationId || locationId;
      
      // Add the appropriate ID to FormData
      if (targetEmployeeId) {
        formData.append('employeeId', targetEmployeeId.toString());
      }
      if (targetLocationId) {
        formData.append('locationId', targetLocationId.toString());
      }

      // Determine upload endpoint based on context
      let endpoint = '/api/documents/upload';
      
      if (targetEmployeeId) {
        endpoint = `/api/documents/employee/${targetEmployeeId}/upload`;
      } else if (targetLocationId) {
        endpoint = `/api/documents/compliance/${targetLocationId}/upload`;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Upload failed');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Document uploaded successfully'
      });
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/documents/stats'] });
      
      if (employeeId) {
        queryClient.invalidateQueries({ queryKey: ['/api/employees', employeeId] });
      }
      
      if (locationId) {
        queryClient.invalidateQueries({ queryKey: ['/api/compliance-documents', locationId] });
        queryClient.invalidateQueries({ queryKey: ['/api/compliance/dashboard'] });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Upload Failed',
        description: error.message || 'Failed to upload document',
        variant: 'destructive'
      });
    }
  });

  // Delete document mutation
  const deleteMutation = useMutation({
    mutationFn: async (documentId: number) => {
      const response = await apiRequest('DELETE', `/api/documents/${documentId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Document deleted successfully'
      });
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/documents/stats'] });
      
      if (employeeId) {
        queryClient.invalidateQueries({ queryKey: ['/api/employees', employeeId] });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Delete Failed',
        description: error.message || 'Failed to delete document',
        variant: 'destructive'
      });
    }
  });

  // Get presigned URL for download
  const getPresignedUrl = async (documentId: number): Promise<string> => {
    try {
      const response = await fetch(`/api/documents/${documentId}/presigned-url`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to get download URL');
      }
      
      const data = await response.json();
      return data.url || data.presignedUrl;
    } catch (error) {
      toast({
        title: 'Download Failed',
        description: 'Failed to generate download link',
        variant: 'destructive'
      });
      throw error;
    }
  };

  // Download document
  const download = async (documentId: number, fileName?: string, mimeType?: string) => {
    try {
      // Use direct download endpoint (streams through server, avoids CORS issues)
      const url = `/api/documents/${documentId}/download`;
      
      // For images, open in new tab instead of downloading
      if (mimeType?.startsWith('image/')) {
        window.open(url, '_blank');
        return;
      }
      
      // For other files, trigger download
      const link = document.createElement('a');
      link.href = url;
      if (fileName) {
        link.download = fileName;
      }
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      toast({
        title: 'Download Failed',
        description: 'Failed to download document',
        variant: 'destructive'
      });
    }
  };

  return {
    documents,
    isLoading,
    error,
    refetch,
    upload: uploadMutation,
    deleteDoc: deleteMutation,
    download,
    getPresignedUrl
  };
}
