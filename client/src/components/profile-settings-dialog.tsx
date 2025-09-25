import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect } from "react";

// Validation schema for profile settings
const profileSettingsSchema = z.object({
  email: z.string().email("Please enter a valid email address")
});

type ProfileSettingsFormData = z.infer<typeof profileSettingsSchema>;

interface ProfileSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileSettingsDialog({ open, onOpenChange }: ProfileSettingsDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const form = useForm<ProfileSettingsFormData>({
    resolver: zodResolver(profileSettingsSchema),
    defaultValues: {
      email: user?.email || ""
    }
  });

  // Reset form when user data changes or dialog opens
  useEffect(() => {
    if (open && user) {
      form.reset({
        email: user.email || ""
      });
    }
  }, [open, user, form]);

  // Update email mutation
  const updateEmailMutation = useMutation({
    mutationFn: async (data: ProfileSettingsFormData) => {
      const response = await apiRequest("PATCH", "/api/users/me", data);
      return await response.json();
    },
    onSuccess: (updatedUser) => {
      // Update the user query cache with the new data
      queryClient.setQueryData(["/api/user"], updatedUser);
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      
      toast({
        title: "Email updated successfully",
        description: "Your email address has been updated.",
      });
      
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update email",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    }
  });

  const handleSubmit = (data: ProfileSettingsFormData) => {
    // Only submit if email has changed
    if (data.email !== user?.email) {
      updateEmailMutation.mutate(data);
    } else {
      toast({
        title: "No changes",
        description: "Email address has not been modified.",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Profile Settings</DialogTitle>
          <DialogDescription>
            View and update your account information
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={user?.username || ""}
                  readOnly
                  className="bg-muted"
                  data-testid="input-profile-username"
                />
              </div>

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        placeholder="Enter your email address"
                        data-testid="input-profile-email"
                        disabled={updateEmailMutation.isPending}
                      />
                    </FormControl>
                    <FormMessage data-testid="text-email-error" />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Input
                  id="role"
                  value={user?.role || ""}
                  readOnly
                  className="bg-muted capitalize"
                  data-testid="input-profile-role"
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={updateEmailMutation.isPending}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateEmailMutation.isPending}
                data-testid="button-save-profile"
              >
                {updateEmailMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}