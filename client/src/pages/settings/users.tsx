import { useState, useEffect } from "react";
import { useQuery, useMutation, keepPreviousData } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Users, Edit, Trash2, Plus, Search, UserCheck, UserX, Lock, Unlock, RotateCcw, MoreVertical, ChevronLeft, ChevronRight, AlertTriangle, Shield, User, Eye } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createInsertSchema } from "drizzle-zod";
import { users } from "@shared/schema";
import { useLocation } from "wouter";
import { format } from "date-fns";

// Define types based on the API response structure
interface User {
  id: number;
  username: string;
  role: string;
  status: string;
  email?: string;
  createdAt: string;
  lastLoginAt?: string;
  failedLoginAttempts: number;
  lockedUntil?: string;
}

interface UsersResponse {
  users: User[];
  total: number;
  page: number;
  totalPages: number;
}

// Validation schemas
const userInsertSchema = createInsertSchema(users);
const editUserSchema = userInsertSchema.pick({
  username: true,
  email: true,
  role: true,
}).extend({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")).transform(val => val === "" ? undefined : val),
  role: z.enum(["admin", "hr", "viewer"])
});

const createUserSchema = editUserSchema.extend({
  password: z.string().min(8, "Password must be at least 8 characters")
});

const statusUpdateSchema = z.object({
  status: z.enum(["active", "suspended", "locked", "disabled"], { required_error: "Status is required" })
});

type EditUserFormData = z.infer<typeof editUserSchema>;
type CreateUserFormData = z.infer<typeof createUserSchema>;
type StatusUpdateFormData = z.infer<typeof statusUpdateSchema>;

// Update the status type to include 'locked'
type UserStatus = "active" | "suspended" | "locked" | "disabled";

// Utility function to check if user is locked
const isUserLocked = (user: User): boolean => {
  return user.status === 'locked' || (!!user.lockedUntil && new Date(user.lockedUntil) > new Date());
};

// Status Badge Component
function StatusBadge({ user }: { user: User }) {
  const locked = isUserLocked(user);
  
  const getStatusColor = (): "default" | "destructive" | "secondary" | "outline" => {
    if (locked) return "destructive";
    switch (user.status) {
      case "active": return "default";
      case "suspended": return "secondary";
      case "disabled": return "outline";
      default: return "outline";
    }
  };

  const getStatusText = () => {
    if (locked) return "Locked";
    return user.status.charAt(0).toUpperCase() + user.status.slice(1);
  };

  return (
    <div className="flex items-center gap-2">
      <Badge variant={getStatusColor()} data-testid={`status-badge-${user.id}`}>
        {locked && <Lock className="w-3 h-3 mr-1" />}
        {getStatusText()}
      </Badge>
      {user.failedLoginAttempts > 0 && (
        <Badge variant="outline" className="text-orange-600" data-testid={`failed-attempts-${user.id}`}>
          {user.failedLoginAttempts} failed attempts
        </Badge>
      )}
    </div>
  );
}

// Role Badge Component
function RoleBadge({ role }: { role: string }) {
  const getRoleIcon = () => {
    switch (role) {
      case "admin": return <Shield className="w-3 h-3 mr-1" />;
      case "hr": return <User className="w-3 h-3 mr-1" />;
      case "viewer": return <Eye className="w-3 h-3 mr-1" />;
      default: return null;
    }
  };

  const getRoleColor = () => {
    switch (role) {
      case "admin": return "default";
      case "hr": return "secondary"; 
      case "viewer": return "outline";
      default: return "outline";
    }
  };

  return (
    <Badge variant={getRoleColor()} data-testid={`role-badge-${role}`}>
      {getRoleIcon()}
      {role.charAt(0).toUpperCase() + role.slice(1)}
    </Badge>
  );
}

