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
import { Plus, Edit, Trash2, FileText, Shield } from "lucide-react";
import { insertStateLicenseSchema, insertDeaLicenseSchema } from "@shared/schema";

type StateLicenseFormData = z.infer<typeof insertStateLicenseSchema>;
type DeaLicenseFormData = z.infer<typeof insertDeaLicenseSchema>;

interface EmployeeLicensesProps {
  data: any;
  onChange: (data: any) => void;
  employeeId?: number;
  onValidationChange?: (isValid: boolean) => void;
  registerValidation?: (validationFn: () => Promise<boolean>) => void;
}

export function EmployeeLicenses({ data, onChange, employeeId, onValidationChange, registerValidation }: EmployeeLicensesProps) {
  const [isStateDialogOpen, setIsStateDialogOpen] = useState(false);
  const [isDeaDialogOpen, setIsDeaDialogOpen] = useState(false);
  const [selectedStateLicense, setSelectedStateLicense] = useState<any>(null);
  const [selectedDeaLicense, setSelectedDeaLicense] = useState<any>(null);
  const [localStateLicenses, setLocalStateLicenses] = useState<any[]>(data.stateLicenses || []);
  const [localDeaLicenses, setLocalDeaLicenses] = useState<any[]>(data.deaLicenses || []);
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

  const stateForm = useForm<any>({
    resolver: zodResolver(insertStateLicenseSchema),
    defaultValues: {
      licenseNumber: "",
      state: "",
      issueDate: "",
      expirationDate: "",
      status: "pending"
    }
  });

  const deaForm = useForm<any>({
    resolver: zodResolver(insertDeaLicenseSchema),
    defaultValues: {
      licenseNumber: "",
      state: "",
      issueDate: "",
      expirationDate: "",
      status: "pending"
    }
  });

  // Fetch existing data if in update mode
  const { data: stateLicenses = [] } = useQuery<any[]>({
    queryKey: ["/api/employees", employeeId, "state-licenses"],
    enabled: !!employeeId
  });

  const { data: deaLicenses = [] } = useQuery<any[]>({
    queryKey: ["/api/employees", employeeId, "dea-licenses"],
    enabled: !!employeeId
  });

  useEffect(() => {
    if (employeeId) {
      setLocalStateLicenses(stateLicenses);
      setLocalDeaLicenses(deaLicenses);
    }
  }, [stateLicenses, deaLicenses, employeeId]);

  useEffect(() => {
    onChange({ ...data, stateLicenses: localStateLicenses, deaLicenses: localDeaLicenses });
  }, [localStateLicenses, localDeaLicenses]);

  // Seed State License row from credentials step when present
  useEffect(() => {
    const hasCredentialsMedical = !!(
      data?.medicalLicenseNumber ||
      data?.medicalLicenseState ||
      data?.medicalLicenseIssueDate ||
      data?.medicalLicenseExpirationDate
    );
    if (!hasCredentialsMedical) return;

    const derived = {
      id: "credentials-medical",
      licenseNumber: data?.medicalLicenseNumber || "",
      state: data?.medicalLicenseState || "",
      issueDate: data?.medicalLicenseIssueDate || "",
      expirationDate: data?.medicalLicenseExpirationDate || "",
      status: data?.medicalLicenseStatus || "pending",
      source: "credentials",
    } as any;

    const existingIndex = localStateLicenses.findIndex(
      (l: any) => l?.id === "credentials-medical" || l?.source === "credentials"
    );
    if (
      existingIndex >= 0 &&
      (localStateLicenses[existingIndex]?.licenseNumber !== derived.licenseNumber ||
        localStateLicenses[existingIndex]?.state !== derived.state ||
        localStateLicenses[existingIndex]?.issueDate !== derived.issueDate ||
        localStateLicenses[existingIndex]?.expirationDate !== derived.expirationDate)
    ) {
      const updated = [...localStateLicenses];
      updated[existingIndex] = { ...updated[existingIndex], ...derived };
      setLocalStateLicenses(updated);
    } else if (existingIndex === -1) {
      setLocalStateLicenses([derived, ...localStateLicenses]);
    }
  }, [data?.medicalLicenseNumber, data?.medicalLicenseState, data?.medicalLicenseIssueDate, data?.medicalLicenseExpirationDate]);

  // Seed DEA License row from credentials step when present
  useEffect(() => {
    const hasDea = !!data?.deaNumber;
    if (!hasDea) return;

    const derived = {
      id: "credentials-dea",
      licenseNumber: data?.deaNumber || "",
      state: data?.medicalLicenseState || "",
      issueDate: "",
      expirationDate: "",
      status: "pending",
      source: "credentials",
    } as any;

    const existingIndex = localDeaLicenses.findIndex(
      (l: any) => l?.id === "credentials-dea" || l?.source === "credentials"
    );
    if (existingIndex >= 0 && localDeaLicenses[existingIndex]?.licenseNumber !== derived.licenseNumber) {
      const updated = [...localDeaLicenses];
      updated[existingIndex] = { ...updated[existingIndex], ...derived };
      setLocalDeaLicenses(updated);
    } else if (existingIndex === -1) {
      setLocalDeaLicenses([derived, ...localDeaLicenses]);
    }
  }, [data?.deaNumber, data?.medicalLicenseState]);

  // Register validation function with parent
  useEffect(() => {
    if (registerValidation) {
      registerValidation(async () => {
        // Licenses are optional, so always valid (even if empty)
        // But if licenses are added, they must have required fields filled via form validation
        return true;
      });
    }
  }, [registerValidation]);

  // Report validation state to parent - licenses are optional
  useEffect(() => {
    if (onValidationChange) {
      // Always valid since licenses are optional
      onValidationChange(true);
    }
  }, [onValidationChange]);

  // Determine status for display; prefer explicit user-selected status
  const getActualStatus = (license: any) => {
    if (license.status) return license.status;
    if (!license.expirationDate) return 'active';
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    const expirationDate = new Date(license.expirationDate as any);
    expirationDate.setHours(0, 0, 0, 0);
    if (currentDate > expirationDate) return 'expired';
    const daysUntilExpiration = Math.ceil((expirationDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiration <= 30 ? 'expiring_soon' : 'active';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case 'expired':
        return <Badge className="bg-red-100 text-red-800">Expired</Badge>;
      case 'expiring_soon':
        return <Badge className="bg-amber-100 text-amber-800">Expiring Soon</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // State License handlers
  const handleStateSubmit = (formData: StateLicenseFormData) => {
    // Respect the status selected by the user; do not auto-override
    const licenseData = { ...formData } as any;
    
    if (selectedStateLicense) {
      const updated = localStateLicenses.map(lic => 
        lic.id === selectedStateLicense.id ? { ...lic, ...licenseData } : lic
      );
      setLocalStateLicenses(updated);
    } else {
      setLocalStateLicenses([...localStateLicenses, { ...licenseData, id: Date.now() }]);
    }
    setIsStateDialogOpen(false);
    setSelectedStateLicense(null);
    stateForm.reset();
  };

  const handleEditState = (license: any) => {
    setSelectedStateLicense(license);
    stateForm.reset({
      licenseNumber: license.licenseNumber || "",
      state: license.state || "",
      issueDate: formatDateInput(license.issueDate),
      expirationDate: formatDateInput(license.expirationDate),
      status: license.status || "pending"
    });
    setIsStateDialogOpen(true);
  };

  const handleDeleteState = (id: number) => {
    setLocalStateLicenses(localStateLicenses.filter(lic => lic.id !== id));
  };

  // DEA License handlers
  const handleDeaSubmit = (formData: DeaLicenseFormData) => {
    // Respect the status selected by the user; do not auto-override
    const licenseData = { ...formData } as any;
    
    if (selectedDeaLicense) {
      const updated = localDeaLicenses.map(lic => 
        lic.id === selectedDeaLicense.id ? { ...lic, ...licenseData } : lic
      );
      setLocalDeaLicenses(updated);
    } else {
      setLocalDeaLicenses([...localDeaLicenses, { ...licenseData, id: Date.now() }]);
    }
    setIsDeaDialogOpen(false);
    setSelectedDeaLicense(null);
    deaForm.reset();
  };

  const handleEditDea = (license: any) => {
    setSelectedDeaLicense(license);
    deaForm.reset({
      licenseNumber: license.licenseNumber || "",
      state: license.state || "",
      issueDate: formatDateInput(license.issueDate),
      expirationDate: formatDateInput(license.expirationDate),
      status: license.status || "pending"
    });
    setIsDeaDialogOpen(true);
  };

  const handleDeleteDea = (id: number) => {
    setLocalDeaLicenses(localDeaLicenses.filter(lic => lic.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* State Licenses Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                State Licenses
              </CardTitle>
              <CardDescription>Manage state medical licenses</CardDescription>
            </div>
            <Button
              onClick={() => {
                setSelectedStateLicense(null);
                stateForm.reset({ licenseNumber: "", state: "", issueDate: "", expirationDate: "", status: "pending" });
                setIsStateDialogOpen(true);
              }}
              size="sm"
              data-testid="button-add-state-license"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add License
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {localStateLicenses.length === 0 ? (
            <p className="text-muted-foreground">No state licenses added</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>License Number</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Issue Date</TableHead>
                  <TableHead>Expiration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {localStateLicenses.map((license: any) => (
                  <TableRow key={license.id} data-testid={`row-state-license-${license.id}`}>
                    <TableCell>{license.licenseNumber}</TableCell>
                    <TableCell>{license.state || "-"}</TableCell>
                    <TableCell>{formatDateDisplay(license.issueDate)}</TableCell>
                    <TableCell>{formatDateDisplay(license.expirationDate)}</TableCell>
                    <TableCell>{getStatusBadge(getActualStatus(license))}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditState(license)}
                        data-testid={`button-edit-state-license-${license.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteState(license.id)}
                        data-testid={`button-delete-state-license-${license.id}`}
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

      {/* DEA Licenses Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                DEA Licenses
              </CardTitle>
              <CardDescription>Manage DEA registrations</CardDescription>
            </div>
            <Button
              onClick={() => {
                setSelectedDeaLicense(null);
                deaForm.reset({ licenseNumber: "", state: "", issueDate: "", expirationDate: "", status: "pending" });
                setIsDeaDialogOpen(true);
              }}
              size="sm"
              data-testid="button-add-dea-license"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add License
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {localDeaLicenses.length === 0 ? (
            <p className="text-muted-foreground">No DEA licenses added</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>License Number</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Issue Date</TableHead>
                  <TableHead>Expiration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {localDeaLicenses.map((license: any) => (
                  <TableRow key={license.id} data-testid={`row-dea-license-${license.id}`}>
                    <TableCell>{license.licenseNumber}</TableCell>
                    <TableCell>{license.state || "-"}</TableCell>
                    <TableCell>{formatDateDisplay(license.issueDate)}</TableCell>
                    <TableCell>{formatDateDisplay(license.expirationDate)}</TableCell>
                    <TableCell>{formatDateDisplay(license.issueDate)}</TableCell>
                    <TableCell>{formatDateDisplay(license.expirationDate)}</TableCell>
                    <TableCell>{getStatusBadge(getActualStatus(license))}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditDea(license)}
                        data-testid={`button-edit-dea-license-${license.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteDea(license.id)}
                        data-testid={`button-delete-dea-license-${license.id}`}
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

      {/* State License Dialog */}
      <Dialog open={isStateDialogOpen} onOpenChange={setIsStateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedStateLicense ? "Edit State License" : "Add State License"}
            </DialogTitle>
          </DialogHeader>
          <Form {...stateForm}>
            <form onSubmit={stateForm.handleSubmit(handleStateSubmit)} className="space-y-4" autoComplete="off">
              <FormField
                control={stateForm.control}
                name="licenseNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>License Number *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter license number" data-testid="input-state-number" autoComplete="off" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={stateForm.control}
                name="state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., CA, NY, TX" data-testid="input-state" autoComplete="off" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={stateForm.control}
                  name="issueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Issue Date</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" data-testid="input-state-issue" autoComplete="off" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={stateForm.control}
                  name="expirationDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expiration Date</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" data-testid="input-state-exp" autoComplete="off" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={stateForm.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-state-status">
                          <SelectValue />
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
                  onClick={() => setIsStateDialogOpen(false)}
                  data-testid="button-cancel-state"
                >
                  Cancel
                </Button>
                <Button type="submit" data-testid="button-submit-state">
                  {selectedStateLicense ? "Update" : "Add"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* DEA License Dialog */}
      <Dialog open={isDeaDialogOpen} onOpenChange={setIsDeaDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedDeaLicense ? "Edit DEA License" : "Add DEA License"}
            </DialogTitle>
          </DialogHeader>
          <Form {...deaForm}>
            <form onSubmit={deaForm.handleSubmit(handleDeaSubmit)} className="space-y-4" autoComplete="off">
              <FormField
                control={deaForm.control}
                name="licenseNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>License Number *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter DEA registration number" data-testid="input-dea-number" autoComplete="off" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={deaForm.control}
                name="state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., CA, NY, TX" data-testid="input-dea-state" autoComplete="off" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={deaForm.control}
                  name="issueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Issue Date</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" data-testid="input-dea-issue" autoComplete="off" />
                      </FormControl>  
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={deaForm.control}
                  name="expirationDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expiration Date</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" data-testid="input-dea-exp" autoComplete="off" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={deaForm.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-dea-status">
                          <SelectValue />
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
                  onClick={() => setIsDeaDialogOpen(false)}
                  data-testid="button-cancel-dea"
                >
                  Cancel
                </Button>
                <Button type="submit" data-testid="button-submit-dea">
                  {selectedDeaLicense ? "Update" : "Add"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}