import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertResponsiblePersonSchema, type ResponsiblePerson, type InsertResponsiblePerson, type Employee, type ClinicLicense } from "@shared/schema";
import { Users, User, Phone, Mail, Plus, Edit, Trash2, Search, Award, CheckCircle, Calendar, Bell, UserCheck, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";

interface ResponsiblePersonsResponse {
  responsiblePersons: ResponsiblePerson[];
  total: number;
  page: number;
  totalPages: number;
}

interface ExtendedResponsiblePerson extends ResponsiblePerson {
  assignedLicenses?: ClinicLicense[];
  employee?: Employee;
}

export default function ResponsiblePersonsPage() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selectedPerson, setSelectedPerson] = useState<ResponsiblePerson | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Fetch responsible persons
  const { data, isLoading, error } = useQuery<ResponsiblePersonsResponse>({
    queryKey: ["/api/responsible-persons", page, searchQuery, statusFilter],
    queryFn: async ({ queryKey }) => {
      const [url, currentPage, search, status] = queryKey;
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: "10",
        ...(search && { search: String(search) }),
        ...(status && { status: String(status) })
      });
      
      const res = await fetch(`${url}?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch responsible persons');
      return res.json();
    }
  });

  // Fetch employees for dropdown
  const { data: employeesData } = useQuery<{ employees: Employee[] }>({
    queryKey: ["/api/employees", { limit: 100 }]
  });

  // Fetch licenses to show assignments
  const { data: licensesData } = useQuery<{ licenses: ClinicLicense[] }>({
    queryKey: ["/api/clinic-licenses", { limit: 100 }]
  });

  // Form setup
  const form = useForm<InsertResponsiblePerson>({
    resolver: zodResolver(insertResponsiblePersonSchema),
    defaultValues: {
      employeeId: undefined,
      firstName: "",
      lastName: "",
      title: "",
      email: "",
      phone: "",
      isPrimary: true,
      isBackup: false,
      department: "",
      preferredContactMethod: "email",
      notificationEnabled: true,
      reminderFrequency: "weekly",
      canApprove: false,
      canSubmit: true,
      status: "active",
      notes: ""
    }
  });

  // Watch employeeId to auto-fill fields
  const watchEmployeeId = form.watch("employeeId");
  
  // Auto-fill fields when employee is selected
  const handleEmployeeSelect = (employeeId: string) => {
    const employee = employeesData?.employees.find(e => e.id === parseInt(employeeId));
    if (employee) {
      form.setValue("firstName", employee.firstName || "");
      form.setValue("lastName", employee.lastName || "");
      form.setValue("email", employee.workEmail || employee.personalEmail || "");
      form.setValue("phone", employee.cellPhone || employee.workPhone || "");
      form.setValue("title", employee.jobTitle || "");
    }
  };

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: InsertResponsiblePerson) => {
      if (selectedPerson) {
        return apiRequest("PUT", `/api/responsible-persons/${selectedPerson.id}`, data);
      } else {
        return apiRequest("POST", "/api/responsible-persons", data);
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: selectedPerson ? "Responsible person updated successfully" : "Responsible person created successfully"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/responsible-persons"] });
      setDialogOpen(false);
      setSelectedPerson(null);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/responsible-persons/${id}`, {}),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Responsible person deleted successfully"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/responsible-persons"] });
      setDeleteId(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleEdit = (person: ResponsiblePerson) => {
    setSelectedPerson(person);
    form.reset({
      employeeId: person.employeeId || undefined,
      firstName: person.firstName || "",
      lastName: person.lastName || "",
      title: person.title || "",
      email: person.email,
      phone: person.phone || "",
      isPrimary: person.isPrimary,
      isBackup: person.isBackup,
      department: person.department || "",
      preferredContactMethod: person.preferredContactMethod as any || "email",
      notificationEnabled: person.notificationEnabled,
      reminderFrequency: person.reminderFrequency as any || "weekly",
      canApprove: person.canApprove || false,
      canSubmit: person.canSubmit || true,
      status: person.status as any,
      startDate: person.startDate || undefined,
      endDate: person.endDate || undefined,
      notes: person.notes || ""
    });
    setDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "destructive" | "secondary"; className: string; icon: any }> = {
      active: { variant: "default", className: "bg-green-500 hover:bg-green-600", icon: CheckCircle },
      inactive: { variant: "secondary", className: "", icon: null },
      on_leave: { variant: "secondary", className: "bg-yellow-500 hover:bg-yellow-600 text-white", icon: Calendar }
    };
    
    const config = variants[status] || { variant: "outline" as const, className: "", icon: null };
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className={cn("capitalize", config.className)}>
        {Icon && <Icon className="h-3 w-3 mr-1" />}
        {status.replace(/_/g, ' ')}
      </Badge>
    );
  };

  // Get licenses assigned to a person
  const getAssignedLicenses = (personId: number) => {
    return licensesData?.licenses.filter(
      l => l.primaryResponsibleId === personId || l.backupResponsibleId === personId
    ) || [];
  };

  if (error) {
    return (
      <MainLayout>
        <div className="text-center py-8">
          <p className="text-destructive">Failed to load responsible persons</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground" data-testid="text-responsible-persons-title">Responsible Persons</h1>
            <p className="text-muted-foreground">Manage license compliance responsibilities</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => {
                  setSelectedPerson(null);
                  form.reset();
                }}
                data-testid="button-add-responsible-person"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Responsible Person
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {selectedPerson ? 'Edit Responsible Person' : 'Add New Responsible Person'}
                </DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit((data) => saveMutation.mutate(data))} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="employeeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Link to Employee (Optional)</FormLabel>
                        <Select 
                          onValueChange={(value) => {
                            field.onChange(value ? parseInt(value) : undefined);
                            if (value) handleEmployeeSelect(value);
                          }}
                          value={field.value?.toString() || ""}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-employee">
                              <SelectValue placeholder="Select employee or leave blank for external" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="">None (External Person)</SelectItem>
                            {employeesData?.employees.map((employee) => (
                              <SelectItem key={employee.id} value={employee.id.toString()}>
                                {employee.firstName} {employee.lastName} - {employee.jobTitle}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              value={field.value || ""}
                              placeholder="John" 
                              data-testid="input-first-name"
                              disabled={!!watchEmployeeId}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              value={field.value || ""}
                              placeholder="Doe" 
                              data-testid="input-last-name"
                              disabled={!!watchEmployeeId}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Title</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              value={field.value || ""}
                              placeholder="Compliance Officer" 
                              data-testid="input-title"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="department"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Department</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              value={field.value || ""}
                              placeholder="Compliance" 
                              data-testid="input-department"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email *</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="email"
                              placeholder="john.doe@clinic.com" 
                              data-testid="input-email"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              value={field.value || ""}
                              placeholder="(555) 123-4567" 
                              data-testid="input-phone"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-medium">Responsibility Settings</h3>
                    <div className="space-y-3">
                      <FormField
                        control={form.control}
                        name="isPrimary"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2">
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-is-primary"
                              />
                            </FormControl>
                            <FormLabel className="!mt-0">Primary Responsible Person</FormLabel>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="isBackup"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2">
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-is-backup"
                              />
                            </FormControl>
                            <FormLabel className="!mt-0">Backup Responsible Person</FormLabel>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-medium">Contact Preferences</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="preferredContactMethod"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Preferred Contact Method</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-contact-method">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="email">Email</SelectItem>
                                <SelectItem value="phone">Phone</SelectItem>
                                <SelectItem value="sms">SMS</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="reminderFrequency"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Reminder Frequency</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-reminder-frequency">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="daily">Daily</SelectItem>
                                <SelectItem value="weekly">Weekly</SelectItem>
                                <SelectItem value="monthly">Monthly</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="notificationEnabled"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2">
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-notifications-enabled"
                            />
                          </FormControl>
                          <FormLabel className="!mt-0">Enable Notifications</FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-medium">Permissions</h3>
                    <div className="space-y-3">
                      <FormField
                        control={form.control}
                        name="canApprove"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2">
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-can-approve"
                              />
                            </FormControl>
                            <FormLabel className="!mt-0">Can Approve License Renewals</FormLabel>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="canSubmit"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2">
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-can-submit"
                              />
                            </FormControl>
                            <FormLabel className="!mt-0">Can Submit Renewal Applications</FormLabel>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-status">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="inactive">Inactive</SelectItem>
                              <SelectItem value="on_leave">On Leave</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="startDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Start Date</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="date"
                              value={field.value || ""}
                              data-testid="input-start-date"
                            />
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
                            <Input 
                              {...field} 
                              type="date"
                              value={field.value || ""}
                              data-testid="input-end-date"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            value={field.value || ""}
                            placeholder="Additional notes..."
                            rows={3}
                            data-testid="textarea-notes"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={saveMutation.isPending} data-testid="button-save-responsible-person">
                      {saveMutation.isPending ? 'Saving...' : selectedPerson ? 'Update' : 'Create'} Person
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Persons</p>
                  <p className="text-2xl font-bold">{data?.total || 0}</p>
                </div>
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Primary Contacts</p>
                  <p className="text-2xl font-bold text-green-600">
                    {data?.responsiblePersons.filter(p => p.isPrimary).length || 0}
                  </p>
                </div>
                <UserCheck className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Backup Contacts</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {data?.responsiblePersons.filter(p => p.isBackup).length || 0}
                  </p>
                </div>
                <Users className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Can Approve</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {data?.responsiblePersons.filter(p => p.canApprove).length || 0}
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search responsible persons..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-responsible-persons"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]" data-testid="select-filter-status">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="on_leave">On Leave</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Responsible Persons Table */}
        <Card>
          <CardHeader>
            <CardTitle>Responsible Persons</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Notifications</TableHead>
                    <TableHead>Permissions</TableHead>
                    <TableHead>Assigned Licenses</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={9}>
                        <div className="space-y-3">
                          {[...Array(5)].map((_, i) => (
                            <Skeleton key={i} className="h-12 w-full" />
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : data?.responsiblePersons.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-12">
                        <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground mb-4">No responsible persons found</p>
                        <Button
                          onClick={() => {
                            setSelectedPerson(null);
                            form.reset();
                            setDialogOpen(true);
                          }}
                          data-testid="button-add-first-responsible-person"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Your First Responsible Person
                        </Button>
                      </TableCell>
                    </TableRow>
                  ) : (
                    data?.responsiblePersons.map((person) => {
                      const assignedLicenses = getAssignedLicenses(person.id);
                      const employee = employeesData?.employees.find(e => e.id === person.employeeId);
                      
                      return (
                        <TableRow key={person.id} data-testid={`responsible-person-row-${person.id}`}>
                          <TableCell className="font-medium">
                            <div>
                              <div className="flex items-center space-x-2">
                                {person.employeeId ? (
                                  <Badge variant="outline" className="text-xs">
                                    <User className="h-3 w-3 mr-1" />
                                    Employee
                                  </Badge>
                                ) : null}
                                <span>{person.firstName} {person.lastName}</span>
                              </div>
                              {person.department && (
                                <div className="text-sm text-muted-foreground">{person.department}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {person.title || employee?.jobTitle || '-'}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="flex items-center space-x-1 text-sm">
                                <Mail className="h-3 w-3" />
                                <span>{person.email}</span>
                              </div>
                              {person.phone && (
                                <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                                  <Phone className="h-3 w-3" />
                                  <span>{person.phone}</span>
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {person.isPrimary && (
                                <Badge className="bg-blue-500 hover:bg-blue-600 text-white text-xs">
                                  Primary
                                </Badge>
                              )}
                              {person.isBackup && (
                                <Badge variant="secondary" className="text-xs">
                                  Backup
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {person.notificationEnabled ? (
                                <Badge variant="outline" className="text-xs">
                                  <Bell className="h-3 w-3 mr-1" />
                                  {person.reminderFrequency}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-sm">Disabled</span>
                              )}
                              <div className="text-xs text-muted-foreground">
                                via {person.preferredContactMethod}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {person.canApprove && (
                                <Badge variant="secondary" className="text-xs">
                                  Approve
                                </Badge>
                              )}
                              {person.canSubmit && (
                                <Badge variant="secondary" className="text-xs">
                                  Submit
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {assignedLicenses.length > 0 ? (
                              <Badge variant="outline" className="text-xs">
                                <Award className="h-3 w-3 mr-1" />
                                {assignedLicenses.length} licenses
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">None</span>
                            )}
                          </TableCell>
                          <TableCell>{getStatusBadge(person.status)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(person)}
                                data-testid={`edit-responsible-person-${person.id}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setDeleteId(person.id)}
                                    data-testid={`delete-responsible-person-${person.id}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Responsible Person</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete this responsible person? This will remove them from all license assignments.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteId && deleteMutation.mutate(deleteId)}
                                      className="bg-destructive text-destructive-foreground"
                                      data-testid="confirm-delete-responsible-person"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {data && data.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Showing {(page - 1) * 10 + 1} to {Math.min(page * 10, data.total)} of {data.total} persons
                </p>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm">
                    Page {page} of {data.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                    disabled={page === data.totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}