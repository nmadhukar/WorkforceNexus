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
import { insertLicenseTypeSchema, type LicenseType, type InsertLicenseType } from "@shared/schema";
import { Award, Building2, Pill, Briefcase, Package, Plus, Edit, Trash2, Search, AlertTriangle, Clock, FileText, CheckCircle, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface LicenseTypesResponse {
  licenseTypes: LicenseType[];
  total: number;
  page: number;
  totalPages: number;
}

export default function LicenseTypesPage() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [selectedType, setSelectedType] = useState<LicenseType | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Fetch license types
  const { data, isLoading, error } = useQuery<LicenseTypesResponse>({
    queryKey: ["/api/license-types", page, searchQuery, categoryFilter],
    queryFn: async ({ queryKey }) => {
      const [url, currentPage, search, category] = queryKey;
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: "20",
        ...(search && { search: String(search) }),
        ...(category && { category: String(category) })
      });
      
      const res = await fetch(`${url}?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch license types');
      return res.json();
    }
  });

  // Form setup
  const form = useForm<InsertLicenseType>({
    resolver: zodResolver(insertLicenseTypeSchema),
    defaultValues: {
      name: "",
      code: "",
      category: "medical",
      description: "",
      issuingAuthority: "",
      renewalPeriodMonths: 24,
      leadTimeDays: 90,
      appliesToLocation: false,
      appliesToProvider: true,
      appliesToEquipment: false,
      requiredDocuments: [],
      requiresInspection: false,
      requiresTraining: false,
      isCritical: false,
      alertDaysBefore: 60,
      escalationDaysBefore: 30,
      isActive: true,
      sortOrder: 0
    }
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: InsertLicenseType) => {
      if (selectedType) {
        return apiRequest("PUT", `/api/license-types/${selectedType.id}`, data);
      } else {
        return apiRequest("POST", "/api/license-types", data);
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: selectedType ? "License type updated successfully" : "License type created successfully"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/license-types"] });
      setDialogOpen(false);
      setSelectedType(null);
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
    mutationFn: (id: number) => apiRequest("DELETE", `/api/license-types/${id}`, {}),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "License type deleted successfully"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/license-types"] });
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

  const handleEdit = (type: LicenseType) => {
    setSelectedType(type);
    form.reset({
      name: type.name,
      code: type.code,
      category: type.category as any,
      description: type.description || "",
      issuingAuthority: type.issuingAuthority || "",
      renewalPeriodMonths: type.renewalPeriodMonths || 24,
      leadTimeDays: type.leadTimeDays || 90,
      appliesToLocation: type.appliesToLocation,
      appliesToProvider: type.appliesToProvider,
      appliesToEquipment: type.appliesToEquipment,
      requiredDocuments: type.requiredDocuments || [],
      requiresInspection: type.requiresInspection || false,
      requiresTraining: type.requiresTraining || false,
      isCritical: type.isCritical,
      alertDaysBefore: type.alertDaysBefore || 60,
      escalationDaysBefore: type.escalationDaysBefore || 30,
      isActive: type.isActive,
      sortOrder: type.sortOrder || 0
    });
    setDialogOpen(true);
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, any> = {
      medical: Award,
      pharmacy: Pill,
      facility: Building2,
      business: Briefcase,
      other: Package
    };
    const Icon = icons[category] || Package;
    return <Icon className="h-4 w-4" />;
  };

  const getCategoryBadge = (category: string) => {
    const colors: Record<string, string> = {
      medical: "bg-blue-500 hover:bg-blue-600",
      pharmacy: "bg-purple-500 hover:bg-purple-600",
      facility: "bg-green-500 hover:bg-green-600",
      business: "bg-orange-500 hover:bg-orange-600",
      other: "bg-gray-500 hover:bg-gray-600"
    };
    
    return (
      <Badge className={cn("capitalize text-white", colors[category] || colors.other)}>
        {getCategoryIcon(category)}
        <span className="ml-1">{category}</span>
      </Badge>
    );
  };

  if (error) {
    return (
      <MainLayout>
        <div className="text-center py-8">
          <p className="text-destructive">Failed to load license types</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground" data-testid="text-license-types-title">License Types</h1>
            <p className="text-muted-foreground">Manage master list of license types and requirements</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => {
                  setSelectedType(null);
                  form.reset();
                }}
                data-testid="button-add-license-type"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add License Type
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {selectedType ? 'Edit License Type' : 'Add New License Type'}
                </DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit((data) => saveMutation.mutate(data))} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Medical License" data-testid="input-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Code *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="MED_LIC" data-testid="input-code" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-category">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="medical">Medical</SelectItem>
                            <SelectItem value="pharmacy">Pharmacy</SelectItem>
                            <SelectItem value="facility">Facility</SelectItem>
                            <SelectItem value="business">Business</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            value={field.value || ""}
                            placeholder="Detailed description of the license type..."
                            rows={3}
                            data-testid="textarea-description"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="issuingAuthority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Issuing Authority</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            value={field.value || ""}
                            placeholder="State Medical Board" 
                            data-testid="input-issuing-authority"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-4">
                    <h3 className="text-sm font-medium">Renewal Configuration</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="renewalPeriodMonths"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Renewal Period (months)</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                type="number" 
                                data-testid="input-renewal-period"
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                value={field.value || 0}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="leadTimeDays"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Lead Time (days)</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                type="number" 
                                data-testid="input-lead-time"
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                value={field.value || 0}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="sortOrder"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Sort Order</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                type="number" 
                                data-testid="input-sort-order"
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                value={field.value || 0}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-medium">Applicability</h3>
                    <div className="space-y-3">
                      <FormField
                        control={form.control}
                        name="appliesToLocation"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2">
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-applies-location"
                              />
                            </FormControl>
                            <FormLabel className="!mt-0">Applies to Locations</FormLabel>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="appliesToProvider"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2">
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-applies-provider"
                              />
                            </FormControl>
                            <FormLabel className="!mt-0">Applies to Providers</FormLabel>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="appliesToEquipment"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2">
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-applies-equipment"
                              />
                            </FormControl>
                            <FormLabel className="!mt-0">Applies to Equipment</FormLabel>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-medium">Requirements</h3>
                    <div className="space-y-3">
                      <FormField
                        control={form.control}
                        name="requiresInspection"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2">
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-requires-inspection"
                              />
                            </FormControl>
                            <FormLabel className="!mt-0">Requires Inspection</FormLabel>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="requiresTraining"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2">
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-requires-training"
                              />
                            </FormControl>
                            <FormLabel className="!mt-0">Requires Training</FormLabel>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="isCritical"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2">
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-is-critical"
                              />
                            </FormControl>
                            <FormLabel className="!mt-0">Critical for Operations</FormLabel>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="isActive"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2">
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-is-active"
                              />
                            </FormControl>
                            <FormLabel className="!mt-0">Active</FormLabel>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-medium">Alert Settings</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="alertDaysBefore"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Alert Days Before Expiration</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                type="number" 
                                data-testid="input-alert-days"
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                value={field.value || 0}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="escalationDaysBefore"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Escalation Days Before Expiration</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                type="number" 
                                data-testid="input-escalation-days"
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                value={field.value || 0}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={saveMutation.isPending} data-testid="button-save-license-type">
                      {saveMutation.isPending ? 'Saving...' : selectedType ? 'Update' : 'Create'} License Type
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Category Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {['medical', 'pharmacy', 'facility', 'business', 'other'].map((category) => {
            const count = data?.licenseTypes.filter(t => t.category === category).length || 0;
            const Icon = category === 'medical' ? Award :
                        category === 'pharmacy' ? Pill :
                        category === 'facility' ? Building2 :
                        category === 'business' ? Briefcase : Package;
            
            return (
              <Card key={category} className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => setCategoryFilter(category === categoryFilter ? "" : category)}
                    data-testid={`card-category-${category}`}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground capitalize">{category}</p>
                      <p className="text-2xl font-bold">{count}</p>
                    </div>
                    <Icon className="h-8 w-8 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search license types..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-license-types"
                  />
                </div>
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[180px]" data-testid="select-filter-category">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="medical">Medical</SelectItem>
                  <SelectItem value="pharmacy">Pharmacy</SelectItem>
                  <SelectItem value="facility">Facility</SelectItem>
                  <SelectItem value="business">Business</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* License Types Table */}
        <Card>
          <CardHeader>
            <CardTitle>License Types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Renewal Period</TableHead>
                    <TableHead>Applies To</TableHead>
                    <TableHead>Requirements</TableHead>
                    <TableHead>Status</TableHead>
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
                  ) : data?.licenseTypes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12">
                        <Award className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground mb-4">No license types found</p>
                        <Button
                          onClick={() => {
                            setSelectedType(null);
                            form.reset();
                            setDialogOpen(true);
                          }}
                          data-testid="button-add-first-license-type"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Your First License Type
                        </Button>
                      </TableCell>
                    </TableRow>
                  ) : (
                    data?.licenseTypes.map((type) => (
                      <TableRow key={type.id} data-testid={`license-type-row-${type.id}`}>
                        <TableCell className="font-medium">
                          <div>
                            <div>{type.name}</div>
                            {type.isCritical && (
                              <Badge variant="destructive" className="text-xs mt-1">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Critical
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{type.code}</TableCell>
                        <TableCell>{getCategoryBadge(type.category)}</TableCell>
                        <TableCell>
                          {type.renewalPeriodMonths ? `${type.renewalPeriodMonths} months` : 'N/A'}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {type.appliesToLocation && (
                              <Badge variant="outline" className="text-xs">
                                <Building2 className="h-3 w-3 mr-1" />
                                Locations
                              </Badge>
                            )}
                            {type.appliesToProvider && (
                              <Badge variant="outline" className="text-xs">
                                <Users className="h-3 w-3 mr-1" />
                                Providers
                              </Badge>
                            )}
                            {type.appliesToEquipment && (
                              <Badge variant="outline" className="text-xs">
                                <Package className="h-3 w-3 mr-1" />
                                Equipment
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {type.requiresInspection && (
                              <Badge variant="secondary" className="text-xs">
                                Inspection
                              </Badge>
                            )}
                            {type.requiresTraining && (
                              <Badge variant="secondary" className="text-xs">
                                Training
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={type.isActive ? "default" : "secondary"}
                            className={cn(
                              type.isActive && "bg-green-500 hover:bg-green-600"
                            )}
                          >
                            {type.isActive ? (
                              <>
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Active
                              </>
                            ) : (
                              'Inactive'
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(type)}
                              data-testid={`edit-license-type-${type.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDeleteId(type.id)}
                                  data-testid={`delete-license-type-${type.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete License Type</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this license type? This may affect existing licenses using this type.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteId && deleteMutation.mutate(deleteId)}
                                    className="bg-destructive text-destructive-foreground"
                                    data-testid="confirm-delete-license-type"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {data && data.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, data.total)} of {data.total} types
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