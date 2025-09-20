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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Edit, Trash2, GraduationCap } from "lucide-react";

const educationSchema = z.object({
  educationType: z.string().optional(),
  schoolInstitution: z.string().optional(),
  degree: z.string().optional(),
  specialtyMajor: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional()
});

type EducationFormData = z.infer<typeof educationSchema>;

interface EducationsManagerProps {
  employeeId: number;
}

export function EducationsManager({ employeeId }: EducationsManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedEducation, setSelectedEducation] = useState<any>(null);
  const [deleteEducation, setDeleteEducation] = useState<any>(null);
  const { toast } = useToast();

  const { data: educations = [], isLoading } = useQuery({
    queryKey: ["/api/employees", employeeId, "educations"],
    enabled: !!employeeId
  });

  const form = useForm<EducationFormData>({
    resolver: zodResolver(educationSchema),
    defaultValues: {
      educationType: "",
      schoolInstitution: "",
      degree: "",
      specialtyMajor: "",
      startDate: "",
      endDate: ""
    }
  });

  const createMutation = useMutation({
    mutationFn: (data: EducationFormData) =>
      apiRequest(`/api/employees/${employeeId}/educations`, {
        method: "POST",
        body: JSON.stringify(data)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees", employeeId, "educations"] });
      toast({ title: "Education added successfully" });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Failed to add education", variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data: EducationFormData) =>
      apiRequest(`/api/educations/${selectedEducation?.id}`, {
        method: "PUT",
        body: JSON.stringify(data)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees", employeeId, "educations"] });
      toast({ title: "Education updated successfully" });
      setIsDialogOpen(false);
      setSelectedEducation(null);
      form.reset();
    },
    onError: () => {
      toast({ title: "Failed to update education", variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/api/educations/${id}`, {
        method: "DELETE"
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees", employeeId, "educations"] });
      toast({ title: "Education deleted successfully" });
      setDeleteEducation(null);
    },
    onError: () => {
      toast({ title: "Failed to delete education", variant: "destructive" });
    }
  });

  const handleSubmit = (data: EducationFormData) => {
    if (selectedEducation) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (education: any) => {
    setSelectedEducation(education);
    form.reset({
      educationType: education.educationType || "",
      schoolInstitution: education.schoolInstitution || "",
      degree: education.degree || "",
      specialtyMajor: education.specialtyMajor || "",
      startDate: education.startDate || "",
      endDate: education.endDate || ""
    });
    setIsDialogOpen(true);
  };

  const handleDelete = () => {
    if (deleteEducation) {
      deleteMutation.mutate(deleteEducation.id);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            <CardTitle>Education History</CardTitle>
          </div>
          <Button
            onClick={() => {
              setSelectedEducation(null);
              form.reset();
              setIsDialogOpen(true);
            }}
            size="sm"
            data-testid="button-add-education"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Education
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">Loading educations...</p>
        ) : educations.length === 0 ? (
          <p className="text-muted-foreground">No education records found</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Institution</TableHead>
                <TableHead>Degree</TableHead>
                <TableHead>Major</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {educations.map((education: any) => (
                <TableRow key={education.id} data-testid={`row-education-${education.id}`}>
                  <TableCell>{education.educationType || "-"}</TableCell>
                  <TableCell>{education.schoolInstitution || "-"}</TableCell>
                  <TableCell>{education.degree || "-"}</TableCell>
                  <TableCell>{education.specialtyMajor || "-"}</TableCell>
                  <TableCell>{education.startDate || "-"}</TableCell>
                  <TableCell>{education.endDate || "-"}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(education)}
                      data-testid={`button-edit-education-${education.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteEducation(education)}
                      data-testid={`button-delete-education-${education.id}`}
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
              {selectedEducation ? "Edit Education" : "Add Education"}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="educationType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Education Type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-education-type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="High School">High School</SelectItem>
                        <SelectItem value="Bachelor">Bachelor's Degree</SelectItem>
                        <SelectItem value="Master">Master's Degree</SelectItem>
                        <SelectItem value="Doctorate">Doctorate</SelectItem>
                        <SelectItem value="Certificate">Certificate</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="schoolInstitution"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>School/Institution</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter school name" data-testid="input-school" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="degree"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Degree</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter degree" data-testid="input-degree" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="specialtyMajor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Specialty/Major</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter major" data-testid="input-major" />
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
                    : selectedEducation
                    ? "Update"
                    : "Add"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteEducation} onOpenChange={() => setDeleteEducation(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this education record.
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