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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Edit, Trash2, BookOpen } from "lucide-react";

// Form schema using database field names
// Keep dates as strings for form inputs, transform to Date when sending to API
const trainingFormSchema = z.object({
  trainingType: z.string().min(1, "Training name is required"),
  provider: z.string().optional(),
  completionDate: z.string().optional(),
  expirationDate: z.string().optional(),
  certificatePath: z.string().optional()
}).refine((data) => {
  if (data.expirationDate && data.completionDate) {
    return new Date(data.expirationDate) >= new Date(data.completionDate);
  }
  return true;
}, { message: "Expiration date cannot be before completion date", path: ["expirationDate"] });

type TrainingFormData = z.infer<typeof trainingFormSchema>;

interface TrainingsManagerProps {
  employeeId: number;
}

export function TrainingsManager({ employeeId }: TrainingsManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTraining, setSelectedTraining] = useState<any>(null);
  const [deleteTraining, setDeleteTraining] = useState<any>(null);
  const { toast } = useToast();

  const { data: trainings = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/employees", employeeId, "trainings"],
    enabled: !!employeeId
  });

  const form = useForm<TrainingFormData>({
    resolver: zodResolver(trainingFormSchema),
    defaultValues: {
      trainingType: "",
      provider: "",
      completionDate: "",
      expirationDate: "",
      certificatePath: ""
    }
  });

  useEffect(() => {
    if (!selectedTraining && isDialogOpen) {
      form.reset({
        trainingType: "",
        provider: "",
        completionDate: "",
        expirationDate: "",
        certificatePath: ""
      });
    }
  }, [selectedTraining, form, isDialogOpen]);

  const createMutation = useMutation({
    mutationFn: (data: TrainingFormData) =>
      apiRequest("POST", `/api/employees/${employeeId}/trainings`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees", employeeId, "trainings"] });
      toast({ title: "Training added successfully" });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Failed to add training", variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data: TrainingFormData) =>
      apiRequest("PUT", `/api/trainings/${selectedTraining?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees", employeeId, "trainings"] });
      toast({ title: "Training updated successfully" });
      setIsDialogOpen(false);
      setSelectedTraining(null);
      form.reset();
    },
    onError: () => {
      toast({ title: "Failed to update training", variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `/api/trainings/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees", employeeId, "trainings"] });
      toast({ title: "Training deleted successfully" });
      setDeleteTraining(null);
    },
    onError: () => {
      toast({ title: "Failed to delete training", variant: "destructive" });
    }
  });

  const handleSubmit = (data: TrainingFormData) => {
    // Ensure trainingType is always included and not empty
    if (!data.trainingType || data.trainingType.trim() === "") {
      toast({ 
        title: "Validation Error", 
        description: "Training name is required",
        variant: "destructive" 
      });
      return;
    }

    // Prepare the data to send, using database field names
    // Transform date strings to ISO format for API
    const submitData = {
      trainingType: data.trainingType.trim(),
      provider: data.provider || null,
      completionDate: data.completionDate ? new Date(data.completionDate).toISOString() : null,
      expirationDate: data.expirationDate ? new Date(data.expirationDate).toISOString() : null,
      certificatePath: data.certificatePath || null
    };

    if (selectedTraining) {
      updateMutation.mutate(submitData as any);
    } else {
      createMutation.mutate(submitData as any);
    }
  };

  const handleEdit = (training: any) => {
    setSelectedTraining(training);
    
    // Format dates for date inputs (YYYY-MM-DD format)
    const formatDateForInput = (date: string | Date | null | undefined): string => {
      if (!date) return "";
      const d = typeof date === 'string' ? new Date(date) : date;
      if (isNaN(d.getTime())) return "";
      return d.toISOString().split('T')[0];
    };
    
    form.reset({
      trainingType: training.trainingType || "",
      provider: training.provider || "",
      completionDate: formatDateForInput(training.completionDate),
      expirationDate: formatDateForInput(training.expirationDate),
      certificatePath: training.certificatePath || ""
    });
    setIsDialogOpen(true);
  };

  const handleDelete = () => {
    if (deleteTraining) {
      deleteMutation.mutate(deleteTraining.id);
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
            <BookOpen className="h-5 w-5" />
            <CardTitle>Training & Certifications</CardTitle>
          </div>
          <Button
            onClick={() => {
              setSelectedTraining(null);
              form.reset();
              setIsDialogOpen(true);
            }}
            size="sm"
            data-testid="button-add-training"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Training
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">Loading trainings...</p>
        ) : trainings.length === 0 ? (
          <p className="text-muted-foreground">No trainings found</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Training Name</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Completion Date</TableHead>
                <TableHead>Expiration Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trainings.map((training: any) => (
                <TableRow key={training.id} data-testid={`row-training-${training.id}`}>
                  <TableCell>{training.trainingType || "-"}</TableCell>
                  <TableCell>{training.provider || "-"}</TableCell>
                  <TableCell>{training.completionDate || "-"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {training.expirationDate || "-"}
                      {isExpiringSoon(training.expirationDate) && (
                        <Badge className="bg-orange-100 text-orange-800 text-xs">Expiring Soon</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(training)}
                      data-testid={`button-edit-training-${training.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTraining(training)}
                      data-testid={`button-delete-training-${training.id}`}
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
              {selectedTraining ? "Edit Training" : "Add Training"}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="trainingType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Training Name *</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        value={field.value || ""}
                        onChange={(e) => field.onChange(e.target.value)}
                        placeholder="e.g., CPR Certification" 
                        data-testid="input-training-name" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="provider"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Provider</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        value={field.value || ""}
                        placeholder="Enter training provider" 
                        data-testid="input-provider" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="completionDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Completion Date</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          value={field.value || ""}
                          type="date" 
                          data-testid="input-completion-date" 
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
                          value={field.value || ""}
                          type="date" 
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
                name="certificatePath"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Certificate Number</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        value={field.value || ""}
                        placeholder="Enter certificate number" 
                        data-testid="input-certificate-number" 
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
                    : selectedTraining
                    ? "Update"
                    : "Add"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTraining} onOpenChange={() => setDeleteTraining(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this training record.
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