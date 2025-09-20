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
import { Plus, Edit, Trash2, Briefcase } from "lucide-react";

const employmentSchema = z.object({
  employer: z.string().optional(),
  position: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  description: z.string().optional()
});

type EmploymentFormData = z.infer<typeof employmentSchema>;

interface EmploymentsManagerProps {
  employeeId: number;
}

export function EmploymentsManager({ employeeId }: EmploymentsManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedEmployment, setSelectedEmployment] = useState<any>(null);
  const [deleteEmployment, setDeleteEmployment] = useState<any>(null);
  const { toast } = useToast();

  const { data: employments = [], isLoading } = useQuery({
    queryKey: ["/api/employees", employeeId, "employments"],
    enabled: !!employeeId
  });

  const form = useForm<EmploymentFormData>({
    resolver: zodResolver(employmentSchema),
    defaultValues: {
      employer: "",
      position: "",
      startDate: "",
      endDate: "",
      description: ""
    }
  });

  const createMutation = useMutation({
    mutationFn: (data: EmploymentFormData) =>
      apiRequest(`/api/employees/${employeeId}/employments`, {
        method: "POST",
        body: JSON.stringify(data)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees", employeeId, "employments"] });
      toast({ title: "Employment added successfully" });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Failed to add employment", variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data: EmploymentFormData) =>
      apiRequest(`/api/employments/${selectedEmployment?.id}`, {
        method: "PUT",
        body: JSON.stringify(data)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees", employeeId, "employments"] });
      toast({ title: "Employment updated successfully" });
      setIsDialogOpen(false);
      setSelectedEmployment(null);
      form.reset();
    },
    onError: () => {
      toast({ title: "Failed to update employment", variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/api/employments/${id}`, {
        method: "DELETE"
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees", employeeId, "employments"] });
      toast({ title: "Employment deleted successfully" });
      setDeleteEmployment(null);
    },
    onError: () => {
      toast({ title: "Failed to delete employment", variant: "destructive" });
    }
  });

  const handleSubmit = (data: EmploymentFormData) => {
    if (selectedEmployment) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (employment: any) => {
    setSelectedEmployment(employment);
    form.reset({
      employer: employment.employer || "",
      position: employment.position || "",
      startDate: employment.startDate || "",
      endDate: employment.endDate || "",
      description: employment.description || ""
    });
    setIsDialogOpen(true);
  };

  const handleDelete = () => {
    if (deleteEmployment) {
      deleteMutation.mutate(deleteEmployment.id);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            <CardTitle>Employment History</CardTitle>
          </div>
          <Button
            onClick={() => {
              setSelectedEmployment(null);
              form.reset();
              setIsDialogOpen(true);
            }}
            size="sm"
            data-testid="button-add-employment"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Employment
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">Loading employment history...</p>
        ) : employments.length === 0 ? (
          <p className="text-muted-foreground">No employment records found</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employer</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employments.map((employment: any) => (
                <TableRow key={employment.id} data-testid={`row-employment-${employment.id}`}>
                  <TableCell>{employment.employer || "-"}</TableCell>
                  <TableCell>{employment.position || "-"}</TableCell>
                  <TableCell>{employment.startDate || "-"}</TableCell>
                  <TableCell>{employment.endDate || "-"}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(employment)}
                      data-testid={`button-edit-employment-${employment.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteEmployment(employment)}
                      data-testid={`button-delete-employment-${employment.id}`}
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
              {selectedEmployment ? "Edit Employment" : "Add Employment"}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="employer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employer</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter employer name" data-testid="input-employer" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="position"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Position</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter position" data-testid="input-position" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" data-testid="input-start-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" data-testid="input-end-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="Enter job description" 
                        data-testid="input-description"
                        rows={4}
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
                    : selectedEmployment
                    ? "Update"
                    : "Add"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteEmployment} onOpenChange={() => setDeleteEmployment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this employment record.
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