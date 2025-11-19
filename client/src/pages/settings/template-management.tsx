import React from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { RequiredDocumentType } from '@shared/schema';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { insertRequiredDocumentTypeSchema, InsertRequiredDocumentType } from '@shared/schema';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableHeader, TableBody, TableRow, TableCell, TableHead } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Edit, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { apiRequest } from '@/lib/queryClient';
import { queryClient } from '@/lib/queryClient';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

export default function TemplateManagement() {
    const { user } = useAuth();
    const { toast } = useToast();
    const isAdmin = user?.role === 'admin';
    const [documentTypeDialogOpen, setDocumentTypeDialogOpen] = useState(false);
    const [editingDocumentType, setEditingDocumentType] = useState<RequiredDocumentType | null>(null);
    const [deleteDocumentTypeId, setDeleteDocumentTypeId] = useState<number | null>(null);
    
    const getCategoryBadgeColor = (category: string) => {
        switch (category) {
          case "tax": return "bg-blue-500";
          case "compliance": return "bg-green-500";
          case "payroll": return "bg-yellow-500";
          case "identification": return "bg-purple-500";
          default: return "bg-gray-500";
        }
      };
        // Required Document Types Query (Admin only)
        const { data: requiredDocuments = [], isLoading: requiredDocumentsLoading } = useQuery<RequiredDocumentType[]>({
            queryKey: ["/api/admin/required-documents"],
            enabled: isAdmin
        });
       // Required Document Types Mutations
  const createDocumentTypeMutation = useMutation({
    mutationFn: (data: InsertRequiredDocumentType) =>
      apiRequest("POST", "/api/admin/required-documents", data),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Document type created successfully"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/required-documents"] });
      setDocumentTypeDialogOpen(false);
      setEditingDocumentType(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const updateDocumentTypeMutation = useMutation({
    mutationFn: ({ id, ...data }: RequiredDocumentType) =>
      apiRequest("PUT", `/api/admin/required-documents/${id}`, data),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Document type updated successfully"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/required-documents"] });
      setDocumentTypeDialogOpen(false);
      setEditingDocumentType(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const deleteDocumentTypeMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `/api/admin/required-documents/${id}`),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Document type deleted successfully"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/required-documents"] });
      setDeleteDocumentTypeId(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const reorderDocumentTypeMutation = useMutation({
    mutationFn: ({ id, sortOrder }: { id: number; sortOrder: number }) =>
      apiRequest("PUT", `/api/admin/required-documents/${id}`, { sortOrder }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/required-documents"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to reorder document type",
        variant: "destructive"
      });
    }
  });


    const handleMoveDocumentType = (id: number, direction: "up" | "down") => {
        const sortedDocs = [...requiredDocuments].sort((a, b) => a.sortOrder - b.sortOrder);
        const currentIndex = sortedDocs.findIndex(doc => doc.id === id);
        const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    
        if (targetIndex >= 0 && targetIndex < sortedDocs.length) {
          const currentDoc = sortedDocs[currentIndex];
          const targetDoc = sortedDocs[targetIndex];
    
          // Swap sort orders
          reorderDocumentTypeMutation.mutate({ id: currentDoc.id, sortOrder: targetDoc.sortOrder });
          reorderDocumentTypeMutation.mutate({ id: targetDoc.id, sortOrder: currentDoc.sortOrder });
        }
      };
    
      const documentTypeForm = useForm<InsertRequiredDocumentType>({
        resolver: zodResolver(insertRequiredDocumentTypeSchema),
        defaultValues: {
          name: "",
          description: "",
          category: "tax",
          isRequired: true,
          sortOrder: 0
        }
      });
    
      const onSubmitDocumentType = (data: InsertRequiredDocumentType) => {
        if (editingDocumentType) {
          updateDocumentTypeMutation.mutate({ ...editingDocumentType, ...data });
        } else {
          createDocumentTypeMutation.mutate(data);
        }
      };
    
      const handleEditDocumentType = (doc: RequiredDocumentType) => {
        setEditingDocumentType(doc);
        documentTypeForm.reset({
          name: doc.name,
          description: doc.description || "",
          category: doc.category as "tax" | "compliance" | "payroll" | "identification" | "other",
          isRequired: doc.isRequired,
          sortOrder: doc.sortOrder
        });
        setDocumentTypeDialogOpen(true);
      };

    const handleAddDocumentType = () => {
        setEditingDocumentType(null);   
        documentTypeForm.reset({
          name: "",
          description: "",
          category: "tax",
          isRequired: true,
          sortOrder: requiredDocuments.length > 0 ? Math.max(...requiredDocuments.map(d => d.sortOrder)) + 1 : 0
        });
        setDocumentTypeDialogOpen(true);
      };

    return (
        <MainLayout>
             {/* Required Documents Configuration - Admin Only */}
        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <FileText className="w-5 h-5 mr-2" />
                  Required Documents Configuration
                </div>
                <Button
                  onClick={handleAddDocumentType}
                  size="sm"
                  data-testid="button-add-document-type"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Document Type
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {requiredDocumentsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center space-x-4">
                      <Skeleton className="h-12 flex-1" />
                    </div>
                  ))}
                </div>
              ) : requiredDocuments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No document types configured yet.</p>
                  <p className="text-sm mt-2">Click "Add Document Type" to get started.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">Order</TableHead>
                        <TableHead>Document Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-center">Required</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...requiredDocuments].sort((a, b) => a.sortOrder - b.sortOrder).map((doc, index) => (
                        <TableRow key={doc.id}>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleMoveDocumentType(doc.id, "up")}
                                disabled={index === 0}
                              >
                                <ChevronUp className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleMoveDocumentType(doc.id, "down")}
                                disabled={index === requiredDocuments.length - 1}
                              >
                                <ChevronDown className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{doc.name}</TableCell>
                          <TableCell>
                            <Badge className={getCategoryBadgeColor(doc.category)}>
                              {doc.category.charAt(0).toUpperCase() + doc.category.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {doc.description || <span className="text-muted-foreground">No description</span>}
                          </TableCell>
                          <TableCell className="text-center">
                            {doc.isRequired ? (
                              <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />
                            ) : (
                              <XCircle className="w-5 h-5 text-gray-400 mx-auto" />
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditDocumentType(doc)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteDocumentTypeId(doc.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
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
        )}

        {/* Document Type Dialog */}
        <Dialog open={documentTypeDialogOpen} onOpenChange={(open) => {
          if (!open) {
            setEditingDocumentType(null);
            documentTypeForm.reset();
          }
          setDocumentTypeDialogOpen(open);
        }}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {editingDocumentType ? "Edit Document Type" : "Add Document Type"}
              </DialogTitle>
            </DialogHeader>
            <Form {...documentTypeForm}>
              <form onSubmit={documentTypeForm.handleSubmit(onSubmitDocumentType)} className="space-y-4">
                <FormField
                  control={documentTypeForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Document Name *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="e.g., W-4 Form"
                          data-testid="input-document-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={documentTypeForm.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-document-category">
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="tax">Tax</SelectItem>
                          <SelectItem value="compliance">Compliance</SelectItem>
                          <SelectItem value="payroll">Payroll</SelectItem>
                          <SelectItem value="identification">Identification</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={documentTypeForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          value={field.value || ""}
                          placeholder="Describe the purpose of this document..."
                          className="resize-none"
                          rows={3}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={documentTypeForm.control}
                  name="isRequired"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          Required Document
                        </FormLabel>
                        <FormDescription>
                          Is this document mandatory for all employees?
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-is-required"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={documentTypeForm.control}
                  name="sortOrder"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sort Order</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>
                        Lower numbers appear first in the list
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDocumentTypeDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createDocumentTypeMutation.isPending || updateDocumentTypeMutation.isPending}
                  >
                    {createDocumentTypeMutation.isPending || updateDocumentTypeMutation.isPending ? (
                      "Saving..."
                    ) : editingDocumentType ? (
                      "Update"
                    ) : (
                      "Create"
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDocumentTypeId !== null} onOpenChange={(open) => !open && setDeleteDocumentTypeId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Document Type</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this document type? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deleteDocumentTypeId) {
                    deleteDocumentTypeMutation.mutate(deleteDocumentTypeId);
                  }
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        </MainLayout>
    )

}