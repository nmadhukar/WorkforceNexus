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

  const stateForm = useForm<StateLicenseFormData>({
    resolver: zodResolver(insertStateLicenseSchema),
    defaultValues: {
      licenseNumber: "",
      state: "",
      issueDate: "",
      expirationDate: "",
      status: "active"
    }
  });

  const deaForm = useForm<DeaLicenseFormData>({
    resolver: zodResolver(insertDeaLicenseSchema),
    defaultValues: {
      licenseNumber: "",
      state: "",
      issueDate: "",
      expirationDate: "",
      status: "active"
    }
  });

  // Fetch existing data if in update mode
  const { data: stateLicenses = [] } = useQuery({
    queryKey: ["/api/employees", employeeId, "state-licenses"],
    enabled: !!employeeId
  });

  const { data: deaLicenses = [] } = useQuery({
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

  // Calculate actual status based on expiration date
  const getActualStatus = (license: any) => {
    // If no expiration date, return stored status or 'active'
    if (!license.expirationDate) {
      return license.status || 'active';
    }

    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0); // Reset time for date-only comparison
    const expirationDate = new Date(license.expirationDate);
    expirationDate.setHours(0, 0, 0, 0);
    
    // Check if expired
    if (currentDate > expirationDate) {
      return 'expired';
    }
    
    // Check if expiring soon (within 30 days)
    const daysUntilExpiration = Math.ceil((expirationDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntilExpiration <= 30) {
      return 'expiring_soon';
    }
    
    // Otherwise return stored status or 'active'
    return license.status || 'active';
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
    // Calculate status based on expiration date
    let calculatedStatus = formData.status;
    if (formData.expirationDate) {
      const currentDate = new Date();
      currentDate.setHours(0, 0, 0, 0);
      const expirationDate = new Date(formData.expirationDate);
      expirationDate.setHours(0, 0, 0, 0);
      
      if (currentDate > expirationDate) {
        calculatedStatus = 'expired';
      } else {
        const daysUntilExpiration = Math.ceil((expirationDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntilExpiration <= 30) {
          calculatedStatus = 'expiring_soon';
        } else {
          calculatedStatus = 'active';
        }
      }
    }
    
    const licenseData = { ...formData, status: calculatedStatus };
    
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
      issueDate: license.issueDate || "",
      expirationDate: license.expirationDate || "",
      status: license.status || "active"
    });
    setIsStateDialogOpen(true);
  };

  const handleDeleteState = (id: number) => {
    setLocalStateLicenses(localStateLicenses.filter(lic => lic.id !== id));
  };

  // DEA License handlers
  const handleDeaSubmit = (formData: DeaLicenseFormData) => {
    // Calculate status based on expiration date
    let calculatedStatus = formData.status;
    if (formData.expirationDate) {
      const currentDate = new Date();
      currentDate.setHours(0, 0, 0, 0);
      const expirationDate = new Date(formData.expirationDate);
      expirationDate.setHours(0, 0, 0, 0);
      
      if (currentDate > expirationDate) {
        calculatedStatus = 'expired';
      } else {
        const daysUntilExpiration = Math.ceil((expirationDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntilExpiration <= 30) {
          calculatedStatus = 'expiring_soon';
        } else {
          calculatedStatus = 'active';
        }
      }
    }
    
    const licenseData = { ...formData, status: calculatedStatus };
    
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
      issueDate: license.issueDate || "",
      expirationDate: license.expirationDate || "",
      status: license.status || "active"
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
                stateForm.reset();
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
                    <TableCell>{license.issueDate || "-"}</TableCell>
                    <TableCell>{license.expirationDate || "-"}</TableCell>
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
                deaForm.reset();
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
                    <TableCell>{license.issueDate || "-"}</TableCell>
                    <TableCell>{license.expirationDate || "-"}</TableCell>
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
            <form onSubmit={stateForm.handleSubmit(handleStateSubmit)} className="space-y-4">
              <FormField
                control={stateForm.control}
                name="licenseNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>License Number *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter license number" data-testid="input-state-number" />
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
                      <Input {...field} placeholder="e.g., CA, NY, TX" data-testid="input-state" />
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
                        <Input {...field} type="date" data-testid="input-state-issue" />
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
                        <Input {...field} type="date" data-testid="input-state-exp" />
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
            <form onSubmit={deaForm.handleSubmit(handleDeaSubmit)} className="space-y-4">
              <FormField
                control={deaForm.control}
                name="licenseNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>License Number *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter DEA registration number" data-testid="input-dea-number" />
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
                      <Input {...field} placeholder="e.g., CA, NY, TX" data-testid="input-dea-state" />
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
                        <Input {...field} type="date" data-testid="input-dea-issue" />
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
                        <Input {...field} type="date" data-testid="input-dea-exp" />
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