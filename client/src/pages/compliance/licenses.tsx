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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertClinicLicenseSchema, type ClinicLicense, type InsertClinicLicense, type Location, type LicenseType, type ResponsiblePerson } from "@shared/schema";
import { Award, AlertTriangle, Calendar as CalendarIcon, Download, Mail, Plus, Edit, Trash2, FileText, Users, Search, Filter, RefreshCw, CheckCircle, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, differenceInDays, addMonths } from "date-fns";

interface LicensesResponse {
  licenses: ClinicLicense[];
  total: number;
  page: number;
  totalPages: number;
}

interface ComplianceStats {
  total: number;
  active: number;
  expiring: number;
  expired: number;
  pendingRenewal: number;
}

export default function LicensesPage() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [locationFilter, setLocationFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selectedLicense, setSelectedLicense] = useState<ClinicLicense | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Get location ID from URL params if present
  const urlParams = new URLSearchParams(window.location.search);
  const locationIdParam = urlParams.get('locationId');

  // Fetch licenses
  const { data, isLoading, error } = useQuery<LicensesResponse>({
    queryKey: ["/api/clinic-licenses", page, searchQuery, locationFilter || locationIdParam, typeFilter, statusFilter],
    queryFn: async ({ queryKey }) => {
      const [url, currentPage, search, location, type, status] = queryKey;
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: "10",
        ...(search && { search: String(search) }),
        ...(location && { locationId: String(location) }),
        ...(type && { typeId: String(type) }),
        ...(status && { status: String(status) })
      });
      
      const res = await fetch(`${url}?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch licenses');
      return res.json();
    }
  });

  // Fetch compliance stats
  const { data: stats } = useQuery<ComplianceStats>({
    queryKey: ["/api/clinic-licenses/stats"]
  });

  // Fetch locations for dropdown
  const { data: locationsData } = useQuery<{ locations: Location[] }>({
    queryKey: ["/api/locations", { limit: 100 }]
  });

  // Fetch license types for dropdown
  const { data: typesData } = useQuery<{ licenseTypes: LicenseType[] }>({
    queryKey: ["/api/license-types", { limit: 100 }]
  });

  // Fetch responsible persons for dropdown
  const { data: personsData } = useQuery<{ responsiblePersons: ResponsiblePerson[] }>({
    queryKey: ["/api/responsible-persons", { limit: 100 }]
  });

  // Form setup
  const form = useForm<InsertClinicLicense>({
    resolver: zodResolver(insertClinicLicenseSchema),
    defaultValues: {
      locationId: parseInt(locationIdParam || "0") || 0,
      licenseTypeId: 0,
      licenseNumber: "",
      issueDate: new Date().toISOString().split('T')[0],
      expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: "active",
      complianceStatus: "compliant",
      issuingAuthority: "",
      issuingState: "",
      notes: ""
    }
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: InsertClinicLicense) => {
      if (selectedLicense) {
        return apiRequest("PUT", `/api/clinic-licenses/${selectedLicense.id}`, data);
      } else {
        return apiRequest("POST", "/api/clinic-licenses", data);
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: selectedLicense ? "License updated successfully" : "License created successfully"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/clinic-licenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clinic-licenses/stats"] });
      setDialogOpen(false);
      setSelectedLicense(null);
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
    mutationFn: (id: number) => apiRequest("DELETE", `/api/clinic-licenses/${id}`, {}),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "License deleted successfully"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/clinic-licenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clinic-licenses/stats"] });
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

  // Send renewal reminder mutation
  const sendReminderMutation = useMutation({
    mutationFn: (licenseIds: number[]) => apiRequest("POST", "/api/clinic-licenses/send-reminders", { licenseIds }),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Renewal reminders sent successfully"
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleEdit = (license: ClinicLicense) => {
    setSelectedLicense(license);
    form.reset({
      locationId: license.locationId,
      licenseTypeId: license.licenseTypeId,
      licenseNumber: license.licenseNumber,
      primaryResponsibleId: license.primaryResponsibleId || undefined,
      backupResponsibleId: license.backupResponsibleId || undefined,
      issueDate: license.issueDate,
      expirationDate: license.expirationDate,
      renewalDate: license.renewalDate || undefined,
      status: license.status as any,
      renewalStatus: license.renewalStatus as any || undefined,
      complianceStatus: license.complianceStatus as any,
      issuingAuthority: license.issuingAuthority || "",
      issuingState: license.issuingState || "",
      initialCost: license.initialCost ? parseFloat(license.initialCost) : undefined,
      renewalCost: license.renewalCost ? parseFloat(license.renewalCost) : undefined,
      notes: license.notes || "",
      complianceNotes: license.complianceNotes || "",
      renewalNotes: license.renewalNotes || ""
    });
    setDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "destructive" | "secondary" | "outline"; className: string; icon: any }> = {
      active: { variant: "default", className: "bg-green-500 hover:bg-green-600", icon: CheckCircle },
      expiring_soon: { variant: "secondary", className: "bg-yellow-500 hover:bg-yellow-600 text-white", icon: AlertTriangle },
      expired: { variant: "destructive", className: "", icon: XCircle },
      suspended: { variant: "destructive", className: "bg-orange-500 hover:bg-orange-600", icon: AlertTriangle },
      pending_renewal: { variant: "secondary", className: "bg-blue-500 hover:bg-blue-600 text-white", icon: Clock }
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

  const getComplianceStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "destructive" | "secondary" | "outline"; className: string }> = {
      compliant: { variant: "default", className: "bg-green-500 hover:bg-green-600" },
      warning: { variant: "secondary", className: "bg-yellow-500 hover:bg-yellow-600 text-white" },
      non_compliant: { variant: "destructive", className: "" }
    };
    
    const config = variants[status] || { variant: "outline" as const, className: "" };
    
    return (
      <Badge variant={config.variant} className={cn("capitalize", config.className)}>
        {status.replace(/_/g, ' ')}
      </Badge>
    );
  };

  const getDaysUntilExpiration = (expirationDate: string) => {
    const days = differenceInDays(new Date(expirationDate), new Date());
    return days;
  };

  if (error) {
    return (
      <MainLayout>
        <div className="text-center py-8">
          <p className="text-destructive">Failed to load licenses</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground" data-testid="text-licenses-title">Licenses</h1>
            <p className="text-muted-foreground">Manage clinic licenses and compliance tracking</p>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              onClick={() => {
                const expiringLicenses = data?.licenses.filter(l => {
                  const days = getDaysUntilExpiration(l.expirationDate);
                  return days > 0 && days <= 90;
                }).map(l => l.id) || [];
                
                if (expiringLicenses.length > 0) {
                  sendReminderMutation.mutate(expiringLicenses);
                } else {
                  toast({
                    title: "No expiring licenses",
                    description: "No licenses are expiring within the next 90 days"
                  });
                }
              }}
              data-testid="button-send-reminders"
            >
              <Mail className="w-4 h-4 mr-2" />
              Send Renewal Reminders
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={() => {
                    setSelectedLicense(null);
                    form.reset();
                  }}
                  data-testid="button-add-license"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add License
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {selectedLicense ? 'Edit License' : 'Add New License'}
                  </DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit((data) => saveMutation.mutate(data))} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="locationId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Location *</FormLabel>
                            <Select 
                              onValueChange={(value) => field.onChange(parseInt(value))} 
                              value={field.value?.toString()}
                            >
                              <FormControl>
                                <SelectTrigger data-testid="select-location">
                                  <SelectValue placeholder="Select location" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {locationsData?.locations.map((location) => (
                                  <SelectItem key={location.id} value={location.id.toString()}>
                                    {location.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="licenseTypeId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>License Type *</FormLabel>
                            <Select 
                              onValueChange={(value) => field.onChange(parseInt(value))} 
                              value={field.value?.toString()}
                            >
                              <FormControl>
                                <SelectTrigger data-testid="select-license-type">
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {typesData?.licenseTypes.map((type) => (
                                  <SelectItem key={type.id} value={type.id.toString()}>
                                    {type.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="licenseNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>License Number *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="LIC-123456" data-testid="input-license-number" />
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
                            <FormLabel>Issue Date *</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                type="date" 
                                data-testid="input-issue-date"
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
                            <FormLabel>Expiration Date *</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                type="date" 
                                data-testid="input-expiration-date"
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
                        name="primaryResponsibleId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Primary Responsible Person</FormLabel>
                            <Select 
                              onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)} 
                              value={field.value?.toString() || ""}
                            >
                              <FormControl>
                                <SelectTrigger data-testid="select-primary-responsible">
                                  <SelectValue placeholder="Select person" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="">None</SelectItem>
                                {personsData?.responsiblePersons.map((person) => (
                                  <SelectItem key={person.id} value={person.id.toString()}>
                                    {person.firstName} {person.lastName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="backupResponsibleId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Backup Responsible Person</FormLabel>
                            <Select 
                              onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)} 
                              value={field.value?.toString() || ""}
                            >
                              <FormControl>
                                <SelectTrigger data-testid="select-backup-responsible">
                                  <SelectValue placeholder="Select person" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="">None</SelectItem>
                                {personsData?.responsiblePersons.map((person) => (
                                  <SelectItem key={person.id} value={person.id.toString()}>
                                    {person.firstName} {person.lastName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
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
                                <SelectItem value="expiring_soon">Expiring Soon</SelectItem>
                                <SelectItem value="expired">Expired</SelectItem>
                                <SelectItem value="suspended">Suspended</SelectItem>
                                <SelectItem value="revoked">Revoked</SelectItem>
                                <SelectItem value="pending_renewal">Pending Renewal</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="renewalStatus"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Renewal Status</FormLabel>
                            <Select 
                              onValueChange={field.onChange} 
                              value={field.value || ""}
                            >
                              <FormControl>
                                <SelectTrigger data-testid="select-renewal-status">
                                  <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="">None</SelectItem>
                                <SelectItem value="not_started">Not Started</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="submitted">Submitted</SelectItem>
                                <SelectItem value="approved">Approved</SelectItem>
                                <SelectItem value="rejected">Rejected</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="complianceStatus"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Compliance Status</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-compliance-status">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="compliant">Compliant</SelectItem>
                                <SelectItem value="warning">Warning</SelectItem>
                                <SelectItem value="non_compliant">Non-Compliant</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="issuingAuthority"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Issuing Authority</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} placeholder="State Medical Board" data-testid="input-issuing-authority" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="issuingState"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Issuing State</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} placeholder="NY" data-testid="input-issuing-state" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="initialCost"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Initial Cost</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                type="number" 
                                step="0.01"
                                placeholder="500.00" 
                                data-testid="input-initial-cost"
                                onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                                value={field.value || ""}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="renewalCost"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Renewal Cost</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                type="number" 
                                step="0.01"
                                placeholder="250.00" 
                                data-testid="input-renewal-cost"
                                onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                                value={field.value || ""}
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
                              placeholder="General notes..."
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
                      <Button type="submit" disabled={saveMutation.isPending} data-testid="button-save-license">
                        {saveMutation.isPending ? 'Saving...' : selectedLicense ? 'Update' : 'Create'} License
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Licenses</p>
                    <p className="text-2xl font-bold">{stats.total}</p>
                  </div>
                  <Award className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Active</p>
                    <p className="text-2xl font-bold text-green-600">{stats.active}</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Expiring Soon</p>
                    <p className="text-2xl font-bold text-yellow-600">{stats.expiring}</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-yellow-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Expired</p>
                    <p className="text-2xl font-bold text-red-600">{stats.expired}</p>
                  </div>
                  <XCircle className="h-8 w-8 text-red-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Pending Renewal</p>
                    <p className="text-2xl font-bold text-blue-600">{stats.pendingRenewal}</p>
                  </div>
                  <Clock className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search licenses..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-licenses"
                  />
                </div>
              </div>
              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger className="w-[200px]" data-testid="select-filter-location">
                  <SelectValue placeholder="All Locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Locations</SelectItem>
                  {locationsData?.locations.map((location) => (
                    <SelectItem key={location.id} value={location.id.toString()}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[200px]" data-testid="select-filter-type">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Types</SelectItem>
                  {typesData?.licenseTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id.toString()}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]" data-testid="select-filter-status">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="expiring_soon">Expiring Soon</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="pending_renewal">Pending Renewal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Licenses Table */}
        <Card>
          <CardHeader>
            <CardTitle>Licenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>License Number</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Compliance</TableHead>
                    <TableHead>Expiration</TableHead>
                    <TableHead>Responsible</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={8}>
                        <div className="space-y-3">
                          {[...Array(5)].map((_, i) => (
                            <Skeleton key={i} className="h-12 w-full" />
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : data?.licenses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12">
                        <Award className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground mb-4">No licenses found</p>
                        <Button
                          onClick={() => {
                            setSelectedLicense(null);
                            form.reset();
                            setDialogOpen(true);
                          }}
                          data-testid="button-add-first-license"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Your First License
                        </Button>
                      </TableCell>
                    </TableRow>
                  ) : (
                    data?.licenses.map((license) => {
                      const daysUntilExpiration = getDaysUntilExpiration(license.expirationDate);
                      const location = locationsData?.locations.find(l => l.id === license.locationId);
                      const type = typesData?.licenseTypes.find(t => t.id === license.licenseTypeId);
                      const primaryPerson = personsData?.responsiblePersons.find(p => p.id === license.primaryResponsibleId);
                      
                      return (
                        <TableRow key={license.id} data-testid={`license-row-${license.id}`}>
                          <TableCell className="font-medium">{license.licenseNumber}</TableCell>
                          <TableCell>{type?.name || 'Unknown'}</TableCell>
                          <TableCell>{location?.name || 'Unknown'}</TableCell>
                          <TableCell>{getStatusBadge(license.status)}</TableCell>
                          <TableCell>{getComplianceStatusBadge(license.complianceStatus)}</TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="text-sm">{format(new Date(license.expirationDate), 'MMM dd, yyyy')}</div>
                              {daysUntilExpiration <= 90 && daysUntilExpiration > 0 && (
                                <div className="text-xs text-yellow-600 font-medium">
                                  {daysUntilExpiration} days remaining
                                </div>
                              )}
                              {daysUntilExpiration <= 0 && (
                                <div className="text-xs text-red-600 font-medium">
                                  Expired {Math.abs(daysUntilExpiration)} days ago
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {primaryPerson ? (
                              <div className="text-sm">
                                {primaryPerson.firstName} {primaryPerson.lastName}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Unassigned</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => window.location.href = `/compliance-documents?licenseId=${license.id}`}
                                data-testid={`view-documents-${license.id}`}
                              >
                                <FileText className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(license)}
                                data-testid={`edit-license-${license.id}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setDeleteId(license.id)}
                                    data-testid={`delete-license-${license.id}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete License</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete this license? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteId && deleteMutation.mutate(deleteId)}
                                      className="bg-destructive text-destructive-foreground"
                                      data-testid="confirm-delete-license"
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
                  Showing {(page - 1) * 10 + 1} to {Math.min(page * 10, data.total)} of {data.total} licenses
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