import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useDocuments, type Document } from "@/hooks/useDocuments";
import { Download, Trash2, FileText, Image as ImageIcon, File as FileIcon, Search, Filter } from "lucide-react";
import { format } from "date-fns";

/**
 * Props for DocumentList component
 */
export interface DocumentListProps {
  employeeId?: number;
  locationId?: number;
  documents?: Document[];
  onDelete?: (id: number) => void;
  onDownload?: (id: number, fileName: string) => void;
  isLoading?: boolean;
}

/**
 * Document table/list component with download and delete actions
 * 
 * @component
 * @param {DocumentListProps} props - Component props
 * @returns {JSX.Element} Document list interface
 * 
 * @example
 * ```tsx
 * <DocumentList 
 *   employeeId={123}
 *   onDelete={(id) => console.log('Delete', id)}
 * />
 * ```
 * 
 * @description
 * - Displays documents in a striped table format
 * - File type icons and badges
 * - Download with presigned URLs
 * - Delete with confirmation dialog
 * - Search and filter capabilities
 * - Sort by name, type, date, or size
 * - Empty state when no documents
 * - Loading skeleton states
 * - Responsive design
 * - All interactive elements have data-testid attributes
 */
export function DocumentList({
  employeeId,
  locationId,
  documents: propDocuments,
  onDelete: propOnDelete,
  onDownload: propOnDownload,
  isLoading: propIsLoading
}: DocumentListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState<'name' | 'type' | 'date' | 'size'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<number | null>(null);

  const {
    documents: hookDocuments,
    isLoading: hookIsLoading,
    deleteDoc,
    download
  } = useDocuments({ employeeId, locationId, enabled: !propDocuments });

  const documents = propDocuments || hookDocuments;
  const isLoading = propIsLoading !== undefined ? propIsLoading : hookIsLoading;

  /**
   * Get file icon based on MIME type
   */
  const getFileIcon = (mimeType: string | null | undefined) => {
    if (!mimeType) {
      return <FileIcon className="w-5 h-5 text-gray-500" />;
    }
    if (mimeType.startsWith('image/')) {
      return <ImageIcon className="w-5 h-5 text-blue-500" />;
    } else if (mimeType.includes('pdf')) {
      return <FileText className="w-5 h-5 text-red-500" />;
    }
    return <FileIcon className="w-5 h-5 text-gray-500" />;
  };

  /**
   * Format file size
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  /**
   * Format date
   */
  const formatDate = (dateString: string): string => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch {
      return 'Invalid date';
    }
  };

  /**
   * Get document type color
   */
  const getTypeColor = (type: string): string => {
    const typeMap: Record<string, string> = {
      'Medical License': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'DEA License': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      'State License': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'Board Certification': 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
      'Contract': 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
      'Tax': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      'Training Certificate': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
      'Compliance Document': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
    };
    return typeMap[type] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
  };

  /**
   * Handle delete click
   */
  const handleDeleteClick = (documentId: number) => {
    setDocumentToDelete(documentId);
    setDeleteDialogOpen(true);
  };

  /**
   * Confirm delete
   */
  const handleDeleteConfirm = async () => {
    if (documentToDelete !== null) {
      if (propOnDelete) {
        propOnDelete(documentToDelete);
      } else {
        await deleteDoc.mutateAsync(documentToDelete);
      }
      setDeleteDialogOpen(false);
      setDocumentToDelete(null);
    }
  };

  /**
   * Handle download
   */
  const handleDownload = (doc: Document) => {
    if (propOnDownload) {
      propOnDownload(doc.id, doc.fileName);
    } else {
      download(doc.id, doc.fileName, doc.mimeType);
    }
  };

  /**
   * Filter and sort documents
   */
  const filteredAndSortedDocuments = documents
    .filter(doc => {
      const matchesSearch = doc.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          doc.documentType.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = filterType === 'all' || doc.documentType === filterType;
      return matchesSearch && matchesType;
    })
    .sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.fileName.localeCompare(b.fileName);
          break;
        case 'type':
          comparison = a.documentType.localeCompare(b.documentType);
          break;
        case 'date':
          comparison = new Date(a.uploadedDate).getTime() - new Date(b.uploadedDate).getTime();
          break;
        case 'size':
          comparison = a.fileSize - b.fileSize;
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  /**
   * Get unique document types for filter
   */
  const documentTypes = Array.from(new Set(documents.map(doc => doc.documentType)));

  /**
   * Toggle sort order
   */
  const toggleSort = (column: 'name' | 'type' | 'date' | 'size') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  return (
    <>
      <Card className="shadow-sm">
        <CardHeader className="border-b">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle className="flex items-center text-lg">
              <FileText className="w-5 h-5 mr-2 text-primary" />
              Documents ({filteredAndSortedDocuments.length})
            </CardTitle>
            
            {/* Search and Filter Controls */}
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-documents"
                />
              </div>
              
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-full sm:w-48" data-testid="select-filter-type">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {documentTypes.map(type => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="w-8 h-8 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                  <Skeleton className="w-20 h-8" />
                </div>
              ))}
            </div>
          ) : filteredAndSortedDocuments.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-16 h-16 mx-auto text-muted-foreground mb-4 opacity-50" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No documents found</h3>
              <p className="text-sm text-muted-foreground">
                {searchQuery || filterType !== 'all' 
                  ? 'Try adjusting your search or filter criteria'
                  : 'Upload documents to get started'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table data-testid="table-documents">
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-12">Type</TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/80"
                      onClick={() => toggleSort('name')}
                      data-testid="th-name"
                    >
                      Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/80"
                      onClick={() => toggleSort('type')}
                      data-testid="th-type"
                    >
                      Type {sortBy === 'type' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/80"
                      onClick={() => toggleSort('size')}
                      data-testid="th-size"
                    >
                      Size {sortBy === 'size' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/80"
                      onClick={() => toggleSort('date')}
                      data-testid="th-date"
                    >
                      Date {sortBy === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedDocuments.map((doc, index) => (
                    <TableRow 
                      key={doc.id} 
                      className={index % 2 === 0 ? '' : 'bg-slate-50 dark:bg-slate-900'}
                      data-testid={`document-row-${doc.id}`}
                    >
                      <TableCell>
                        {getFileIcon(doc.mimeType)}
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="max-w-xs truncate" title={doc.fileName}>
                          {doc.fileName}
                        </div>
                        {doc.notes && (
                          <p className="text-xs text-muted-foreground truncate max-w-xs" title={doc.notes}>
                            {doc.notes}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={getTypeColor(doc.documentType)} variant="secondary">
                          {doc.documentType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatFileSize(doc.fileSize)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(doc.uploadedDate)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(doc)}
                            data-testid={`button-download-${doc.id}`}
                            title="Download document"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(doc.id)}
                            data-testid={`button-delete-${doc.id}`}
                            title="Delete document"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this document? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
