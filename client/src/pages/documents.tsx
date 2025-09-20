import { useState } from "react";
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
import type { Document } from "@/lib/types";

interface DocumentsResponse {
  documents: Document[];
  total: number;
  page: number;
  totalPages: number;
}

export default function Documents() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    search: "",
    type: ""
  });
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

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

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const handleUpload = (formData: FormData) => {
    uploadMutation.mutate(formData);
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
          <Card className="hover:shadow-md transition-shadow cursor-pointer" data-testid="card-licenses">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Licenses</h3>
                  <p className="text-sm text-muted-foreground">Medical & DEA</p>
                  <p className="text-xs text-destructive">3 expiring soon</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer" data-testid="card-certifications">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center">
                  <Award className="w-6 h-6 text-secondary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Certifications</h3>
                  <p className="text-sm text-muted-foreground">Board & Training</p>
                  <p className="text-xs text-secondary">All up to date</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer" data-testid="card-tax-forms">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                  <Clipboard className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Tax Forms</h3>
                  <p className="text-sm text-muted-foreground">I-9, W-4</p>
                  <p className="text-xs text-accent">5 pending</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer" data-testid="card-other">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-muted/30 rounded-lg flex items-center justify-center">
                  <Folder className="w-6 h-6 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Other</h3>
                  <p className="text-sm text-muted-foreground">Misc Documents</p>
                  <p className="text-xs text-muted-foreground">12 files</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <SearchFilters
          filters={filters}
          onFilterChange={handleFilterChange}
          filterOptions={{
            types: [
              { value: "", label: "All Types" },
              { value: "Medical License", label: "Medical License" },
              { value: "DEA License", label: "DEA License" },
              { value: "Board Certification", label: "Certification" },
              { value: "I-9 Form", label: "I-9 Form" },
              { value: "W-4 Form", label: "W-4 Form" }
            ]
          }}
          data-testid="search-filters"
        />

        {/* Documents Table */}
        <Card>
          <CardHeader className="border-b border-border">
            <div className="flex items-center justify-between">
              <CardTitle>Recent Documents</CardTitle>
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
