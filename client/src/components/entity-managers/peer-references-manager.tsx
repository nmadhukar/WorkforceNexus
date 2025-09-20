import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Edit, Trash2, Users } from "lucide-react";

const referenceSchema = z.object({
  referenceName: z.string().optional(),
  contactInfo: z.string().optional(),
  relationship: z.string().optional(),
  comments: z.string().optional()
});

type ReferenceFormData = z.infer<typeof referenceSchema>;

interface PeerReferencesManagerProps {
  employeeId: number;
}

export function PeerReferencesManager({ employeeId }: PeerReferencesManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedReference, setSelectedReference] = useState<any>(null);
  const [deleteReference, setDeleteReference] = useState<any>(null);
  const { toast } = useToast();

  const { data: references = [], isLoading } = useQuery({
    queryKey: ["/api/employees", employeeId, "peer-references"],
    enabled: !!employeeId
  });

  const form = useForm<ReferenceFormData>({
    resolver: zodResolver(referenceSchema),
    defaultValues: {
      referenceName: "",
      contactInfo: "",
      relationship: "",
      comments: ""
    }
  });

  const createMutation = useMutation({
    mutationFn: (data: ReferenceFormData) =>
      apiRequest(`/api/employees/${employeeId}/peer-references`, {
        method: "POST",
        body: JSON.stringify(data)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees", employeeId, "peer-references"] });
      toast({ title: "Reference added successfully" });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Failed to add reference", variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data: ReferenceFormData) =>
      apiRequest(`/api/peer-references/${selectedReference?.id}`, {
        method: "PUT",
        body: JSON.stringify(data)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees", employeeId, "peer-references"] });
      toast({ title: "Reference updated successfully" });
      setIsDialogOpen(false);
      setSelectedReference(null);
      form.reset();
    },
    onError: () => {
      toast({ title: "Failed to update reference", variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/api/peer-references/${id}`, {
        method: "DELETE"
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees", employeeId, "peer-references"] });
      toast({ title: "Reference deleted successfully" });
      setDeleteReference(null);
    },
    onError: () => {
      toast({ title: "Failed to delete reference", variant: "destructive" });
    }
  });

  const handleSubmit = (data: ReferenceFormData) => {
    if (selectedReference) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (reference: any) => {
    setSelectedReference(reference);
    form.reset({
      referenceName: reference.referenceName || "",
      contactInfo: reference.contactInfo || "",
      relationship: reference.relationship || "",
      comments: reference.comments || ""
    });
    setIsDialogOpen(true);
  };

  const handleDelete = () => {
    if (deleteReference) {
      deleteMutation.mutate(deleteReference.id);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <CardTitle>Peer References</CardTitle>
          </div>
          <Button
            onClick={() => {
              setSelectedReference(null);
              form.reset();
              setIsDialogOpen(true);
            }}
            size="sm"
            data-testid="button-add-reference"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Reference
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">Loading references...</p>
        ) : references.length === 0 ? (
          <p className="text-muted-foreground">No peer references found</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact Info</TableHead>
                <TableHead>Relationship</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {references.map((reference: any) => (
                <TableRow key={reference.id} data-testid={`row-reference-${reference.id}`}>
                  <TableCell>{reference.referenceName || "-"}</TableCell>
                  <TableCell>{reference.contactInfo || "-"}</TableCell>
                  <TableCell>{reference.relationship || "-"}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(reference)}
                      data-testid={`button-edit-reference-${reference.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteReference(reference)}
                      data-testid={`button-delete-reference-${reference.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedReference ? "Edit Reference" : "Add Reference"}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="referenceName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reference Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter reference name" data-testid="input-reference-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contactInfo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Information</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter phone or email" data-testid="input-contact-info" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="relationship"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Relationship</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Colleague, Supervisor" data-testid="input-relationship" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="comments"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Comments</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="Additional comments" 
                        data-testid="input-comments"
                        rows={3}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-submit"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? "Saving..."
                    : selectedReference
                    ? "Update"
                    : "Add"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteReference} onOpenChange={() => setDeleteReference(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this reference.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}