import { useEffect, useState } from "react";
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
import { Plus, Edit, Trash2, DollarSign } from "lucide-react";

const enrollmentSchema = z.object({
  payerName: z.string().min(1, "Payer name is required"),
  status: z.string().optional().default("active"),
  effectiveDate: z.string().optional(),
  terminationDate: z.string().optional(),
  enrollmentId: z.string().optional()
});

type EnrollmentFormData = z.infer<typeof enrollmentSchema>;

interface PayerEnrollmentsManagerProps {
  employeeId: number;
}

export function PayerEnrollmentsManager({ employeeId }: PayerEnrollmentsManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedEnrollment, setSelectedEnrollment] = useState<any>(null);
  const [deleteEnrollment, setDeleteEnrollment] = useState<any>(null);
  const { toast } = useToast();

  const { data, isLoading } = useQuery<any[]>({
    queryKey: ["/api/employees", employeeId, "payer-enrollments"],
    enabled: !!employeeId
  });
  const enrollments = data ?? [];

  const form = useForm<EnrollmentFormData>({
    resolver: zodResolver(enrollmentSchema),
    defaultValues: {
      payerName: "",
      status: "active",
      effectiveDate: "",
      terminationDate: "",
      enrollmentId: "",
    }
  });
  useEffect(() => {
    if (!selectedEnrollment && isDialogOpen) {
      form.reset({
        payerName: "",
        status: "active",
        effectiveDate: "",
        terminationDate: "",
        enrollmentId: "",
      });
    }
  }, [selectedEnrollment, form, isDialogOpen]);

  const createMutation = useMutation({
    mutationFn: async (data: EnrollmentFormData) =>
      await apiRequest(
        "POST",
        `/api/employees/${employeeId}/payer-enrollments`,
        data,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees", employeeId, "payer-enrollments"] });
      toast({ title: "Payer enrollment added successfully" });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Failed to add payer enrollment", variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (data: EnrollmentFormData) =>
      await apiRequest(
        "PUT",
        `/api/payer-enrollments/${selectedEnrollment?.id}`,
        data,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees", employeeId, "payer-enrollments"] });
      toast({ title: "Payer enrollment updated successfully" });
      setIsDialogOpen(false);
      setSelectedEnrollment(null);
      form.reset();
    },
    onError: () => {
      toast({ title: "Failed to update payer enrollment", variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest(
        "DELETE",
        `/api/payer-enrollments/${id}`,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees", employeeId, "payer-enrollments"] });
      toast({ title: "Payer enrollment deleted successfully" });
      setDeleteEnrollment(null);
    },
    onError: () => {
      toast({ title: "Failed to delete payer enrollment", variant: "destructive" });
    }
  });

  const handleSubmit = (data: EnrollmentFormData) => {
    if (selectedEnrollment) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (enrollment: any) => {
    setSelectedEnrollment(enrollment);
    form.reset({
      payerName: enrollment.payerName || "",
      status: enrollment.status || "active",
      effectiveDate: enrollment.effectiveDate || "",
      terminationDate: enrollment.terminationDate || "",
      enrollmentId: enrollment.enrollmentId || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = () => {
    if (deleteEnrollment) {
      deleteMutation.mutate(deleteEnrollment.id);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case 'terminated':
        return <Badge className="bg-red-100 text-red-800">Terminated</Badge>;
      case 'suspended':
        return <Badge className="bg-gray-100 text-gray-800">Suspended</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            <CardTitle>Payer Enrollments</CardTitle>
          </div>
          <Button
            onClick={() => {
              setSelectedEnrollment(null);
              form.reset();
              setIsDialogOpen(true);
            }}
            size="sm"
            data-testid="button-add-enrollment"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Enrollment
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">Loading payer enrollments...</p>
        ) : enrollments.length === 0 ? (
          <p className="text-muted-foreground">No payer enrollments found</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payer Name</TableHead>
                <TableHead>Provider ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Effective Date</TableHead>
                <TableHead>Termination Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {enrollments.map((enrollment: any) => (
                <TableRow key={enrollment.id} data-testid={`row-enrollment-${enrollment.id}`}>
                  <TableCell>{enrollment.payerName}</TableCell>
                  <TableCell>{enrollment.enrollmentId || "-"}</TableCell>
                  <TableCell>{getStatusBadge(enrollment.status || "active")}</TableCell>
                  <TableCell>{enrollment.effectiveDate || "-"}</TableCell>
                  <TableCell>{enrollment.terminationDate || "-"}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(enrollment)}
                      data-testid={`button-edit-enrollment-${enrollment.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteEnrollment(enrollment)}
                      data-testid={`button-delete-enrollment-${enrollment.id}`}
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
              {selectedEnrollment ? "Edit Payer Enrollment" : "Add Payer Enrollment"}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="payerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payer Name *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Blue Cross Blue Shield" data-testid="input-payer-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="enrollmentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Provider ID</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter provider ID" data-testid="input-provider-id" />
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
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                        <SelectItem value="terminated">Terminated</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="effectiveDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Effective Date</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" data-testid="input-effective-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="terminationDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Termination Date</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" data-testid="input-termination-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

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
                    : selectedEnrollment
                    ? "Update"
                    : "Add"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteEnrollment} onOpenChange={() => setDeleteEnrollment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this payer enrollment.
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