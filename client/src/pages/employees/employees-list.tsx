import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmployeesTable } from "@/components/tables/employees-table";
import { SearchFilters } from "@/components/search-filters";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Plus, Search, UserPlus, Mail, Clock, RefreshCw, CheckCircle, XCircle } from "lucide-react";
import { Employee } from "@/lib/types";

/**
 * Response structure for paginated employees API
 */
interface EmployeesResponse {
  employees: Employee[];
  total: number;
  page: number;
  totalPages: number;
}

/**
 * Employee invitation data structure
 */
interface EmployeeInvitation {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  position: string;
  department: string;
  invitationToken: string;
  invitedBy: number;
  invitedAt: string;
  registeredAt: string | null;
  approvedAt: string | null;
  approvedBy: number | null;
  status: 'pending' | 'registered' | 'approved' | 'expired';
  reminderCount: number;
  lastReminderAt: string | null;
  expiresAt: string;
  employeeId: number | null;
}

/**
 * Employee list management page with invitation system and dual-tab interface
 * @component
 * @returns {JSX.Element} Employee list interface with active employees and invitations tabs
 * @example
 * <EmployeesList />
 * 
 * @description
 * - Dual-tab interface: Active Employees and Invitations management
 * - Comprehensive employee filtering by department, status, location, and search
 * - Employee invitation system with email delivery tracking
 * - Invitation status management (pending, registered, approved, expired)
 * - Role-based access control for HR and Admin users
 * - Email delivery failure handling with detailed error messages
 * - Invitation resending capabilities with confirmation dialogs
 * - Paginated employee table with 10 employees per page
 * - Real-time invitation status updates and expiration tracking
 * - Integration with EmployeesTable for detailed employee display
 * - Uses data-testid attributes for comprehensive testing coverage
 */
