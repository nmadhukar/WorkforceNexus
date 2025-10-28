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
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { Label } from "@/components/ui/label";

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
  const [stepError, setStepError] = useState<string | null>(null);
  const [employmentGap, setEmploymentGap] = useState<string>(data?.hasEmploymentGap ? "yes" : "no");
  const [employmentGapText, setEmploymentGapText] = useState<string>(data?.employmentGap || "");
  const formatDateInput = (value: unknown): string => {
    if (!value) return "";
    if (value instanceof Date) return value.toISOString().split("T")[0];
    const str = String(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    const d = new Date(str);
    return isNaN(d.getTime()) ? str : d.toISOString().split("T")[0];
  };
  const formatDateDisplay = (value: unknown): string => {
    if (!value) return "-";
    if (value instanceof Date) return value.toISOString().split("T")[0];
    const str = String(value);
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.split("T")[0];
    const d = new Date(str);
    return isNaN(d.getTime()) ? str : d.toISOString().split("T")[0];
  };

  const educationForm = useForm<any>({
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

  const employmentForm = useForm<any>({
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
  const { data: educations = [] } = useQuery<any[]>({
    queryKey: ["/api/employees", employeeId, "educations"],
    enabled: !!employeeId
  });

  const { data: employments = [] } = useQuery<any[]>({
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
    onChange({
      ...data,
      educations: localEducations,
      employments: localEmployments,
      hasEmploymentGap: employmentGap === "yes",
      employmentGap: employmentGap === "yes" ? employmentGapText : "",
    });
  }, [localEducations, localEmployments, employmentGap, employmentGapText]);

  // Initialize local state from incoming data (e.g., when navigating back)
  useEffect(() => {
    if (data) {
      if (typeof data.hasEmploymentGap === "boolean") {
        setEmploymentGap(data.hasEmploymentGap ? "yes" : "no");
      }
      if (typeof data.employmentGap === "string") {
        setEmploymentGapText(data.employmentGap);
      }
    }
  }, [data]);

  // Register validation function with parent
  useEffect(() => {
    if (registerValidation) {
      registerValidation(async () => {
        // Require at least one Education AND one Employment entry
        const hasBoth = (localEducations.length > 0) && (localEmployments.length > 0);
        if (!hasBoth) {
          setStepError("Please add at least one education and one employment record.");
        } else {
          setStepError(null);
        }
        if (onValidationChange) {
          onValidationChange(hasBoth);
        }
        return hasBoth;
      });
    }
  }, [registerValidation, localEducations, localEmployments, onValidationChange]);

  // Report validation state changes to parent
  useEffect(() => {
    const hasBoth = (localEducations.length > 0) && (localEmployments.length > 0);
    if (hasBoth) setStepError(null);
    if (onValidationChange) {
      onValidationChange(hasBoth);
    }
  }, [localEducations, localEmployments, onValidationChange]);

  // Education handlers
  const handleEducationSubmit = async (formData: EducationFormData) => {
    const isValid = await educationForm.trigger();
    if (!isValid) {
      console.log('Education form validation failed');
      return;
    }
    
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
      startDate: formatDateInput(education.startDate),
      endDate: formatDateInput(education.endDate)
    });
    setIsEducationDialogOpen(true);
    educationForm.reset();
  };

  const handleDeleteEducation = (id: number) => {
    setLocalEducations(localEducations.filter(edu => edu.id !== id));
  };

  // Employment handlers
  const handleEmploymentSubmit = async (formData: EmploymentFormData) => {
    const isValid = await employmentForm.trigger();
    if (!isValid) {
      console.log('Employment form validation failed');
      return;
    }
    
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
      startDate: formatDateInput(employment.startDate),
      endDate: formatDateInput(employment.endDate),
      description: employment.description || ""
    });
    setIsEmploymentDialogOpen(true);
  };

  const handleDeleteEmployment = (id: number) => {
    setLocalEmployments(localEmployments.filter(emp => emp.id !== id));
  };

  return (
    <div className="space-y-6">
      {stepError && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" data-testid="education-employment-error">
          {stepError}
        </div>
      )}
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

      {/* Employment gap */}
      <Card>  

        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                They have any gaps in employment history?
              </CardTitle>

              {
                employmentGap === "no" ? (
                  <CardDescription>Add or manage gaps in employment history</CardDescription>
                ) : (
                  <div>
                    <div className="space-y-2">
                      <Label>Employment Gap</Label>
                      <Textarea
                        style={{width: "100%", maxWidth: "100%"}}
                        value={employmentGapText}
                        onChange={(e) => setEmploymentGapText(e.target.value)}
                        placeholder="Add or manage gaps in employment history"
                        data-testid="textarea-employment-gap"
                      />
                    </div>
                </div>
                )
              }
            </div>
            <RadioGroup
              name="employmentGap"
              value={employmentGap}
              onValueChange={(value: string) => setEmploymentGap(value)}
              style={{display: "flex", flexDirection: "row", gap: 16}}
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="yes" id="employment-gap-yes" />
                <Label htmlFor="employment-gap-yes">Yes</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="no" id="employment-gap-no" />
                <Label htmlFor="employment-gap-no">No</Label>
              </div>
            </RadioGroup>
          </div>
        </CardHeader>
      </Card>
      {/* <Card>
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
                    <TableCell>{formatDateDisplay(employment.startDate)}</TableCell>
                    <TableCell>{formatDateDisplay(employment.endDate)}</TableCell>
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
      </Card> */}
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
                    <TableCell>{formatDateDisplay(employment.startDate)}</TableCell>
                    <TableCell>{formatDateDisplay(employment.endDate)}</TableCell>
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
                  onClick={() => {setIsEducationDialogOpen(false); educationForm.reset();}}
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
                  onClick={() => {setIsEmploymentDialogOpen(false); employmentForm.reset();}}
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