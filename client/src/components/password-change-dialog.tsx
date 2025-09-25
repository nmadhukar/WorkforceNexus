import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface PasswordChangeDialogProps {
  open: boolean;
  onSuccess?: () => void;
  onOpenChange?: (open: boolean) => void;
  title?: string;
  description?: string;
}

/**
 * Password change dialog for voluntary password updates
 * 
 * @component
 * @param {PasswordChangeDialogProps} props - Dialog configuration
 * @param {boolean} props.open - Control dialog visibility
 * @param {function} [props.onSuccess] - Callback after successful change
 * @param {function} [props.onOpenChange] - Callback for dialog state changes
 * @param {string} [props.title] - Dialog title (default: "Change Password")
 * @param {string} [props.description] - Dialog description
 * @returns {JSX.Element} Password change dialog
 * 
 * @description
 * - Allows authenticated users to change their password
 * - Requires current password verification
 * - Validates new password strength
 * - Ensures new password differs from current
 * - Shows real-time validation feedback
 * 
 * @security
 * - Current password required for verification
 * - New password must meet complexity requirements
 * - Passwords transmitted securely to backend
 * - Form cleared on close for security
 * 
 * @validation
 * - New password min 8 characters
 * - Passwords must match
 * - New must differ from current
 */
export function PasswordChangeDialog({ 
  open, 
  onSuccess, 
  onOpenChange,
  title = "Change Password",
  description = "Update your account password"
}: PasswordChangeDialogProps) {
  const { toast } = useToast();
  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [error, setError] = useState<string | null>(null);

  /**
   * Mutation for changing password
   * 
   * @description
   * - Sends current and new password to backend
   * - Shows success toast on completion
   * - Clears form and errors on success
   * - Calls onSuccess callback if provided
   * - Updates error state on failure
   */
  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      return apiRequest("POST", "/api/change-password", data);
    },
    onSuccess: () => {
      toast({
        title: "Password Changed",
        description: "Your password has been successfully changed."
      });
      setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setError(null);
      onSuccess?.();
    },
    onError: (error: any) => {
      setError(error.error || error.message || "Failed to change password");
    }
  });

  /**
   * Handle password change form submission
   * 
   * @param {React.FormEvent} e - Form submission event
   * 
   * @description
   * - Validates all password requirements
   * - Shows specific error messages for validation failures
   * - Triggers password change mutation on valid input
   * 
   * @validation
   * 1. New passwords must match
   * 2. Min 8 characters length
   * 3. Must differ from current password
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate passwords match
    if (passwords.newPassword !== passwords.confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    // Validate password length
    if (passwords.newPassword.length < 8) {
      setError("New password must be at least 8 characters long");
      return;
    }

    // Check that new password is different from current
    if (passwords.currentPassword === passwords.newPassword) {
      setError("New password must be different from current password");
      return;
    }

    changePasswordMutation.mutate({
      currentPassword: passwords.currentPassword,
      newPassword: passwords.newPassword
    });
  };

  /**
   * Handle dialog open/close state changes
   * 
   * @param {boolean} newOpen - New open state
   * 
   * @description
   * - Resets form and errors when closing
   * - Maintains clean state between uses
   * - Calls parent onOpenChange if provided
   * - Ensures security by clearing passwords
   */
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset form when closing
      setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setError(null);
    }
    // Always call the parent's onOpenChange if it exists
    onOpenChange?.(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent 
        className="sm:max-w-md" 
        onPointerDownOutside={(e) => {
          // Only prevent closing if there's no onOpenChange handler (forced password change)
          if (!onOpenChange) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="current-password">Current Password</Label>
            <Input
              id="current-password"
              type="password"
              value={passwords.currentPassword}
              onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
              placeholder="Enter current password"
              required
              data-testid="input-current-password"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <Input
              id="new-password"
              type="password"
              value={passwords.newPassword}
              onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
              placeholder="Enter new password (min 8 characters)"
              required
              minLength={8}
              data-testid="input-new-password"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={passwords.confirmPassword}
              onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
              placeholder="Confirm new password"
              required
              data-testid="input-confirm-password"
            />
          </div>

          <Button 
            type="submit" 
            className="w-full"
            disabled={changePasswordMutation.isPending}
            data-testid="button-change-password"
          >
            {changePasswordMutation.isPending ? "Changing Password..." : "Change Password"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}