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
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertLocationSchema, type Location, type InsertLocation } from "@shared/schema";
import { Building2, MapPin, Phone, Mail, Plus, Edit, Trash2, ChevronRight, FileText, Shield, Users, Search, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface LocationsResponse {
  locations: Location[];
  total: number;
  page: number;
  totalPages: number;
}

interface LocationTreeNode extends Location {
  children: LocationTreeNode[];
  expanded?: boolean;
}

export default function LocationsPage() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());

  // Fetch locations
  const { data, isLoading, error } = useQuery<LocationsResponse>({
    queryKey: ["/api/locations", page, searchQuery, statusFilter],
    queryFn: async ({ queryKey }) => {
      const [url, currentPage, search, status] = queryKey;
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: "50",
        ...(search && { search: String(search) }),
        ...(status && { status: String(status) })
      });
      
      const res = await fetch(`${url}?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch locations');
      return res.json();
    }
  });

  // Form setup
  const form = useForm<InsertLocation>({
    resolver: zodResolver(insertLocationSchema),
    defaultValues: {
      name: "",
      code: "",
      type: "sub_location",
      parentId: undefined,
      address1: "",
      address2: "",
      city: "",
      state: "",
      zipCode: "",
      country: "USA",
      phone: "",
      fax: "",
      email: "",
      website: "",
      taxId: "",
      npiNumber: "",
      status: "active",
      isComplianceRequired: true,
      complianceNotes: ""
    }
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: InsertLocation) => {
      if (selectedLocation) {
        return apiRequest("PUT", `/api/locations/${selectedLocation.id}`, data);
      } else {
        return apiRequest("POST", "/api/locations", data);
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: selectedLocation ? "Location updated successfully" : "Location created successfully"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      setDialogOpen(false);
      setSelectedLocation(null);
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
    mutationFn: (id: number) => apiRequest("DELETE", `/api/locations/${id}`, {}),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Location deleted successfully"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
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

  // Build tree structure from flat list
  const buildLocationTree = (locations: Location[]): LocationTreeNode[] => {
    const locationMap = new Map<number, LocationTreeNode>();
    const rootNodes: LocationTreeNode[] = [];

    // First pass: create all nodes
    locations.forEach(location => {
      locationMap.set(location.id, { ...location, children: [] });
    });

    // Second pass: build tree structure
    locations.forEach(location => {
      const node = locationMap.get(location.id)!;
      if (location.parentId) {
        const parent = locationMap.get(location.parentId);
        if (parent) {
          parent.children.push(node);
        } else {
          rootNodes.push(node);
        }
      } else {
        rootNodes.push(node);
      }
    });

    return rootNodes;
  };

  const toggleNode = (nodeId: number) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const handleEdit = (location: Location) => {
    setSelectedLocation(location);
    form.reset({
      name: location.name,
      code: location.code || "",
      type: location.type as any,
      parentId: location.parentId || undefined,
      address1: location.address1 || "",
      address2: location.address2 || "",
      city: location.city || "",
      state: location.state || "",
      zipCode: location.zipCode || "",
      country: location.country || "USA",
      phone: location.phone || "",
      fax: location.fax || "",
      email: location.email || "",
      website: location.website || "",
      taxId: location.taxId || "",
      npiNumber: location.npiNumber || "",
      status: location.status as any,
      isComplianceRequired: location.isComplianceRequired,
      complianceNotes: location.complianceNotes || ""
    });
    setDialogOpen(true);
  };

  const handleAddSubLocation = (parentId: number) => {
    setSelectedLocation(null);
    form.reset({
      ...form.getValues(),
      parentId
    });
    setDialogOpen(true);
  };

  const renderLocationNode = (node: LocationTreeNode, level: number = 0) => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    
    return (
      <div key={node.id} data-testid={`location-node-${node.id}`}>
        <div
          className={cn(
            "flex items-center justify-between py-3 px-4 hover:bg-muted/50 rounded-lg transition-colors",
            level > 0 && "ml-8"
          )}
        >
          <div className="flex items-center space-x-3 flex-1">
            {hasChildren && (
              <Button
                variant="ghost"
                size="sm"
                className="p-0 h-6 w-6"
                onClick={() => toggleNode(node.id)}
                data-testid={`toggle-location-${node.id}`}
              >
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            )}
            {!hasChildren && <div className="w-6" />}
            
            <div className="flex items-center space-x-3">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-medium" data-testid={`location-name-${node.id}`}>{node.name}</span>
                  {node.code && (
                    <Badge variant="outline" className="text-xs">
                      {node.code}
                    </Badge>
                  )}
                  <Badge
                    variant={node.status === 'active' ? 'default' : 'secondary'}
                    className={cn(
                      "text-xs",
                      node.status === 'active' && "bg-green-500 hover:bg-green-600",
                      node.status === 'inactive' && "bg-gray-500 hover:bg-gray-600",
                      node.status === 'suspended' && "bg-yellow-500 hover:bg-yellow-600"
                    )}
                  >
                    {node.status}
                  </Badge>
                  {node.isComplianceRequired && (
                    <Badge variant="outline" className="text-xs text-primary">
                      <Shield className="h-3 w-3 mr-1" />
                      Compliance Required
                    </Badge>
                  )}
                </div>
                <div className="flex items-center space-x-4 mt-1 text-sm text-muted-foreground">
                  {node.city && node.state && (
                    <span className="flex items-center">
                      <MapPin className="h-3 w-3 mr-1" />
                      {node.city}, {node.state}
                    </span>
                  )}
                  {node.phone && (
                    <span className="flex items-center">
                      <Phone className="h-3 w-3 mr-1" />
                      {node.phone}
                    </span>
                  )}
                  {node.email && (
                    <span className="flex items-center">
                      <Mail className="h-3 w-3 mr-1" />
                      {node.email}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.location.href = `/licenses?locationId=${node.id}`}
              data-testid={`view-licenses-${node.id}`}
            >
              <FileText className="h-4 w-4 mr-1" />
              Licenses
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.location.href = `/compliance-documents?locationId=${node.id}`}
              data-testid={`view-documents-${node.id}`}
            >
              <FileText className="h-4 w-4 mr-1" />
              Documents
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleAddSubLocation(node.id)}
              data-testid={`add-sublocation-${node.id}`}
            >
              <Plus className="h-4 w-4 mr-1" />
              Sub-location
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleEdit(node)}
              data-testid={`edit-location-${node.id}`}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleteId(node.id)}
                  data-testid={`delete-location-${node.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Location</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this location? This will also delete all sub-locations and associated data.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteId && deleteMutation.mutate(deleteId)}
                    className="bg-destructive text-destructive-foreground"
                    data-testid="confirm-delete-location"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="mt-1">
            {node.children.map(child => renderLocationNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const locationTree = data ? buildLocationTree(data.locations) : [];

  if (error) {
    return (
      <MainLayout>
        <div className="text-center py-8">
          <p className="text-destructive">Failed to load locations</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground" data-testid="text-locations-title">Locations</h1>
            <p className="text-muted-foreground">Manage clinic locations and their hierarchy</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => {
                  setSelectedLocation(null);
                  form.reset();
                }}
                data-testid="button-add-location"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Location
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {selectedLocation ? 'Edit Location' : 'Add New Location'}
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
                          <FormLabel>Location Name *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Main Clinic" data-testid="input-location-name" />
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
                          <FormLabel>Location Code</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} placeholder="MC-001" data-testid="input-location-code" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Location Type *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-location-type">
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="main_org">Main Organization</SelectItem>
                              <SelectItem value="sub_location">Sub Location</SelectItem>
                              <SelectItem value="department">Department</SelectItem>
                              <SelectItem value="facility">Facility</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-location-status">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="inactive">Inactive</SelectItem>
                              <SelectItem value="suspended">Suspended</SelectItem>
                              <SelectItem value="closed">Closed</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-medium">Address Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="address1"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Address Line 1</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} placeholder="123 Main St" data-testid="input-address1" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="address2"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Address Line 2</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} placeholder="Suite 100" data-testid="input-address2" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="city"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>City</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} placeholder="New York" data-testid="input-city" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="state"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>State</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} placeholder="NY" data-testid="input-state" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="zipCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>ZIP Code</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} placeholder="10001" data-testid="input-zip" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-medium">Contact Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} placeholder="(555) 123-4567" data-testid="input-phone" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="fax"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Fax</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} placeholder="(555) 123-4568" data-testid="input-fax" />
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
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} type="email" placeholder="contact@clinic.com" data-testid="input-email" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="website"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Website</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} placeholder="https://clinic.com" data-testid="input-website" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-medium">Compliance Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="taxId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tax ID / EIN</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} placeholder="12-3456789" data-testid="input-tax-id" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="npiNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>NPI Number</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} placeholder="1234567890" data-testid="input-npi" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="isComplianceRequired"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2">
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={field.value}
                              onChange={field.onChange}
                              className="h-4 w-4"
                              data-testid="checkbox-compliance-required"
                            />
                          </FormControl>
                          <FormLabel className="!mt-0 cursor-pointer">Compliance tracking required</FormLabel>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="complianceNotes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Compliance Notes</FormLabel>
                          <FormControl>
                            <Textarea 
                              {...field} 
                              value={field.value || ""}
                              placeholder="Special compliance requirements or notes..."
                              rows={3}
                              data-testid="textarea-compliance-notes"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={saveMutation.isPending} data-testid="button-save-location">
                      {saveMutation.isPending ? 'Saving...' : selectedLocation ? 'Update' : 'Create'} Location
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search locations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-locations"
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
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Locations Tree View */}
        <Card>
          <CardHeader>
            <CardTitle>Location Hierarchy</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : locationTree.length > 0 ? (
              <ScrollArea className="h-[600px]">
                <div className="space-y-1">
                  {locationTree.map(node => renderLocationNode(node))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-12">
                <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No locations found</p>
                <Button
                  onClick={() => {
                    setSelectedLocation(null);
                    form.reset();
                    setDialogOpen(true);
                  }}
                  data-testid="button-add-first-location"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Location
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}