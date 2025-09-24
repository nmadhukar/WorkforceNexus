import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertComplianceDocumentSchema, type ComplianceDocument, type InsertComplianceDocument, type ClinicLicense, type Location } from "@shared/schema";
import { FileText, Upload, Download, Eye, Trash2, Clock, AlertTriangle, CheckCircle, Calendar, FileUp, Files, Search, Filter, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, differenceInDays } from "date-fns";

interface ComplianceDocumentsResponse {
  documents: ComplianceDocument[];
  total: number;
  page: number;
  totalPages: number;
}

interface DocumentStats {
  total: number;
  sops: number;
  renewalGuides: number;
  certificates: number;
  reports: number;
  expiring: number;
  verified: number;
}

export default function ComplianceDocumentsPage() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [licenseFilter, setLicenseFilter] = useState<string>("");
  const [locationFilter, setLocationFilter] = useState<string>("");
  const [selectedDocument, setSelectedDocument] = useState<ComplianceDocument | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Get location/license ID from URL params if present
  const urlParams = new URLSearchParams(window.location.search);
  const locationIdParam = urlParams.get('locationId');
  const licenseIdParam = urlParams.get('licenseId');

  // Fetch documents
  const { data, isLoading, error } = useQuery<ComplianceDocumentsResponse>({
    queryKey: ["/api/compliance-documents", page, searchQuery, typeFilter, licenseFilter || licenseIdParam, locationFilter || locationIdParam],
    queryFn: async ({ queryKey }) => {
      const [url, currentPage, search, type, license, location] = queryKey;
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: "10",
        ...(search && { search: String(search) }),
        ...(type && { type: String(type) }),
        ...(license && { licenseId: String(license) }),
        ...(location && { locationId: String(location) })
      });
      
      const res = await fetch(`${url}?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch documents');
      return res.json();
    }
  });

  // Fetch document stats
  const { data: stats } = useQuery<DocumentStats>({
    queryKey: ["/api/compliance-documents/stats"]
  });

  // Fetch licenses for dropdown
  const { data: licensesData } = useQuery<{ licenses: ClinicLicense[] }>({
    queryKey: ["/api/clinic-licenses", { limit: 100 }]
  });

  // Fetch locations for dropdown
  const { data: locationsData } = useQuery<{ locations: Location[] }>({
    queryKey: ["/api/locations", { limit: 100 }]
  });

  // Form setup for document metadata
  const form = useForm<InsertComplianceDocument>({
    resolver: zodResolver(insertComplianceDocumentSchema),
    defaultValues: {
      clinicLicenseId: parseInt(licenseIdParam || "0") || 0,
      locationId: parseInt(locationIdParam || "0") || undefined,
      documentType: "other",
      documentName: "",
      documentNumber: "",
      effectiveDate: new Date().toISOString().split('T')[0],
      expirationDate: undefined,
      isRequired: false,
      complianceCategory: "",
      notes: ""
    }
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      setIsUploading(true);
      const res = await fetch("/api/compliance-documents/upload", {
        method: "POST",
        body: formData,
        credentials: "include"
      });
      
      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || 'Upload failed');
      }
      
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Document uploaded successfully"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/compliance-documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/compliance-documents/stats"] });
      setUploadDialogOpen(false);
      setUploadFile(null);
      setIsUploading(false);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
      setIsUploading(false);
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/compliance-documents/${id}`, {}),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Document deleted successfully"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/compliance-documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/compliance-documents/stats"] });
      setDeleteId(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Verify document mutation
  const verifyMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/compliance-documents/${id}/verify`, {}),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Document verified successfully"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/compliance-documents"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Handle file drop
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      setUploadFile(files[0]);
      // Pre-fill form with file name
      form.setValue('documentName', files[0].name.replace(/\.[^/.]+$/, "")); 
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setUploadFile(files[0]);
      form.setValue('documentName', files[0].name.replace(/\.[^/.]+$/, ""));
    }
  };

  // Handle form submission
  const handleUpload = async (data: InsertComplianceDocument) => {
    if (!uploadFile) {
      toast({
        title: "Error",
        description: "Please select a file to upload",
        variant: "destructive"
      });
      return;
    }

    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('clinicLicenseId', data.clinicLicenseId.toString());
    if (data.locationId) formData.append('locationId', data.locationId.toString());
    formData.append('documentType', data.documentType);
    formData.append('documentName', data.documentName);
    if (data.documentNumber) formData.append('documentNumber', data.documentNumber);
    if (data.effectiveDate) formData.append('effectiveDate', data.effectiveDate);
    if (data.expirationDate) formData.append('expirationDate', data.expirationDate);
    formData.append('isRequired', data.isRequired.toString());
    if (data.complianceCategory) formData.append('complianceCategory', data.complianceCategory);
    if (data.notes) formData.append('notes', data.notes);

    uploadMutation.mutate(formData);
  };

  // Get download URL for document
  const handleDownload = async (document: ComplianceDocument) => {
    try {
      const res = await fetch(`/api/compliance-documents/${document.id}/download`, {
        credentials: "include"
      });
      
      if (!res.ok) throw new Error('Failed to get download URL');
      
      const { downloadUrl } = await res.json();
      window.open(downloadUrl, '_blank');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download document",
        variant: "destructive"
      });
    }
  };

  const getDocumentTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      license_certificate: "bg-blue-500 hover:bg-blue-600",
      renewal_application: "bg-purple-500 hover:bg-purple-600",
      inspection_report: "bg-orange-500 hover:bg-orange-600",
      sop: "bg-green-500 hover:bg-green-600",
      policy: "bg-indigo-500 hover:bg-indigo-600",
      other: "bg-gray-500 hover:bg-gray-600"
    };
    
    return (
      <Badge className={cn("capitalize text-white text-xs", colors[type] || colors.other)}>
        {type.replace(/_/g, ' ')}
      </Badge>
    );
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
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
            <h1 className="text-3xl font-bold text-foreground" data-testid="text-compliance-documents-title">Compliance Documents</h1>
            <p className="text-muted-foreground">Manage compliance-related documents and certificates</p>
          </div>
          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => {
                  setUploadFile(null);
                  form.reset();
                }}
                data-testid="button-upload-document"
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload Document
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Upload Compliance Document</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleUpload)} className="space-y-6">
                  {/* File Upload Area */}
                  <div
                    className={cn(
                      "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
                      isDragging ? "border-primary bg-primary/10" : "border-muted-foreground/25",
                      uploadFile && "bg-muted"
                    )}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                  >
                    {uploadFile ? (
                      <div className="space-y-2">
                        <FileText className="h-12 w-12 mx-auto text-primary" />
                        <p className="font-medium">{uploadFile.name}</p>
                        <p className="text-sm text-muted-foreground">{formatFileSize(uploadFile.size)}</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setUploadFile(null)}
                          data-testid="button-remove-file"
                        >
                          Remove File
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <FileUp className="h-12 w-12 mx-auto text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">Drop your file here, or</p>
                          <label htmlFor="file-upload" className="cursor-pointer">
                            <span className="text-primary hover:underline">browse</span>
                            <input
                              id="file-upload"
                              type="file"
                              className="hidden"
                              onChange={handleFileSelect}
                              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                              data-testid="input-file-upload"
                            />
                          </label>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Supports PDF, Word, Excel, and image files
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Document Metadata Fields */}
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="clinicLicenseId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Related License *</FormLabel>
                          <Select 
                            onValueChange={(value) => field.onChange(parseInt(value))} 
                            value={field.value?.toString()}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-license">
                                <SelectValue placeholder="Select license" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {licensesData?.licenses.map((license) => (
                                <SelectItem key={license.id} value={license.id.toString()}>
                                  {license.licenseNumber}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="locationId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Location (Optional)</FormLabel>
                          <Select 
                            onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)} 
                            value={field.value?.toString() || ""}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-location">
                                <SelectValue placeholder="Select location" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="">None</SelectItem>
                              {locationsData?.locations.map((location) => (
                                <SelectItem key={location.id} value={location.id.toString()}>
                                  {location.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="documentName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Document Name *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="2024 Medical License Certificate" data-testid="input-document-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="documentType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Document Type *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-document-type">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="license_certificate">License Certificate</SelectItem>
                              <SelectItem value="renewal_application">Renewal Application</SelectItem>
                              <SelectItem value="inspection_report">Inspection Report</SelectItem>
                              <SelectItem value="sop">Standard Operating Procedure</SelectItem>
                              <SelectItem value="policy">Policy Document</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="documentNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Document Number</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} placeholder="DOC-2024-001" data-testid="input-document-number" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="effectiveDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Effective Date</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="date"
                              value={field.value || ""}
                              data-testid="input-effective-date"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="expirationDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Expiration Date</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="date"
                              value={field.value || ""}
                              data-testid="input-expiration-date"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="complianceCategory"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Compliance Category</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            value={field.value || ""}
                            placeholder="State Requirements, Federal Compliance, etc."
                            data-testid="input-compliance-category"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="isRequired"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2">
                        <FormControl>
                          <input
                            type="checkbox"
                            checked={field.value}
                            onChange={field.onChange}
                            className="h-4 w-4"
                            data-testid="checkbox-is-required"
                          />
                        </FormControl>
                        <FormLabel className="!mt-0">Required for compliance</FormLabel>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            value={field.value || ""}
                            placeholder="Additional notes about this document..."
                            rows={3}
                            data-testid="textarea-notes"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setUploadDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={!uploadFile || isUploading}
                      data-testid="button-submit-upload"
                    >
                      {isUploading ? 'Uploading...' : 'Upload Document'}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="text-xl font-bold">{stats.total}</p>
                  </div>
                  <Files className="h-6 w-6 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">SOPs</p>
                    <p className="text-xl font-bold">{stats.sops}</p>
                  </div>
                  <FileText className="h-6 w-6 text-green-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Guides</p>
                    <p className="text-xl font-bold">{stats.renewalGuides}</p>
                  </div>
                  <FileText className="h-6 w-6 text-purple-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Certificates</p>
                    <p className="text-xl font-bold">{stats.certificates}</p>
                  </div>
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Reports</p>
                    <p className="text-xl font-bold">{stats.reports}</p>
                  </div>
                  <FileText className="h-6 w-6 text-orange-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Expiring</p>
                    <p className="text-xl font-bold text-yellow-600">{stats.expiring}</p>
                  </div>
                  <AlertTriangle className="h-6 w-6 text-yellow-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Verified</p>
                    <p className="text-xl font-bold text-green-600">{stats.verified}</p>
                  </div>
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search documents..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-documents"
                  />
                </div>
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[200px]" data-testid="select-filter-type">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Types</SelectItem>
                  <SelectItem value="license_certificate">License Certificate</SelectItem>
                  <SelectItem value="renewal_application">Renewal Application</SelectItem>
                  <SelectItem value="inspection_report">Inspection Report</SelectItem>
                  <SelectItem value="sop">SOP</SelectItem>
                  <SelectItem value="policy">Policy</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <Select value={licenseFilter} onValueChange={setLicenseFilter}>
                <SelectTrigger className="w-[200px]" data-testid="select-filter-license">
                  <SelectValue placeholder="All Licenses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Licenses</SelectItem>
                  {licensesData?.licenses.map((license) => (
                    <SelectItem key={license.id} value={license.id.toString()}>
                      {license.licenseNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger className="w-[200px]" data-testid="select-filter-location">
                  <SelectValue placeholder="All Locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Locations</SelectItem>
                  {locationsData?.locations.map((location) => (
                    <SelectItem key={location.id} value={location.id.toString()}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Documents Table */}
        <Card>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>License</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Effective Date</TableHead>
                    <TableHead>Expiration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={9}>
                        <div className="space-y-3">
                          {[...Array(5)].map((_, i) => (
                            <Skeleton key={i} className="h-12 w-full" />
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : data?.documents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-12">
                        <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground mb-4">No documents found</p>
                        <Button
                          onClick={() => {
                            setUploadFile(null);
                            form.reset();
                            setUploadDialogOpen(true);
                          }}
                          data-testid="button-upload-first-document"
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Upload Your First Document
                        </Button>
                      </TableCell>
                    </TableRow>
                  ) : (
                    data?.documents.map((document) => {
                      const license = licensesData?.licenses.find(l => l.id === document.clinicLicenseId);
                      const location = locationsData?.locations.find(l => l.id === document.locationId);
                      const daysUntilExpiration = document.expirationDate ? differenceInDays(new Date(document.expirationDate), new Date()) : null;
                      
                      return (
                        <TableRow key={document.id} data-testid={`document-row-${document.id}`}>
                          <TableCell className="font-medium">
                            <div className="flex items-center space-x-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <span>{document.documentName}</span>
                            </div>
                            {document.documentNumber && (
                              <div className="text-xs text-muted-foreground mt-1">
                                #{document.documentNumber}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>{getDocumentTypeBadge(document.documentType)}</TableCell>
                          <TableCell>
                            {license ? (
                              <span className="text-sm">{license.licenseNumber}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {location ? (
                              <span className="text-sm">{location.name}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {document.effectiveDate ? (
                              <span className="text-sm">
                                {format(new Date(document.effectiveDate), 'MMM dd, yyyy')}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {document.expirationDate ? (
                              <div className="space-y-1">
                                <div className="text-sm">
                                  {format(new Date(document.expirationDate), 'MMM dd, yyyy')}
                                </div>
                                {daysUntilExpiration !== null && daysUntilExpiration <= 90 && daysUntilExpiration > 0 && (
                                  <div className="text-xs text-yellow-600 font-medium">
                                    {daysUntilExpiration} days remaining
                                  </div>
                                )}
                                {daysUntilExpiration !== null && daysUntilExpiration <= 0 && (
                                  <div className="text-xs text-red-600 font-medium">
                                    Expired
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {document.isVerified ? (
                                <Badge className="bg-green-500 hover:bg-green-600 text-white text-xs">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Verified
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs">
                                  Unverified
                                </Badge>
                              )}
                              {document.isRequired && (
                                <Badge variant="outline" className="text-xs">
                                  Required
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatFileSize(document.fileSize)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDownload(document)}
                                data-testid={`download-document-${document.id}`}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              {!document.isVerified && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => verifyMutation.mutate(document.id)}
                                  data-testid={`verify-document-${document.id}`}
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                              )}
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setDeleteId(document.id)}
                                    data-testid={`delete-document-${document.id}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Document</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete this document? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteId && deleteMutation.mutate(deleteId)}
                                      className="bg-destructive text-destructive-foreground"
                                      data-testid="confirm-delete-document"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {data && data.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Showing {(page - 1) * 10 + 1} to {Math.min(page * 10, data.total)} of {data.total} documents
                </p>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm">
                    Page {page} of {data.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                    disabled={page === data.totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}