// Edit User Dialog Component
function EditUserDialog({ user, open, onOpenChange }: { user: User; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  
  const form = useForm<EditUserFormData>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      username: user.username,
      email: user.email || "",
      role: user.role as "admin" | "hr" | "viewer"
    }
  });

  const updateUserMutation = useMutation({
    mutationFn: (data: EditUserFormData) => apiRequest("PUT", `/api/admin/users/${user.id}`, data),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "User updated successfully"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"], exact: false });
      onOpenChange(false);
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

  const onSubmit = (data: EditUserFormData) => {
    updateUserMutation.mutate(data);
  };

  const isSelf = currentUser?.id === user.id;
  const canEditRole = !isSelf; // Prevent editing own role

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-edit-user">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-username" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input {...field} type="email" data-testid="input-email" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!canEditRole}>
                    <FormControl>
                      <SelectTrigger data-testid="select-role">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="hr">HR</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                  {!canEditRole && (
                    <p className="text-sm text-muted-foreground">You cannot change your own role</p>
                  )}
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-edit"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateUserMutation.isPending}
                data-testid="button-save-user"
              >
                {updateUserMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// Status Management Dialog Component
function StatusManagementDialog({ user, open, onOpenChange }: { user: User; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  
  const form = useForm<StatusUpdateFormData>({
    resolver: zodResolver(statusUpdateSchema),
    defaultValues: {
      status: user.status as UserStatus
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: (data: StatusUpdateFormData) => apiRequest("PUT", `/api/admin/users/${user.id}/status`, data),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "User status updated successfully"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"], exact: false });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const onSubmit = (data: StatusUpdateFormData) => {
    updateStatusMutation.mutate(data);
  };

  const isSelf = currentUser?.id === user.id;

  if (isSelf) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent data-testid="dialog-status-error">
          <DialogHeader>
            <DialogTitle>Cannot Change Status</DialogTitle>
          </DialogHeader>
          <p>You cannot change your own account status.</p>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} data-testid="button-close-status-error">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-manage-status">
        <DialogHeader>
          <DialogTitle>Manage User Status</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-status">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                      <SelectItem value="locked">Locked</SelectItem>
                      <SelectItem value="disabled">Disabled</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-status"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateStatusMutation.isPending}
                data-testid="button-save-status"
              >
                {updateStatusMutation.isPending ? "Updating..." : "Update Status"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// Unlock User Dialog Component
function UnlockUserDialog({ user, open, onOpenChange }: { user: User; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();

  const unlockUserMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/admin/users/${user.id}/unlock`),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "User account unlocked successfully"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"], exact: false });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleUnlock = () => {
    unlockUserMutation.mutate();
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid="dialog-unlock-user">
        <AlertDialogHeader>
          <AlertDialogTitle>Unlock User Account</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to unlock {user.username}'s account? This will reset their failed login attempts and allow them to log in again.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="button-cancel-unlock">Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleUnlock}
            disabled={unlockUserMutation.isPending}
            data-testid="button-confirm-unlock"
          >
            {unlockUserMutation.isPending ? "Unlocking..." : "Unlock Account"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Password Reset Dialog Component
function PasswordResetDialog({ user, open, onOpenChange }: { user: User; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();

  const resetPasswordMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/admin/users/${user.id}/reset-password`),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Password reset token generated. The user will be notified."
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"], exact: false });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleResetPassword = () => {
    resetPasswordMutation.mutate();
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid="dialog-reset-password">
        <AlertDialogHeader>
          <AlertDialogTitle>Reset User Password</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to generate a password reset for {user.username}? This will invalidate their current password and create a secure reset token.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="button-cancel-reset">Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleResetPassword}
            disabled={resetPasswordMutation.isPending}
            data-testid="button-confirm-reset"
          >
            {resetPasswordMutation.isPending ? "Generating..." : "Reset Password"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Create User Dialog Component
function CreateUserDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  
  const form = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      username: "",
      email: "",
      role: "hr",
      password: ""
    }
  });

  const createUserMutation = useMutation({
    mutationFn: (data: CreateUserFormData) => apiRequest("POST", "/api/admin/users", data),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "User created successfully"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"], exact: false });
      onOpenChange(false);
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

  const onSubmit = (data: CreateUserFormData) => {
    createUserMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-create-user">
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-create-username" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email (Optional)</FormLabel>
                  <FormControl>
                    <Input {...field} type="email" data-testid="input-create-email" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-create-role">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="hr">HR</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Initial Password</FormLabel>
                  <FormControl>
                    <Input {...field} type="password" data-testid="input-create-password" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-create"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createUserMutation.isPending}
                data-testid="button-save-create"
              >
                {createUserMutation.isPending ? "Creating..." : "Create User"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// Delete Confirmation Dialog Component
function DeleteConfirmationDialog({ user, open, onOpenChange }: { user: User; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const deleteUserMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/admin/users/${user.id}`),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "User deleted successfully"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"], exact: false });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleDelete = () => {
    deleteUserMutation.mutate();
  };

  const isSelf = currentUser?.id === user.id;
  const isSystemAdmin = user.id === 1;

  const getErrorMessage = () => {
    if (isSelf) return "You cannot delete your own account.";
    if (isSystemAdmin) return "The system admin user cannot be deleted.";
    return null;
  };

  const errorMessage = getErrorMessage();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid="dialog-delete-user">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Delete User Account
          </AlertDialogTitle>
          <AlertDialogDescription>
            {errorMessage ? (
              <span className="text-destructive font-medium">{errorMessage}</span>
            ) : (
              <>
                Are you sure you want to delete {user.username}'s account? This action cannot be undone and will permanently remove all user data.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="button-cancel-delete">
            {errorMessage ? "Close" : "Cancel"}
          </AlertDialogCancel>
          {!errorMessage && (
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteUserMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteUserMutation.isPending ? "Deleting..." : "Delete User"}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Action Menu Component
function UserActionMenu({ user }: { user: User }) {
  const { user: currentUser } = useAuth();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [unlockDialogOpen, setUnlockDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const isSelf = currentUser?.id === user.id;
  const isLocked = isUserLocked(user);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" data-testid={`action-menu-${user.id}`}>
            <MoreVertical className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setEditDialogOpen(true)} data-testid={`action-edit-${user.id}`}>
            <Edit className="w-4 h-4 mr-2" />
            Edit User
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => setStatusDialogOpen(true)} 
            disabled={isSelf}
            data-testid={`action-status-${user.id}`}
          >
            {user.status === 'active' ? <UserX className="w-4 h-4 mr-2" /> : <UserCheck className="w-4 h-4 mr-2" />}
            Manage Status
          </DropdownMenuItem>
          {isLocked && (
            <DropdownMenuItem onClick={() => setUnlockDialogOpen(true)} data-testid={`action-unlock-${user.id}`}>
              <Unlock className="w-4 h-4 mr-2" />
              Unlock Account
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => setResetDialogOpen(true)} data-testid={`action-reset-${user.id}`}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset Password
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => setDeleteDialogOpen(true)} 
            disabled={isSelf || user.id === 1}
            className="text-destructive"
            data-testid={`action-delete-${user.id}`}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete User
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditUserDialog user={user} open={editDialogOpen} onOpenChange={setEditDialogOpen} />
      <StatusManagementDialog user={user} open={statusDialogOpen} onOpenChange={setStatusDialogOpen} />
      <UnlockUserDialog user={user} open={unlockDialogOpen} onOpenChange={setUnlockDialogOpen} />
      <PasswordResetDialog user={user} open={resetDialogOpen} onOpenChange={setResetDialogOpen} />
      <DeleteConfirmationDialog user={user} open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} />
    </>
  );
}

// Users Table Component
function UsersTable({ users, isLoading }: { users: User[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="text-center py-12" data-testid="empty-users-state">
        <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium text-muted-foreground">No users found</h3>
        <p className="text-muted-foreground">Try adjusting your search or filter criteria.</p>
      </div>
    );
  }

  return (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead data-testid="header-username">Username</TableHead>
            <TableHead data-testid="header-email">Email</TableHead>
            <TableHead data-testid="header-role">Role</TableHead>
            <TableHead data-testid="header-status">Status</TableHead>
            <TableHead data-testid="header-last-login">Last Login</TableHead>
            <TableHead data-testid="header-created">Created</TableHead>
            <TableHead data-testid="header-actions">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id} data-testid={`user-row-${user.id}`}>
              <TableCell className="font-medium" data-testid={`username-${user.id}`}>
                {user.username}
              </TableCell>
              <TableCell data-testid={`email-${user.id}`}>
                {user.email || <span className="text-muted-foreground">—</span>}
              </TableCell>
              <TableCell data-testid={`role-${user.id}`}>
                <RoleBadge role={user.role} />
              </TableCell>
              <TableCell data-testid={`status-${user.id}`}>
                <StatusBadge user={user} />
              </TableCell>
              <TableCell data-testid={`last-login-${user.id}`}>
                {user.lastLoginAt ? (
                  <span className="text-sm">
                    {format(new Date(user.lastLoginAt), "MMM d, yyyy 'at' h:mm a")}
                  </span>
                ) : (
                  <span className="text-muted-foreground text-sm">Never</span>
                )}
              </TableCell>
              <TableCell data-testid={`created-${user.id}`}>
                <span className="text-sm">
                  {format(new Date(user.createdAt), "MMM d, yyyy")}
                </span>
              </TableCell>
              <TableCell>
                <UserActionMenu user={user} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// Pagination Component
function PaginationControls({ page, totalPages, onPageChange }: { page: number; totalPages: number; onPageChange: (page: number) => void }) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between">
      <div className="text-sm text-muted-foreground" data-testid="pagination-info">
        Page {page} of {totalPages}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          data-testid="button-prev-page"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          data-testid="button-next-page"
        >
          Next
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

// Main Users Management Component
export default function UsersManagement() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // State for filters and pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const limit = 10;

  // Debounce search query with 300ms delay
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Check if user is admin
  const isAdmin = user?.role === 'admin';

  // Redirect if not admin
  if (!isAdmin) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <div className="text-center py-12">
            <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground">Access Denied</h3>
            <p className="text-muted-foreground">You must be an admin to access user management.</p>
            <Button onClick={() => setLocation("/settings")} className="mt-4">
              Return to Settings
            </Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  // Build cache key with filters (using debounced search)
  const cacheKey = ["/api/admin/users", {
    page,
    limit,
    search: debouncedSearchQuery,
    role: roleFilter || undefined,
    status: statusFilter || undefined
  }];

  // Fetch users with React Query
  const { data: usersData, isLoading, error } = useQuery<UsersResponse>({
    queryKey: cacheKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("page", String(page));
      params.append("limit", String(limit));
      if (debouncedSearchQuery) params.append("search", debouncedSearchQuery);
      if (roleFilter && roleFilter !== "all") params.append("role", roleFilter);
      if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);
      
      const res = await fetch(`/api/admin/users?${params}`, {
        credentials: "include"
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(errorData.error || `Failed to fetch users: ${res.status}`);
      }
      
      return res.json();
    },
    enabled: isAdmin,
    placeholderData: keepPreviousData
  });

  // Reset page when filters change
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setPage(1);
  };

  // Reset page when debounced search changes  
  useEffect(() => {
    if (debouncedSearchQuery !== searchQuery) {
      setPage(1);
    }
  }, [debouncedSearchQuery, searchQuery]);

  const handleRoleFilterChange = (value: string) => {
    setRoleFilter(value === "all" ? "" : value);
    setPage(1);
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value === "all" ? "" : value);
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setRoleFilter("all");
    setStatusFilter("all");
    setPage(1);
  };

  if (error) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <div className="text-center py-12">
            <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-medium text-destructive">Error Loading Users</h3>
            <p className="text-muted-foreground">{error.message}</p>
            <Button onClick={() => window.location.reload()} className="mt-4">
              Retry
            </Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white" data-testid="page-title">
            User Management
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage user accounts, roles, and permissions
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                System Users
              </div>
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-user">
                    <Plus className="w-4 h-4 mr-2" />
                    Add User
                  </Button>
                </DialogTrigger>
                <CreateUserDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
              </Dialog>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by username or email..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-users"
                />
              </div>
              <Select value={roleFilter} onValueChange={handleRoleFilterChange}>
                <SelectTrigger className="w-full sm:w-[140px]" data-testid="select-filter-role">
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="hr">HR</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
                <SelectTrigger className="w-full sm:w-[140px]" data-testid="select-filter-status">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="locked">Locked</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                </SelectContent>
              </Select>
              {(searchQuery || (roleFilter && roleFilter !== "all") || (statusFilter && statusFilter !== "all")) && (
                <Button variant="outline" onClick={clearFilters} data-testid="button-clear-filters">
                  Clear Filters
                </Button>
              )}
            </div>

            {/* Users Table */}
            <UsersTable users={usersData?.users || []} isLoading={isLoading} />

            {/* Pagination */}
            {usersData && usersData.totalPages > 1 && (
              <PaginationControls
                page={page}
                totalPages={usersData.totalPages}
                onPageChange={handlePageChange}
              />
            )}

            {/* Summary */}
            {usersData && (
              <div className="text-sm text-muted-foreground" data-testid="users-summary">
                Showing {usersData.users.length} of {usersData.total} users
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}