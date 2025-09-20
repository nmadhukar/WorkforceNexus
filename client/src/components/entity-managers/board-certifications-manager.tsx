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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Edit, Trash2, Award } from "lucide-react";

const certificationSchema = z.object({
  boardName: z.string().optional(),
  certification: z.string().optional(),
  issueDate: z.string().optional(),
  expirationDate: z.string().optional()
});

type CertificationFormData = z.infer<typeof certificationSchema>;

interface BoardCertificationsManagerProps {
  employeeId: number;
}

export function BoardCertificationsManager({ employeeId }: BoardCertificationsManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCertification, setSelectedCertification] = useState<any>(null);
  const [deleteCertification, setDeleteCertification] = useState<any>(null);
  const { toast } = useToast();

  const { data: certifications = [], isLoading } = useQuery({
    queryKey: ["/api/employees", employeeId, "board-certifications"],
    enabled: !!employeeId
  });

  const form = useForm<CertificationFormData>({
    resolver: zodResolver(certificationSchema),
    defaultValues: {
      boardName: "",
      certification: "",
      issueDate: "",
      expirationDate: ""
    }
  });

  const createMutation = useMutation({
    mutationFn: (data: CertificationFormData) =>
      apiRequest(`/api/employees/${employeeId}/board-certifications`, {
        method: "POST",
        body: JSON.stringify(data)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees", employeeId, "board-certifications"] });
      toast({ title: "Certification added successfully" });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Failed to add certification", variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data: CertificationFormData) =>
      apiRequest(`/api/board-certifications/${selectedCertification?.id}`, {
        method: "PUT",
        body: JSON.stringify(data)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees", employeeId, "board-certifications"] });
      toast({ title: "Certification updated successfully" });
      setIsDialogOpen(false);
      setSelectedCertification(null);
      form.reset();
    },
    onError: () => {
      toast({ title: "Failed to update certification", variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/api/board-certifications/${id}`, {
        method: "DELETE"
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees", employeeId, "board-certifications"] });
      toast({ title: "Certification deleted successfully" });
      setDeleteCertification(null);
    },
    onError: () => {
      toast({ title: "Failed to delete certification", variant: "destructive" });
    }
  });

  const handleSubmit = (data: CertificationFormData) => {
    if (selectedCertification) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (certification: any) => {
    setSelectedCertification(certification);
    form.reset({
      boardName: certification.boardName || "",
      certification: certification.certification || "",
      issueDate: certification.issueDate || "",
      expirationDate: certification.expirationDate || ""
    });
    setIsDialogOpen(true);
  };

  const handleDelete = () => {
    if (deleteCertification) {
      deleteMutation.mutate(deleteCertification.id);
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
            <Award className="h-5 w-5" />
            <CardTitle>Board Certifications</CardTitle>
          </div>
          <Button
            onClick={() => {
              setSelectedCertification(null);
              form.reset();
              setIsDialogOpen(true);
            }}
            size="sm"
            data-testid="button-add-certification"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Certification
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">Loading certifications...</p>
        ) : certifications.length === 0 ? (
          <p className="text-muted-foreground">No board certifications found</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Board Name</TableHead>
                <TableHead>Certification</TableHead>
                <TableHead>Issue Date</TableHead>
                <TableHead>Expiration Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {certifications.map((cert: any) => (
                <TableRow key={cert.id} data-testid={`row-certification-${cert.id}`}>
                  <TableCell>{cert.boardName || "-"}</TableCell>
                  <TableCell>{cert.certification || "-"}</TableCell>
                  <TableCell>{cert.issueDate || "-"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {cert.expirationDate || "-"}
                      {isExpiringSoon(cert.expirationDate) && (
                        <Badge className="bg-orange-100 text-orange-800 text-xs">Expiring Soon</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(cert)}
                      data-testid={`button-edit-certification-${cert.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteCertification(cert)}
                      data-testid={`button-delete-certification-${cert.id}`}
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
              {selectedCertification ? "Edit Certification" : "Add Certification"}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="boardName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Board Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., American Board of Internal Medicine" data-testid="input-board-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="certification"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Certification</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter certification type" data-testid="input-certification" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                    : selectedCertification
                    ? "Update"
                    : "Add"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteCertification} onOpenChange={() => setDeleteCertification(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this board certification.
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