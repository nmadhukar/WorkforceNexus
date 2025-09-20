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
import { Plus, Edit, Trash2, Shield, FileText } from "lucide-react";

const licenseSchema = z.object({
  licenseNumber: z.string().min(1, "License number is required"),
  state: z.string().optional(),
  issueDate: z.string().optional(),
  expirationDate: z.string().optional(),
  status: z.string().optional()
});

type LicenseFormData = z.infer<typeof licenseSchema>;

interface LicensesManagerProps {
  employeeId: number;
  type: "state" | "dea";
}

export function LicensesManager({ employeeId, type }: LicensesManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedLicense, setSelectedLicense] = useState<any>(null);
  const [deleteLicense, setDeleteLicense] = useState<any>(null);
  const { toast } = useToast();

  const endpoint = type === "state" ? "state-licenses" : "dea-licenses";
  const title = type === "state" ? "State Licenses" : "DEA Licenses";
  const icon = type === "state" ? <FileText className="h-5 w-5" /> : <Shield className="h-5 w-5" />;

  const { data: licenses = [], isLoading } = useQuery({
    queryKey: ["/api/employees", employeeId, endpoint],
    enabled: !!employeeId
  });

  const form = useForm<LicenseFormData>({
    resolver: zodResolver(licenseSchema),
    defaultValues: {
      licenseNumber: "",
      state: "",
      issueDate: "",
      expirationDate: "",
      status: "active"
    }
  });

  const createMutation = useMutation({
    mutationFn: (data: LicenseFormData) =>
      apiRequest(`/api/employees/${employeeId}/${endpoint}`, {
        method: "POST",
        body: JSON.stringify(data)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees", employeeId, endpoint] });
      toast({ title: `${type.toUpperCase()} license added successfully` });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ title: `Failed to add ${type} license`, variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data: LicenseFormData) =>
      apiRequest(`/api/${endpoint}/${selectedLicense?.id}`, {
        method: "PUT",
        body: JSON.stringify(data)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees", employeeId, endpoint] });
      toast({ title: `${type.toUpperCase()} license updated successfully` });
      setIsDialogOpen(false);
      setSelectedLicense(null);
      form.reset();
    },
    onError: () => {
      toast({ title: `Failed to update ${type} license`, variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/api/${endpoint}/${id}`, {
        method: "DELETE"
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees", employeeId, endpoint] });
      toast({ title: `${type.toUpperCase()} license deleted successfully` });
      setDeleteLicense(null);
    },
    onError: () => {
      toast({ title: `Failed to delete ${type} license`, variant: "destructive" });
    }
  });

  const handleSubmit = (data: LicenseFormData) => {
    if (selectedLicense) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (license: any) => {
    setSelectedLicense(license);
    form.reset({
      licenseNumber: license.licenseNumber || "",
      state: license.state || "",
      issueDate: license.issueDate || "",
      expirationDate: license.expirationDate || "",
      status: license.status || "active"
    });
    setIsDialogOpen(true);
  };

  const handleDelete = () => {
    if (deleteLicense) {
      deleteMutation.mutate(deleteLicense.id);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case 'expired':
        return <Badge className="bg-red-100 text-red-800">Expired</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const isExpiringSoon = (date: string) => {
    if (!date) return false;
    const expDate = new Date(date);
    const now = new Date();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    return expDate.getTime() - now.getTime() < thirtyDays && expDate.getTime() > now.getTime();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon}
            <CardTitle>{title}</CardTitle>
          </div>
          <Button
            onClick={() => {
              setSelectedLicense(null);
              form.reset();
              setIsDialogOpen(true);
            }}
            size="sm"
            data-testid={`button-add-${type}-license`}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add License
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">Loading licenses...</p>
        ) : licenses.length === 0 ? (
          <p className="text-muted-foreground">No {type} licenses found</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>License Number</TableHead>
                {type === "state" && <TableHead>State</TableHead>}
                <TableHead>Issue Date</TableHead>
                <TableHead>Expiration Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {licenses.map((license: any) => (
                <TableRow key={license.id} data-testid={`row-${type}-license-${license.id}`}>
                  <TableCell>{license.licenseNumber}</TableCell>
                  {type === "state" && <TableCell>{license.state || "-"}</TableCell>}
                  <TableCell>{license.issueDate || "-"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {license.expirationDate || "-"}
                      {isExpiringSoon(license.expirationDate) && (
                        <Badge className="bg-orange-100 text-orange-800 text-xs">Expiring Soon</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(license.status || "active")}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(license)}
                      data-testid={`button-edit-${type}-license-${license.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteLicense(license)}
                      data-testid={`button-delete-${type}-license-${license.id}`}
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
              {selectedLicense ? `Edit ${type.toUpperCase()} License` : `Add ${type.toUpperCase()} License`}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="licenseNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>License Number</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter license number" data-testid="input-license-number" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {type === "state" && (
                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., CA, NY, TX" maxLength={2} data-testid="input-state" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="issueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Issue Date</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" data-testid="input-issue-date" />
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
                        <Input {...field} type="date" data-testid="input-expiration-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

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
                        <SelectItem value="expired">Expired</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
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
                    : selectedLicense
                    ? "Update"
                    : "Add"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteLicense} onOpenChange={() => setDeleteLicense(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this {type} license record.
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