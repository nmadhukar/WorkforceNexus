import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProfileSettingsDialog } from "@/components/profile-settings-dialog";
import { PasswordChangeDialog } from "@/components/password-change-dialog";
import { Calendar, Users, User, Lock, LogOut } from "lucide-react";

/**
 * Application header with user menu and profile management
 * 
 * @component
 * @returns {JSX.Element} Header with navigation and user controls
 * 
 * @description
 * - Displays application branding and current date
 * - Shows authenticated user information
 * - Provides dropdown menu for profile actions
 * - Manages profile settings and password change dialogs
 * - Handles user logout
 */
export function Header() {
  const { user, logoutMutation } = useAuth();
  /**
   * Dialog state for profile management
   * Controls visibility of profile settings and password change modals
   */
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);

  const getCurrentDate = () => {
    return new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric", 
      month: "long",
      day: "numeric"
    });
  };

  /**
   * Generate initials for user avatar
   * @param {any} user - User object with username
   * @returns {string} First two letters of username in uppercase
   */
  const getUserInitials = (user: any) => {
    if (!user?.username) return "U";
    return user.username.substring(0, 2).toUpperCase();
  };

  return (
    <header className="bg-card border-b border-border sticky top-0 z-50">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold text-foreground" data-testid="text-header-title">
              HR Management System
            </h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span data-testid="text-current-date">{getCurrentDate()}</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground">Welcome,</span>
              <span className="text-sm font-medium text-foreground" data-testid="text-username">
                {user?.username || "User"}
              </span>
              
              {/**
               * User dropdown menu
               * Provides quick access to profile settings, password change, and logout
               */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="relative h-8 w-8 rounded-full"
                    data-testid="button-user-dropdown"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-accent text-accent-foreground text-xs font-medium">
                        {getUserInitials(user)}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user?.username}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user?.email || "No email set"}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setShowProfileDialog(true)}
                    data-testid="dropdown-item-profile-settings"
                  >
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setShowPasswordDialog(true)}
                    data-testid="dropdown-item-change-password"
                  >
                    <Lock className="mr-2 h-4 w-4" />
                    <span>Change Password</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => logoutMutation.mutate()}
                    disabled={logoutMutation.isPending}
                    data-testid="dropdown-item-logout"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Logout</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            {/**
             * Profile management dialogs
             * - ProfileSettingsDialog: Update email and view account info
             * - PasswordChangeDialog: Voluntary password change
             */}
            <ProfileSettingsDialog
              open={showProfileDialog}
              onOpenChange={setShowProfileDialog}
            />
            <PasswordChangeDialog
              open={showPasswordDialog}
              onSuccess={() => setShowPasswordDialog(false)}
              onOpenChange={setShowPasswordDialog}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