export default function EmployeesList() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState("active-employees");
  const [filters, setFilters] = useState({
    search: "",
    department: "",
    status: "",
    location: ""
  });
  
  // Invitation-related state
  const [invitationDialogOpen, setInvitationDialogOpen] = useState(false);
  const [resendInvitationId, setResendInvitationId] = useState<number | null>(null);
  const [approveInvitationId, setApproveInvitationId] = useState<number | null>(null);
  const [rejectInvitationId, setRejectInvitationId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [newInvitation, setNewInvitation] = useState({
    email: "",
    firstName: "",
    lastName: "",
    position: "",
    department: "",
    intendedRole: "prospective_employee"  // Default to prospective_employee for invitations
  });

  // Employees Query
  const { data, isLoading, error } = useQuery<EmployeesResponse>({
    queryKey: ["/api/employees", page, filters],
    queryFn: async ({ queryKey }) => {
      const [url, currentPage, currentFilters] = queryKey;
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: "10",
        ...Object.fromEntries(
          Object.entries(currentFilters as any).filter(([_, value]) => value)
        )
      });
      
      const res = await fetch(`${url}?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch employees');
      const json = await res.json();
      
      // Transform middleName from null to undefined to match Employee type
      return {
        ...json,
        employees: json.employees.map((emp: any) => ({
          ...emp,
          middleName: emp.middleName === null ? undefined : emp.middleName
        }))
      };
    }
  });

  // Employee Invitations Query
  const { data: invitations = [], isLoading: invitationsLoading } = useQuery<EmployeeInvitation[]>({
    queryKey: ["/api/invitations"],
    enabled: user?.role === 'admin' || user?.role === 'hr'
  });

  // Send Invitation Mutation
  const sendInvitationMutation = useMutation({
    mutationFn: (invitationData: typeof newInvitation) => 
      apiRequest("POST", "/api/invitations", invitationData),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Invitation created and email sent successfully"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/invitations"] });
      setInvitationDialogOpen(false);
      setNewInvitation({
        email: "",
        firstName: "",
        lastName: "",
        position: "",
        department: "",
        intendedRole: "prospective_employee"
      });
    },
    onError: (error) => {
      // Parse error message to check if it's an email failure (400 error)
      let errorMessage = error.message;
      let isEmailFailure = false;
      
      try {
        // Extract status code and response body from error message
        const statusMatch = error.message.match(/^(\d+):\s*(.+)$/);
        if (statusMatch) {
          const statusCode = parseInt(statusMatch[1]);
          const responseBody = statusMatch[2];
          
          if (statusCode === 400) {
            try {
              const errorData = JSON.parse(responseBody);
              if (errorData.error === "Failed to send invitation email" && errorData.invitation) {
                // This is an email failure - invitation was created but email failed
                isEmailFailure = true;
                errorMessage = errorData.invitation.note || 
                  "Invitation created but email failed to send. You can resend from the employee list.";
              } else {
                // Other 400 error (validation, duplicate email, etc.)
                errorMessage = errorData.error || responseBody;
              }
            } catch {
              // Failed to parse JSON, use the response body as-is
              errorMessage = responseBody;
            }
          }
        }
      } catch {
        // If parsing fails, use original error message
        errorMessage = error.message;
      }

      toast({
        title: isEmailFailure ? "Email Delivery Failed" : "Error",
        description: errorMessage,
        variant: "destructive"
      });

      // If invitation was created despite email failure, refresh the invitations list
      if (isEmailFailure) {
        queryClient.invalidateQueries({ queryKey: ["/api/invitations"] });
        setInvitationDialogOpen(false);
        setNewInvitation({
          email: "",
          firstName: "",
          lastName: "",
          position: "",
          department: "",
          intendedRole: "prospective_employee"
        });
      }
    }
  });

  // Approve Employee Mutation
  const approveEmployeeMutation = useMutation({
    mutationFn: (employeeId: number) => 
      apiRequest("POST", `/api/employees/${employeeId}/approve`, {}),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Employee approved successfully"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/invitations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setApproveInvitationId(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve employee",
        variant: "destructive"
      });
      setApproveInvitationId(null);
    }
  });

  // Reject Employee Mutation
  const rejectEmployeeMutation = useMutation({
    mutationFn: ({ employeeId, reason }: { employeeId: number; reason: string }) => 
      apiRequest("POST", `/api/employees/${employeeId}/reject`, { reason }),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Employee application rejected"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/invitations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setRejectInvitationId(null);
      setRejectionReason("");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reject employee",
        variant: "destructive"
      });
      setRejectInvitationId(null);
    }
  });

  // Resend Invitation Mutation
  const resendInvitationMutation = useMutation({
    mutationFn: (invitationId: number) => 
      apiRequest("POST", `/api/invitations/${invitationId}/resend`, {}),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Invitation resent and email delivered successfully"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/invitations"] });
      setResendInvitationId(null);
    },
    onError: (error) => {
      // Parse error message to check if it's an email failure (400 error)
      let errorMessage = error.message;
      let isEmailFailure = false;
      
      try {
        // Extract status code and response body from error message
        const statusMatch = error.message.match(/^(\d+):\s*(.+)$/);
        if (statusMatch) {
          const statusCode = parseInt(statusMatch[1]);
          const responseBody = statusMatch[2];
          
          if (statusCode === 400) {
            try {
              const errorData = JSON.parse(responseBody);
              if (errorData.error === "Failed to send invitation email" && errorData.invitation) {
                // This is an email failure - invitation exists but email failed
                isEmailFailure = true;
                errorMessage = "Failed to send invitation email. Please check your email configuration or try again later.";
              } else {
                // Other 400 error (validation, expired invitation, etc.)
                errorMessage = errorData.error || responseBody;
              }
            } catch {
              // Failed to parse JSON, use the response body as-is
              errorMessage = responseBody;
            }
          }
        }
      } catch {
        // If parsing fails, use original error message
        errorMessage = error.message;
      }

      toast({
        title: isEmailFailure ? "Email Delivery Failed" : "Error",
        description: errorMessage,
        variant: "destructive"
      });
      
      setResendInvitationId(null);
    }
  });

  /**
   * Updates filter state and resets pagination to first page
   * @param {string} key - Filter property to update
   * @param {string} value - New filter value
   */
  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1); // Reset to first page when filtering
  };

  /**
   * Handles sending a new employee invitation
   * @description Validates form data and sends invitation email
   */
  const handleSendInvitation = () => {
    sendInvitationMutation.mutate(newInvitation);
  };

  /**
   * Handles resending an existing invitation
   * @param {number} invitationId - ID of invitation to resend
   */
  const handleResendInvitation = (invitationId: number) => {
    resendInvitationMutation.mutate(invitationId);
  };

  /**
   * Handles approving a prospective employee
   * @param {number} employeeId - ID of employee to approve
   */
  const handleApproveEmployee = (employeeId: number) => {
    approveEmployeeMutation.mutate(employeeId);
  };

  /**
   * Handles rejecting a prospective employee
   * @param {number} employeeId - ID of employee to reject
   */
  const handleRejectEmployee = (employeeId: number) => {
    if (!rejectionReason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a reason for rejection",
        variant: "destructive"
      });
      return;
    }
    rejectEmployeeMutation.mutate({ employeeId, reason: rejectionReason });
  };

  /**
   * Returns styled badge component based on invitation status
   * @param {string} status - Invitation status (pending, registered, approved, expired)
   * @returns {JSX.Element} Styled status badge with appropriate colors
   */
  const getInvitationStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400">Pending</Badge>;
      case 'registered':
        return <Badge className="bg-blue-500/10 text-blue-700 dark:text-blue-400">Registered</Badge>;
      case 'approved':
        return <Badge className="bg-green-500/10 text-green-700 dark:text-green-400">Approved</Badge>;
      case 'expired':
        return <Badge className="bg-destructive/10 text-destructive">Expired</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (error) {
    return (
      <MainLayout>
        <div className="text-center py-8">
          <p className="text-destructive">Failed to load employees</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground" data-testid="text-employees-title">Employees</h1>
            <p className="text-muted-foreground">Manage medical staff employee records</p>
          </div>
          <div className="flex space-x-2">
            {/* Send Invitation Button */}
            {(user?.role === 'admin' || user?.role === 'hr') && (
              <Dialog open={invitationDialogOpen} onOpenChange={setInvitationDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" data-testid="button-send-invitation">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Send Invitation
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Send Employee Invitation</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="invitation-email">Email</Label>
                      <Input
                        id="invitation-email"
                        type="email"
                        value={newInvitation.email}
                        onChange={(e) => setNewInvitation(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="employee@example.com"
                        data-testid="input-invitation-email"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="invitation-firstName">First Name</Label>
                        <Input
                          id="invitation-firstName"
                          value={newInvitation.firstName}
                          onChange={(e) => setNewInvitation(prev => ({ ...prev, firstName: e.target.value }))}
                          placeholder="John"
                          data-testid="input-invitation-firstName"
                        />
                      </div>
                      <div>
                        <Label htmlFor="invitation-lastName">Last Name</Label>
                        <Input
                          id="invitation-lastName"
                          value={newInvitation.lastName}
                          onChange={(e) => setNewInvitation(prev => ({ ...prev, lastName: e.target.value }))}
                          placeholder="Doe"
                          data-testid="input-invitation-lastName"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="invitation-position">Position</Label>
                      <Input
                        id="invitation-position"
                        value={newInvitation.position}
                        onChange={(e) => setNewInvitation(prev => ({ ...prev, position: e.target.value }))}
                        placeholder="Physician"
                        data-testid="input-invitation-position"
                      />
                    </div>
                    <div>
                      <Label htmlFor="invitation-department">Department</Label>
                      <Input
                        id="invitation-department"
                        value={newInvitation.department}
                        onChange={(e) => setNewInvitation(prev => ({ ...prev, department: e.target.value }))}
                        placeholder="Emergency Medicine"
                        data-testid="input-invitation-department"
                      />
                    </div>
                    <div>
                      <Label htmlFor="invitation-role">Role</Label>
                      <Select
                        value={newInvitation.intendedRole}
                        onValueChange={(value) => setNewInvitation(prev => ({ ...prev, intendedRole: value }))}
                      >
                        <SelectTrigger id="invitation-role" data-testid="select-invitation-role">
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                        <SelectContent>
                          {user?.role === "admin" && (
                            <>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="hr">HR</SelectItem>
                            </>
                          )}
                          <SelectItem value="viewer">Viewer</SelectItem>
                          <SelectItem value="prospective_employee">Prospective Employee</SelectItem>
                        </SelectContent>
                      </Select>
                      {(user?.role === "hr" || user?.role === "admin") && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Prospective employees will need approval after registration
                        </p>
                      )}
                    </div>
                    <Button 
                      onClick={handleSendInvitation}
                      disabled={sendInvitationMutation.isPending || !newInvitation.email || !newInvitation.firstName || !newInvitation.lastName}
                      className="w-full"
                      data-testid="button-submit-invitation"
                    >
                      <Mail className="w-4 h-4 mr-2" />
                      {sendInvitationMutation.isPending ? "Sending..." : "Send Invitation"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
            
            {/* Add Employee Button */}
            <Link href="/employees/new">
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90" data-testid="button-add-employee">
                <Plus className="w-4 h-4 mr-2" />
                Add Employee
              </Button>
            </Link>
          </div>
        </div>

        {/* Tabs for Active Employees and Invitations */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-[400px] grid-cols-2">
            <TabsTrigger value="active-employees" data-testid="tab-active-employees">Active Employees</TabsTrigger>
            {(user?.role === 'admin' || user?.role === 'hr') && (
              <TabsTrigger value="invitations" data-testid="tab-invitations">Invitations</TabsTrigger>
            )}
          </TabsList>
          
          {/* Active Employees Tab */}
          <TabsContent value="active-employees" className="mt-6">
            {/* Search and Filters */}
            <SearchFilters
              filters={filters}
              onFilterChange={handleFilterChange}
              filterOptions={{
                departments: [
                  { value: "", label: "All Departments" },
                  { value: "Emergency Medicine", label: "Emergency Medicine" },
                  { value: "Internal Medicine", label: "Internal Medicine" },
                  { value: "Pediatrics", label: "Pediatrics" },
                  { value: "Surgery", label: "Surgery" }
                ],
                statuses: [
                  { value: "", label: "All Statuses" },
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Inactive" },
                  { value: "on_leave", label: "On Leave" }
                ],
                locations: [
                  { value: "", label: "All Locations" },
                  { value: "Main Hospital", label: "Main Hospital" },
                  { value: "North Clinic", label: "North Clinic" },
                  { value: "South Clinic", label: "South Clinic" }
                ]
              }}
              data-testid="search-filters"
            />

            {/* Employees Table */}
            <div className="mt-6">
              <EmployeesTable
                employees={data?.employees || []}
                total={data?.total || 0}
                page={page}
                totalPages={data?.totalPages || 0}
                onPageChange={setPage}
                isLoading={isLoading}
                data-testid="employees-table"
              />
            </div>
          </TabsContent>
          
          {/* Invitations Tab */}
          {(user?.role === 'admin' || user?.role === 'hr') && (
            <TabsContent value="invitations" className="mt-6">
              <div className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h3 className="font-medium mb-2 flex items-center">
                    <Mail className="w-4 h-4 mr-2" />
                    Pending Employee Invitations
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Track and manage employee invitations sent via email. Invitations expire after 7 days.
                  </p>
                </div>
                
                {invitationsLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : invitations.length > 0 ? (
                  <div className="rounded-lg border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Position</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Invited</TableHead>
                          <TableHead>Expires</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invitations.map((invitation) => (
                          <TableRow key={invitation.id}>
                            <TableCell className="font-medium">
                              {invitation.firstName} {invitation.lastName}
                            </TableCell>
                            <TableCell>{invitation.email}</TableCell>
                            <TableCell>{invitation.position}</TableCell>
                            <TableCell>{invitation.department}</TableCell>
                            <TableCell>{getInvitationStatusBadge(invitation.status)}</TableCell>
                            <TableCell className="text-sm">
                              {new Date(invitation.invitedAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-sm">
                              <div className="flex items-center">
                                <Clock className="w-3 h-3 mr-1 text-muted-foreground" />
                                {new Date(invitation.expiresAt).toLocaleDateString()}
                              </div>
                            </TableCell>
                            <TableCell>
                              {invitation.status === 'pending' && (
                                <>
                                  <AlertDialog open={resendInvitationId === invitation.id} onOpenChange={(open) => !open && setResendInvitationId(null)}>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        disabled={resendInvitationMutation.isPending}
                                        data-testid={`button-resend-invitation-${invitation.id}`}
                                      >
                                        <RefreshCw className="w-4 h-4 mr-1" />
                                        Resend
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Resend Invitation?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          This will send a new invitation email to {invitation.email}. The invitation will be valid for another 7 days.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleResendInvitation(invitation.id)}>
                                          Resend Invitation
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </>
                              )}
                              {invitation.status === 'registered' && (
                                <div className="flex items-center gap-2">
                                  {/* Approve Button with Confirmation */}
                                  <AlertDialog open={approveInvitationId === invitation.id} onOpenChange={(open) => !open && setApproveInvitationId(null)}>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                        disabled={approveEmployeeMutation.isPending || rejectEmployeeMutation.isPending}
                                        data-testid={`button-approve-${invitation.id}`}
                                        onClick={() => setApproveInvitationId(invitation.id)}
                                      >
                                        <CheckCircle className="w-4 h-4 mr-1" />
                                        Approve
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Approve Employee?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          This will approve <strong>{invitation.firstName} {invitation.lastName}</strong> and grant them full employee access.
                                          They will be changed from a prospective employee to an active employee.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction 
                                          onClick={() => handleApproveEmployee(invitation.employeeId!)}
                                          className="bg-green-600 hover:bg-green-700"
                                        >
                                          Approve Employee
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>

                                  {/* Reject Button with Confirmation */}
                                  <AlertDialog open={rejectInvitationId === invitation.id} onOpenChange={(open) => {
                                    if (!open) {
                                      setRejectInvitationId(null);
                                      setRejectionReason("");
                                    }
                                  }}>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                        disabled={approveEmployeeMutation.isPending || rejectEmployeeMutation.isPending}
                                        data-testid={`button-reject-${invitation.id}`}
                                        onClick={() => setRejectInvitationId(invitation.id)}
                                      >
                                        <XCircle className="w-4 h-4 mr-1" />
                                        Reject
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Reject Employee Application?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          This will reject <strong>{invitation.firstName} {invitation.lastName}</strong>'s employee application.
                                          Please provide a reason for the rejection.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <div className="my-4">
                                        <Label htmlFor="rejection-reason">Rejection Reason</Label>
                                        <Input
                                          id="rejection-reason"
                                          placeholder="Enter reason for rejection..."
                                          value={rejectionReason}
                                          onChange={(e) => setRejectionReason(e.target.value)}
                                          className="mt-2"
                                          data-testid="input-rejection-reason"
                                        />
                                      </div>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction 
                                          onClick={() => handleRejectEmployee(invitation.employeeId!)}
                                          className="bg-destructive hover:bg-destructive/90"
                                          disabled={!rejectionReason.trim()}
                                        >
                                          Reject Application
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              )}
                              {invitation.status === 'approved' && (
                                <span className="text-sm text-green-600">✓ Active</span>
                              )}
                              {invitation.status === 'expired' && (
                                <span className="text-sm text-destructive">Expired</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Mail className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No pending invitations</p>
                    <p className="text-sm mt-1">Send an invitation to add new employees</p>
                  </div>
                )}
                
                {invitations.length > 0 && (
                  <div className="text-sm text-muted-foreground">
                    <p>• Invitations are valid for 7 days from the time they are sent</p>
                    <p>• Employees must register using the invitation link before it expires</p>
                    <p>• After registration, HR or Admin approval is required to activate the account</p>
                  </div>
                )}
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </MainLayout>
  );
}
