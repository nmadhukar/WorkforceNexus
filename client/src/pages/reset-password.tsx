import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Users, AlertCircle, CheckCircle, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

/**
 * Password Reset Page - Final step of password recovery process
 * @component
 * @returns {JSX.Element} Password reset interface with token validation
 * @example
 * <ResetPasswordPage />
 * 
 * @description
 * - Validates reset token from URL query parameters
 * - Provides secure password reset form with confirmation
 * - Enforces password strength requirements
 * - Redirects to login after successful reset
 * - Shows error states for invalid/expired tokens
 * - Maintains consistent styling with auth page
 * - Includes comprehensive test IDs for automation
 */
export default function ResetPasswordPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [token, setToken] = useState<string | null>(null);
  const [passwords, setPasswords] = useState({
    newPassword: "",
    confirmPassword: ""
  });
  const [loading, setLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [tokenError, setTokenError] = useState(false);

  /**
   * Validate reset token from URL on mount
   * 
   * @description
   * - Extracts token from query parameters
   * - Validates token presence
   * - Shows error if token is missing
   * - Prepares form for password reset
   * 
   * @security
   * - Token must be present in URL
   * - Invalid tokens handled gracefully
   * - No sensitive information exposed
   */
  useEffect(() => {
    // Extract token from URL query parameters
    const urlParams = new URLSearchParams(window.location.search);
    const resetToken = urlParams.get('token');
    
    if (!resetToken) {
      setTokenError(true);
      toast({
        title: "Invalid Reset Link",
        description: "The password reset link appears to be invalid. Please request a new one.",
        variant: "destructive"
      });
    } else {
      setToken(resetToken);
    }
  }, [toast]);

  /**
   * Handle password reset form submission
   * 
   * @param {React.FormEvent} e - Form submission event
   * @returns {Promise<void>}
   * 
   * @description
   * - Validates password confirmation matches
   * - Enforces password strength requirements
   * - Sends reset request with token and new password
   * - Redirects to login on success
   * - Handles expired/invalid tokens
   * 
   * @security
   * - Password must meet complexity requirements
   * - Token validated on backend
   * - Single-use tokens prevent reuse
   * - Automatic redirect after success
   * 
   * @validation
   * - Min 8 characters
   * - Must contain uppercase, lowercase, number, special char
   * - Passwords must match
   */
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate passwords match
    if (passwords.newPassword !== passwords.confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "The passwords you entered do not match. Please try again.",
        variant: "destructive"
      });
      return;
    }

    // Validate password strength
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
    if (passwords.newPassword.length < 8 || !passwordRegex.test(passwords.newPassword)) {
      toast({
        title: "Weak Password",
        description: "Password must be at least 8 characters and contain uppercase, lowercase, number, and special character.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    
    try {
      const response = await apiRequest('POST', '/api/auth/confirm-reset-password', {
        token: token,
        newPassword: passwords.newPassword
      });
      
      const data = await response.json();
      
      setResetSuccess(true);
      toast({
        title: "Password Reset Successful",
        description: "Your password has been reset successfully. You can now login with your new password.",
        duration: 5000
      });
      
      // Redirect to login page after delay
      setTimeout(() => {
        navigate("/auth");
      }, 3000);
      
    } catch (error: any) {
      const errorMessage = error.message || "Failed to reset password";
      
      if (errorMessage.includes("expired") || errorMessage.includes("invalid")) {
        setTokenError(true);
        toast({
          title: "Invalid or Expired Token",
          description: "This password reset link has expired or is invalid. Please request a new one.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Reset Failed",
          description: errorMessage,
          variant: "destructive"
        });
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handles navigation back to auth page to request new reset
   */
  const handleBackToLogin = () => {
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5 flex">
      {/* Center content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-4">
            <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center mx-auto">
              <Lock className="w-8 h-8 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-2xl">Reset Your Password</CardTitle>
              <CardDescription>
                {tokenError 
                  ? "Invalid or expired reset link" 
                  : "Enter your new password below"}
              </CardDescription>
            </div>
          </CardHeader>
          
          <CardContent>
            {resetSuccess ? (
              <div className="space-y-4">
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    Your password has been reset successfully!
                  </AlertDescription>
                </Alert>
                <p className="text-sm text-muted-foreground text-center">
                  Redirecting to login page...
                </p>
                <Button 
                  onClick={handleBackToLogin}
                  className="w-full"
                  variant="outline"
                  data-testid="button-back-to-login"
                >
                  Go to Login Now
                </Button>
              </div>
            ) : tokenError ? (
              <div className="space-y-4">
                <Alert className="border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    This password reset link is invalid or has expired.
                  </AlertDescription>
                </Alert>
                <p className="text-sm text-muted-foreground text-center">
                  Password reset links expire after 1 hour for security reasons.
                </p>
                <Button 
                  onClick={handleBackToLogin}
                  className="w-full"
                  data-testid="button-request-new-reset"
                >
                  Request New Password Reset
                </Button>
              </div>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4" data-testid="reset-password-form">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Please enter a new password for your account. Make sure it's strong and secure.
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="Enter your new password"
                    value={passwords.newPassword}
                    onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                    required
                    data-testid="input-new-password"
                    disabled={loading}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Must be at least 8 characters with uppercase, lowercase, number, and special character
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="Confirm your new password"
                    value={passwords.confirmPassword}
                    onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                    required
                    data-testid="input-confirm-password"
                    disabled={loading}
                  />
                </div>
                
                {passwords.newPassword && passwords.confirmPassword && passwords.newPassword !== passwords.confirmPassword && (
                  <Alert className="border-yellow-200 bg-yellow-50">
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    <AlertDescription className="text-yellow-800">
                      Passwords do not match
                    </AlertDescription>
                  </Alert>
                )}
                
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={loading || !passwords.newPassword || !passwords.confirmPassword}
                  data-testid="button-reset-password"
                >
                  {loading ? "Resetting Password..." : "Reset Password"}
                </Button>
                
                <Button 
                  type="button"
                  onClick={handleBackToLogin}
                  className="w-full"
                  variant="outline"
                  disabled={loading}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Right side - Hero Section (matching auth page) */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-primary to-secondary items-center justify-center p-12">
        <div className="max-w-lg text-center text-primary-foreground space-y-8">
          <div className="w-20 h-20 bg-primary-foreground/10 rounded-lg flex items-center justify-center mx-auto">
            <Users className="w-10 h-10" />
          </div>
          
          <h1 className="text-3xl font-bold">
            Secure Password Recovery
          </h1>
          
          <p className="text-lg opacity-90">
            Your security is our priority. Reset your password safely and get back to managing 
            your healthcare workforce efficiently.
          </p>
          
          <div className="space-y-4 text-left max-w-sm mx-auto">
            <div className="flex items-start space-x-3">
              <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold">Strong Password Requirements</p>
                <p className="text-sm opacity-80">Enforced security standards for all passwords</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold">Time-Limited Reset Links</p>
                <p className="text-sm opacity-80">Links expire in 1 hour for added security</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold">Secure Token Validation</p>
                <p className="text-sm opacity-80">Cryptographically secure reset tokens</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}