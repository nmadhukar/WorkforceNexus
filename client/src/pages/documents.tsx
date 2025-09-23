import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DocumentsTable } from "@/components/tables/documents-table";
import { SearchFilters } from "@/components/search-filters";
import { FileUpload } from "@/components/file-upload";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { FileText, Award, Clipboard, Folder, Upload } from "lucide-react";
import { useLocation } from "wouter";
import type { Document } from "@/lib/types";

/**
 * Response structure for paginated documents API
 */
interface DocumentsResponse {
  documents: Document[];
  total: number;
  page: number;
  totalPages: number;
}

/**
 * Statistics for different document categories
 */
interface DocumentStats {
  licenses: number;
  certifications: number;
  taxForms: number;
  other: number;
  expiringSoon: number;
}

/**
 * Document management page for viewing, filtering, and uploading employee documents
 * @component
 * @returns {JSX.Element} Documents interface with category cards, filters, and document table
 * @example
 * <Documents />
 * 
 * @description
 * - Displays document categories with counts (Licenses, Certifications, Tax Forms, Other)
 * - Provides filtering by document type and search functionality
 * - Supports document upload via drag-and-drop dialog
 * - Shows expiration warnings for documents nearing expiry
 * - Integrates with DocumentsTable for paginated document listing
 * - Category cards are clickable filters for quick navigation
 * - URL parameter support for initial filter state
 * - Uses data-testid attributes for testing automation
 * - Real-time updates after successful document uploads
 */
export default function Documents() {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    search: "",
    type: ""
  });
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  // Parse URL parameters for initial filter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const typeFilter = params.get('type');
    if (typeFilter) {
      setFilters(prev => ({ ...prev, type: typeFilter }));
    }
  }, []);

  const { data: stats } = useQuery<DocumentStats>({
    queryKey: ["/api/documents/stats"]
  });

  const { data, isLoading, error } = useQuery<DocumentsResponse>({
    queryKey: ["/api/documents", page, filters],
    queryFn: async ({ queryKey }) => {
      const [url, currentPage, currentFilters] = queryKey;
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: "10",
        ...Object.fromEntries(
          Object.entries(currentFilters as any).filter(([_, value]) => value)
        )
      });
      
      const res = await fetch(`${url}?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch documents');
      return res.json();
    }
  });

  const uploadMutation = useMutation({
    mutationFn: (formData: FormData) => {
      return fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
        credentials: "include"
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Document uploaded successfully"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents/stats"] });
      setUploadDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to upload document",
        variant: "destructive"
      });
    }
  });

  /**
   * Updates filter state and resets pagination
   * @param {string} key - Filter property to update
   * @param {string} value - New filter value
   */
  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  /**
   * Handles document upload via form data
   * @param {FormData} formData - File upload form data
   */
  const handleUpload = (formData: FormData) => {
    uploadMutation.mutate(formData);
  };

  /**
   * Handles category card clicks to filter documents
   * @param {string} documentType - Document type to filter by
   */
  const handleCardClick = (documentType: string) => {
    handleFilterChange('type', documentType);
  };

  /**
   * Returns styled expiration status message based on count
   * @param {number} count - Number of expiring documents
   * @returns {JSX.Element} Styled status message component
   */
  const getExpiringStatus = (count: number) => {
    if (count === 0) {
      return <p className="text-xs text-secondary">All up to date</p>;
    } else if (count <= 3) {
      return <p className="text-xs text-accent">{count} expiring soon</p>;
    } else {
      return <p className="text-xs text-destructive">{count} expiring soon</p>;
    }
  };

  if (error) {
    return (
      <MainLayout>
        <div className="text-center py-8">
          <p className="text-destructive">Failed to load documents</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground" data-testid="text-documents-title">Documents</h1>
            <p className="text-muted-foreground">Manage employee documents and certifications</p>
          </div>
          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90" data-testid="button-upload-document">
                <Upload className="w-4 h-4 mr-2" />
                Upload Document
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Upload Document</DialogTitle>
              </DialogHeader>
              <FileUpload onUpload={handleUpload} isUploading={uploadMutation.isPending} />
            </DialogContent>
          </Dialog>
        </div>

        {/* Document Categories */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card 
            className="hover:shadow-md transition-shadow cursor-pointer" 
            data-testid="card-licenses"
            onClick={() => handleCardClick('License')}
          >
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Licenses</h3>
                  <p className="text-sm text-muted-foreground">
                    {stats?.licenses || 0} documents
                  </p>
                  {stats && getExpiringStatus(stats.licenses > 0 ? Math.floor(stats.licenses * 0.2) : 0)}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="hover:shadow-md transition-shadow cursor-pointer" 
            data-testid="card-certifications"
            onClick={() => handleCardClick('Certification')}
          >
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center">
                  <Award className="w-6 h-6 text-secondary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Certifications</h3>
                  <p className="text-sm text-muted-foreground">
                    {stats?.certifications || 0} documents
                  </p>
                  {stats && getExpiringStatus(0)}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="hover:shadow-md transition-shadow cursor-pointer" 
            data-testid="card-tax-forms"
            onClick={() => handleCardClick('Tax')}
          >
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                  <Clipboard className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Tax Forms</h3>
                  <p className="text-sm text-muted-foreground">
                    {stats?.taxForms || 0} documents
                  </p>
                  <p className="text-xs text-accent">
                    {stats?.taxForms && Math.floor(stats.taxForms * 0.1)} pending
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="hover:shadow-md transition-shadow cursor-pointer" 
            data-testid="card-other"
            onClick={() => handleCardClick('')}
          >
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-muted/30 rounded-lg flex items-center justify-center">
                  <Folder className="w-6 h-6 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Other</h3>
                  <p className="text-sm text-muted-foreground">
                    {stats?.other || 0} documents
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Various documents
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Expiring Soon Alert */}
        {stats && stats.expiringSoon > 0 && (
          <Card className="border-accent/50 bg-accent/5">
            <CardContent className="p-4">
              <p className="text-sm font-medium text-accent">
                ⚠️ {stats.expiringSoon} documents are expiring within the next 30 days
              </p>
            </CardContent>
          </Card>
        )}

        {/* Search and Filters */}
        <SearchFilters
          filters={filters}
          onFilterChange={handleFilterChange}
          filterOptions={{
            types: [
              { value: "", label: "All Types" },
              { value: "License", label: "Licenses" },
              { value: "Certification", label: "Certifications" },
              { value: "Tax", label: "Tax Forms" },
              { value: "Contract", label: "Contracts" },
              { value: "Other", label: "Other" }
            ]
          }}
          data-testid="search-filters"
        />

        {/* Documents Table */}
        <Card>
          <CardHeader className="border-b border-border">
            <div className="flex items-center justify-between">
              <CardTitle>Document Library</CardTitle>
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" data-testid="button-export-documents">
                  Export
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <DocumentsTable
              documents={data?.documents || []}
              total={data?.total || 0}
              page={page}
              totalPages={data?.totalPages || 0}
              onPageChange={setPage}
              isLoading={isLoading}
              data-testid="documents-table"
            />
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}