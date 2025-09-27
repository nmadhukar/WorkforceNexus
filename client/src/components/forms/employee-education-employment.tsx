import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Edit, Trash2, GraduationCap, Briefcase } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertEducationSchema, insertEmploymentSchema } from "@shared/schema";

type EducationFormData = z.infer<typeof insertEducationSchema>;
type EmploymentFormData = z.infer<typeof insertEmploymentSchema>;

interface EmployeeEducationEmploymentProps {
  data: any;
  onChange: (data: any) => void;
  employeeId?: number;
  onValidationChange?: (isValid: boolean) => void;
  registerValidation?: (validationFn: () => Promise<boolean>) => void;
}

export function EmployeeEducationEmployment({ data, onChange, employeeId, onValidationChange, registerValidation }: EmployeeEducationEmploymentProps) {
  const { toast } = useToast();
  const [isEducationDialogOpen, setIsEducationDialogOpen] = useState(false);
  const [isEmploymentDialogOpen, setIsEmploymentDialogOpen] = useState(false);
  const [selectedEducation, setSelectedEducation] = useState<any>(null);
  const [selectedEmployment, setSelectedEmployment] = useState<any>(null);
  const [localEducations, setLocalEducations] = useState<any[]>(data.educations || []);
  const [localEmployments, setLocalEmployments] = useState<any[]>(data.employments || []);

  const educationForm = useForm<EducationFormData>({
    resolver: zodResolver(insertEducationSchema),
    defaultValues: {
      educationType: "",
      schoolInstitution: "",
      degree: "",
      specialtyMajor: "",
      startDate: "",
      endDate: ""
    }
  });

  const employmentForm = useForm<EmploymentFormData>({
    resolver: zodResolver(insertEmploymentSchema),
    defaultValues: {
      employer: "",
      position: "",
      startDate: "",
      endDate: "",
      description: ""
    }
  });

  // Fetch existing data if in update mode
  const { data: educations = [] } = useQuery({
    queryKey: ["/api/employees", employeeId, "educations"],
    enabled: !!employeeId
  });

  const { data: employments = [] } = useQuery({
    queryKey: ["/api/employees", employeeId, "employments"],
    enabled: !!employeeId
  });

  useEffect(() => {
    if (employeeId) {
      setLocalEducations(educations);
      setLocalEmployments(employments);
    }
  }, [educations, employments, employeeId]);

  useEffect(() => {
    onChange({ ...data, educations: localEducations, employments: localEmployments });
  }, [localEducations, localEmployments]);

  // Register validation function with parent
  useEffect(() => {
    if (registerValidation) {
      registerValidation(async () => {
        // Validate that at least one education entry exists
        const hasEducation = localEducations.length > 0;
        // Report validation state
        if (onValidationChange) {
          onValidationChange(hasEducation);
        }
        return hasEducation;
      });
    }
  }, [registerValidation, localEducations, onValidationChange]);

  // Report validation state changes to parent
  useEffect(() => {
    if (onValidationChange) {
      // Check if at least one education entry exists
      const isValid = localEducations.length > 0;
      onValidationChange(isValid);
    }
  }, [localEducations, onValidationChange]);

  // Education handlers
  const handleEducationSubmit = (formData: EducationFormData) => {
    if (selectedEducation) {
      const updatedEducations = localEducations.map(edu => 
        edu.id === selectedEducation.id ? { ...edu, ...formData } : edu
      );
      setLocalEducations(updatedEducations);
    } else {
      setLocalEducations([...localEducations, { ...formData, id: Date.now() }]);
    }
    setIsEducationDialogOpen(false);
    setSelectedEducation(null);
    educationForm.reset();
  };

  const handleEditEducation = (education: any) => {
    setSelectedEducation(education);
    educationForm.reset({
      educationType: education.educationType || "",
      schoolInstitution: education.schoolInstitution || "",
      degree: education.degree || "",
      specialtyMajor: education.specialtyMajor || "",
      startDate: education.startDate || "",
      endDate: education.endDate || ""
    });
    setIsEducationDialogOpen(true);
  };

  const handleDeleteEducation = (id: number) => {
    setLocalEducations(localEducations.filter(edu => edu.id !== id));
  };

  // Employment handlers
  const handleEmploymentSubmit = (formData: EmploymentFormData) => {
    if (selectedEmployment) {
      const updatedEmployments = localEmployments.map(emp => 
        emp.id === selectedEmployment.id ? { ...emp, ...formData } : emp
      );
      setLocalEmployments(updatedEmployments);
    } else {
      setLocalEmployments([...localEmployments, { ...formData, id: Date.now() }]);
    }
    setIsEmploymentDialogOpen(false);
    setSelectedEmployment(null);
    employmentForm.reset();
  };

  const handleEditEmployment = (employment: any) => {
    setSelectedEmployment(employment);
    employmentForm.reset({
      employer: employment.employer || "",
      position: employment.position || "",
      startDate: employment.startDate || "",
      endDate: employment.endDate || "",
      description: employment.description || ""
    });
    setIsEmploymentDialogOpen(true);
  };

  const handleDeleteEmployment = (id: number) => {
    setLocalEmployments(localEmployments.filter(emp => emp.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Education Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5" />
                Education History
              </CardTitle>
              <CardDescription>Add or manage educational background</CardDescription>
            </div>
            <Button
              onClick={() => {
                setSelectedEducation(null);
                educationForm.reset();
                setIsEducationDialogOpen(true);
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
          {localEducations.length === 0 ? (
            <p className="text-muted-foreground">No education records added</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Institution</TableHead>
                  <TableHead>Degree</TableHead>
                  <TableHead>Major</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {localEducations.map((education: any) => (
                  <TableRow key={education.id} data-testid={`row-education-${education.id}`}>
                    <TableCell>{education.educationType || "-"}</TableCell>
                    <TableCell>{education.schoolInstitution || "-"}</TableCell>
                    <TableCell>{education.degree || "-"}</TableCell>
                    <TableCell>{education.specialtyMajor || "-"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditEducation(education)}
                        data-testid={`button-edit-education-${education.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteEducation(education.id)}
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
      </Card>

      {/* Employment Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                Employment History
              </CardTitle>
              <CardDescription>Add or manage work experience</CardDescription>
            </div>
            <Button
              onClick={() => {
                setSelectedEmployment(null);
                employmentForm.reset();
                setIsEmploymentDialogOpen(true);
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
          {localEmployments.length === 0 ? (
            <p className="text-muted-foreground">No employment records added</p>
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
                {localEmployments.map((employment: any) => (
                  <TableRow key={employment.id} data-testid={`row-employment-${employment.id}`}>
                    <TableCell>{employment.employer || "-"}</TableCell>
                    <TableCell>{employment.position || "-"}</TableCell>
                    <TableCell>{employment.startDate || "-"}</TableCell>
                    <TableCell>{employment.endDate || "-"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditEmployment(employment)}
                        data-testid={`button-edit-employment-${employment.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteEmployment(employment.id)}
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
      </Card>

      {/* Education Dialog */}
      <Dialog open={isEducationDialogOpen} onOpenChange={setIsEducationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedEducation ? "Edit Education" : "Add Education"}
            </DialogTitle>
          </DialogHeader>
          <Form {...educationForm}>
            <form onSubmit={educationForm.handleSubmit(handleEducationSubmit)} className="space-y-4">
              <FormField
                control={educationForm.control}
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
                        <SelectItem value="Bachelor's">Bachelor's</SelectItem>
                        <SelectItem value="Master's">Master's</SelectItem>
                        <SelectItem value="Doctorate">Doctorate</SelectItem>
                        <SelectItem value="Certificate">Certificate</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={educationForm.control}
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
                control={educationForm.control}
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
                control={educationForm.control}
                name="specialtyMajor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Major/Specialty</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter major or specialty" data-testid="input-major" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={educationForm.control}
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
                  control={educationForm.control}
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
                  onClick={() => setIsEducationDialogOpen(false)}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button type="submit" data-testid="button-submit">
                  {selectedEducation ? "Update" : "Add"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Employment Dialog */}
      <Dialog open={isEmploymentDialogOpen} onOpenChange={setIsEmploymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedEmployment ? "Edit Employment" : "Add Employment"}
            </DialogTitle>
          </DialogHeader>
          <Form {...employmentForm}>
            <form onSubmit={employmentForm.handleSubmit(handleEmploymentSubmit)} className="space-y-4">
              <FormField
                control={employmentForm.control}
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
                control={employmentForm.control}
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
                  control={employmentForm.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" data-testid="input-emp-start-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={employmentForm.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" data-testid="input-emp-end-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={employmentForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Describe responsibilities and achievements" data-testid="input-description" rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEmploymentDialogOpen(false)}
                  data-testid="button-cancel-emp"
                >
                  Cancel
                </Button>
                <Button type="submit" data-testid="button-submit-emp">
                  {selectedEmployment ? "Update" : "Add"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}