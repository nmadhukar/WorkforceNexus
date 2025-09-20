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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Edit, Trash2, FileText } from "lucide-react";

const taxFormSchema = z.object({
  formType: z.string().min(1, "Form type is required"),
  year: z.coerce.number().min(1900).max(2100),
  status: z.string().optional()
});

type TaxFormData = z.infer<typeof taxFormSchema>;

interface TaxFormsManagerProps {
  employeeId: number;
}

export function TaxFormsManager({ employeeId }: TaxFormsManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedForm, setSelectedForm] = useState<any>(null);
  const [deleteForm, setDeleteForm] = useState<any>(null);
  const { toast } = useToast();

  const { data: taxForms = [], isLoading } = useQuery({
    queryKey: ["/api/employees", employeeId, "tax-forms"],
    enabled: !!employeeId
  });

  const form = useForm<TaxFormData>({
    resolver: zodResolver(taxFormSchema),
    defaultValues: {
      formType: "",
      year: new Date().getFullYear(),
      status: "pending"
    }
  });

  const createMutation = useMutation({
    mutationFn: (data: TaxFormData) =>
      apiRequest(`/api/employees/${employeeId}/tax-forms`, {
        method: "POST",
        body: JSON.stringify(data)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees", employeeId, "tax-forms"] });
      toast({ title: "Tax form added successfully" });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Failed to add tax form", variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data: TaxFormData) =>
      apiRequest(`/api/tax-forms/${selectedForm?.id}`, {
        method: "PUT",
        body: JSON.stringify(data)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees", employeeId, "tax-forms"] });
      toast({ title: "Tax form updated successfully" });
      setIsDialogOpen(false);
      setSelectedForm(null);
      form.reset();
    },
    onError: () => {
      toast({ title: "Failed to update tax form", variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/api/tax-forms/${id}`, {
        method: "DELETE"
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees", employeeId, "tax-forms"] });
      toast({ title: "Tax form deleted successfully" });
      setDeleteForm(null);
    },
    onError: () => {
      toast({ title: "Failed to delete tax form", variant: "destructive" });
    }
  });

  const handleSubmit = (data: TaxFormData) => {
    if (selectedForm) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (taxForm: any) => {
    setSelectedForm(taxForm);
    form.reset({
      formType: taxForm.formType,
      year: taxForm.year,
      status: taxForm.status || "pending"
    });
    setIsDialogOpen(true);
  };

  const handleDelete = () => {
    if (deleteForm) {
      deleteMutation.mutate(deleteForm.id);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case 'filed':
        return <Badge className="bg-blue-100 text-blue-800">Filed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            <CardTitle>Tax Forms</CardTitle>
          </div>
          <Button
            onClick={() => {
              setSelectedForm(null);
              form.reset();
              setIsDialogOpen(true);
            }}
            size="sm"
            data-testid="button-add-tax-form"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Tax Form
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">Loading tax forms...</p>
        ) : taxForms.length === 0 ? (
          <p className="text-muted-foreground">No tax forms found</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Form Type</TableHead>
                <TableHead>Year</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {taxForms.map((taxForm: any) => (
                <TableRow key={taxForm.id} data-testid={`row-tax-form-${taxForm.id}`}>
                  <TableCell>{taxForm.formType}</TableCell>
                  <TableCell>{taxForm.year}</TableCell>
                  <TableCell>{getStatusBadge(taxForm.status || "pending")}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(taxForm)}
                      data-testid={`button-edit-tax-form-${taxForm.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteForm(taxForm)}
                      data-testid={`button-delete-tax-form-${taxForm.id}`}
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
              {selectedForm ? "Edit Tax Form" : "Add Tax Form"}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="formType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Form Type *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-form-type">
                          <SelectValue placeholder="Select form type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="W-2">W-2</SelectItem>
                        <SelectItem value="W-4">W-4</SelectItem>
                        <SelectItem value="W-9">W-9</SelectItem>
                        <SelectItem value="1099">1099</SelectItem>
                        <SelectItem value="I-9">I-9</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="year"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Year *</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="number" 
                        placeholder="Enter year" 
                        min={1900}
                        max={2100}
                        data-testid="input-year" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-status">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="filed">Filed</SelectItem>
                      </SelectContent>
                    </Select>
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
                    : selectedForm
                    ? "Update"
                    : "Add"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteForm} onOpenChange={() => setDeleteForm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this tax form record.
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