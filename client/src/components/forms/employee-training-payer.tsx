import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Edit, Trash2, BookOpen, DollarSign } from "lucide-react";

const trainingSchema = z.object({
  trainingName: z.string().min(1, "Training name is required"),
  provider: z.string().optional(),
  completionDate: z.string().optional(),
  expirationDate: z.string().optional(),
  certificateNumber: z.string().optional()
});

const enrollmentSchema = z.object({
  payerName: z.string().min(1, "Payer name is required"),
  enrollmentStatus: z.string().optional(),
  effectiveDate: z.string().optional(),
  terminationDate: z.string().optional(),
  providerId: z.string().optional()
});

type TrainingFormData = z.infer<typeof trainingSchema>;
type EnrollmentFormData = z.infer<typeof enrollmentSchema>;

interface EmployeeTrainingPayerProps {
  data: any;
  onChange: (data: any) => void;
  employeeId?: number;
}

export function EmployeeTrainingPayer({ data, onChange, employeeId }: EmployeeTrainingPayerProps) {
  const [isTrainingDialogOpen, setIsTrainingDialogOpen] = useState(false);
  const [isPayerDialogOpen, setIsPayerDialogOpen] = useState(false);
  const [selectedTraining, setSelectedTraining] = useState<any>(null);
  const [selectedPayer, setSelectedPayer] = useState<any>(null);
  const [localTrainings, setLocalTrainings] = useState<any[]>(data.trainings || []);
  const [localPayers, setLocalPayers] = useState<any[]>(data.payerEnrollments || []);

  const trainingForm = useForm<TrainingFormData>({
    resolver: zodResolver(trainingSchema),
    defaultValues: {
      trainingName: "",
      provider: "",
      completionDate: "",
      expirationDate: "",
      certificateNumber: ""
    }
  });

  const payerForm = useForm<EnrollmentFormData>({
    resolver: zodResolver(enrollmentSchema),
    defaultValues: {
      payerName: "",
      enrollmentStatus: "active",
      effectiveDate: "",
      terminationDate: "",
      providerId: ""
    }
  });

  // Fetch existing data if in update mode
  const { data: trainings = [] } = useQuery({
    queryKey: ["/api/employees", employeeId, "trainings"],
    enabled: !!employeeId
  });

  const { data: payerEnrollments = [] } = useQuery({
    queryKey: ["/api/employees", employeeId, "payer-enrollments"],
    enabled: !!employeeId
  });

  useEffect(() => {
    if (employeeId) {
      setLocalTrainings(trainings);
      setLocalPayers(payerEnrollments);
    }
  }, [trainings, payerEnrollments, employeeId]);

  useEffect(() => {
    onChange({ ...data, trainings: localTrainings, payerEnrollments: localPayers });
  }, [localTrainings, localPayers]);

  const isExpiringSoon = (date: string) => {
    if (!date) return false;
    const expDate = new Date(date);
    const now = new Date();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    return expDate.getTime() - now.getTime() < thirtyDays && expDate.getTime() > now.getTime();
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

  // Training handlers
  const handleTrainingSubmit = (formData: TrainingFormData) => {
    if (selectedTraining) {
      const updated = localTrainings.map(t => 
        t.id === selectedTraining.id ? { ...t, ...formData } : t
      );
      setLocalTrainings(updated);
    } else {
      setLocalTrainings([...localTrainings, { ...formData, id: Date.now() }]);
    }
    setIsTrainingDialogOpen(false);
    setSelectedTraining(null);
    trainingForm.reset();
  };

  const handleEditTraining = (training: any) => {
    setSelectedTraining(training);
    trainingForm.reset({
      trainingName: training.trainingName || "",
      provider: training.provider || "",
      completionDate: training.completionDate || "",
      expirationDate: training.expirationDate || "",
      certificateNumber: training.certificateNumber || ""
    });
    setIsTrainingDialogOpen(true);
  };

  const handleDeleteTraining = (id: number) => {
    setLocalTrainings(localTrainings.filter(t => t.id !== id));
  };

  // Payer handlers
  const handlePayerSubmit = (formData: EnrollmentFormData) => {
    if (selectedPayer) {
      const updated = localPayers.map(p => 
        p.id === selectedPayer.id ? { ...p, ...formData } : p
      );
      setLocalPayers(updated);
    } else {
      setLocalPayers([...localPayers, { ...formData, id: Date.now() }]);
    }
    setIsPayerDialogOpen(false);
    setSelectedPayer(null);
    payerForm.reset();
  };

  const handleEditPayer = (payer: any) => {
    setSelectedPayer(payer);
    payerForm.reset({
      payerName: payer.payerName || "",
      enrollmentStatus: payer.enrollmentStatus || "active",
      effectiveDate: payer.effectiveDate || "",
      terminationDate: payer.terminationDate || "",
      providerId: payer.providerId || ""
    });
    setIsPayerDialogOpen(true);
  };

  const handleDeletePayer = (id: number) => {
    setLocalPayers(localPayers.filter(p => p.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Training Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Training & Certifications
              </CardTitle>
              <CardDescription>Track professional development and training</CardDescription>
            </div>
            <Button
              onClick={() => {
                setSelectedTraining(null);
                trainingForm.reset();
                setIsTrainingDialogOpen(true);
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
          {localTrainings.length === 0 ? (
            <p className="text-muted-foreground">No trainings added</p>
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
                {localTrainings.map((training: any) => (
                  <TableRow key={training.id} data-testid={`row-training-${training.id}`}>
                    <TableCell>{training.trainingName}</TableCell>
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
                        onClick={() => handleEditTraining(training)}
                        data-testid={`button-edit-training-${training.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteTraining(training.id)}
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
      </Card>

      {/* Payer Enrollments Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Payer Enrollments
              </CardTitle>
              <CardDescription>Insurance payer enrollment status</CardDescription>
            </div>
            <Button
              onClick={() => {
                setSelectedPayer(null);
                payerForm.reset();
                setIsPayerDialogOpen(true);
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
          {localPayers.length === 0 ? (
            <p className="text-muted-foreground">No payer enrollments added</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payer Name</TableHead>
                  <TableHead>Provider ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Effective Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {localPayers.map((enrollment: any) => (
                  <TableRow key={enrollment.id} data-testid={`row-enrollment-${enrollment.id}`}>
                    <TableCell>{enrollment.payerName}</TableCell>
                    <TableCell>{enrollment.providerId || "-"}</TableCell>
                    <TableCell>{getStatusBadge(enrollment.enrollmentStatus || "active")}</TableCell>
                    <TableCell>{enrollment.effectiveDate || "-"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditPayer(enrollment)}
                        data-testid={`button-edit-enrollment-${enrollment.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeletePayer(enrollment.id)}
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
      </Card>

      {/* Training Dialog */}
      <Dialog open={isTrainingDialogOpen} onOpenChange={setIsTrainingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedTraining ? "Edit Training" : "Add Training"}
            </DialogTitle>
          </DialogHeader>
          <Form {...trainingForm}>
            <form onSubmit={trainingForm.handleSubmit(handleTrainingSubmit)} className="space-y-4">
              <FormField
                control={trainingForm.control}
                name="trainingName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Training Name *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., CPR Certification" data-testid="input-training-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={trainingForm.control}
                name="provider"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Provider</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter training provider" data-testid="input-provider" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={trainingForm.control}
                  name="completionDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Completion Date</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" data-testid="input-completion-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={trainingForm.control}
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
                control={trainingForm.control}
                name="certificateNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Certificate Number</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter certificate number" data-testid="input-certificate-number" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsTrainingDialogOpen(false)}
                  data-testid="button-cancel-training"
                >
                  Cancel
                </Button>
                <Button type="submit" data-testid="button-submit-training">
                  {selectedTraining ? "Update" : "Add"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Payer Dialog */}
      <Dialog open={isPayerDialogOpen} onOpenChange={setIsPayerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedPayer ? "Edit Payer Enrollment" : "Add Payer Enrollment"}
            </DialogTitle>
          </DialogHeader>
          <Form {...payerForm}>
            <form onSubmit={payerForm.handleSubmit(handlePayerSubmit)} className="space-y-4">
              <FormField
                control={payerForm.control}
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
                control={payerForm.control}
                name="providerId"
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
                control={payerForm.control}
                name="enrollmentStatus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-status">
                          <SelectValue />
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
                  control={payerForm.control}
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
                  control={payerForm.control}
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
                  onClick={() => setIsPayerDialogOpen(false)}
                  data-testid="button-cancel-payer"
                >
                  Cancel
                </Button>
                <Button type="submit" data-testid="button-submit-payer">
                  {selectedPayer ? "Update" : "Add"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}