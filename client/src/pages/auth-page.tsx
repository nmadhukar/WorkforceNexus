import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Users, Shield, Eye, Mail, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PasswordChangeDialog } from "@/components/password-change-dialog";

/**
 * Authentication page providing login and registration functionality for the HR management system
 * @component
 * @returns {JSX.Element} Authentication interface with login/register tabs and onboarding support
 * @example
 * <AuthPage />
 * 
 * @description
 * - Dual-purpose authentication with login and registration tabs
 * - Supports employee onboarding flow via invitation tokens in URL
 * - Handles role-based registration (admin, hr, viewer)
 * - Auto-redirects authenticated users to dashboard
 * - Displays success messages for registration with onboarding form notifications
 * - Features responsive split layout with hero section showcasing system benefits
 * - Password confirmation validation with real-time feedback
 * - Invitation token processing for employee onboarding workflow
 * - Uses data-testid attributes for comprehensive testing coverage
 */
export default function AuthPage() {
  const [, navigate] = useLocation();
  const { user, loginMutation, registerMutation } = useAuth();
  const { toast } = useToast();
  const [loginData, setLoginData] = useState({ username: "", password: "" });
  const [registerData, setRegisterData] = useState({ 
    username: "", 
    password: "", 
    confirmPassword: ""
  });
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [invitationToken, setInvitationToken] = useState<string | null>(null);
  const [registrationSuccess, setRegistrationSuccess] = useState<{
    message?: string;
    formsSent?: number;
  } | null>(null);
  const [showPasswordChange, setShowPasswordChange] = useState(false);

  useEffect(() => {
    // Check for invitation token in URL
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (token) {
      setInvitationToken(token);
      setIsOnboarding(true);
    }
  }, []);
  
  useEffect(() => {
    if (user && !registrationSuccess) {
      navigate("/");
    }
  }, [user, navigate, registrationSuccess]);

  /**
   * Handles user login form submission
   * @param {React.FormEvent} e - Form submission event
   */
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(loginData, {
      onSuccess: (data: any) => {
        if (data?.requirePasswordChange) {
          setShowPasswordChange(true);
        } else {
          navigate("/");
        }
      }
    });
  };

  /**
   * Handles user registration form submission with validation
   * @param {React.FormEvent} e - Form submission event
   * @description Validates password confirmation and processes onboarding tokens
   */
  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (registerData.password !== registerData.confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "Passwords do not match. Please try again.",
        variant: "destructive"
      });
      return;
    }
    
    const registrationData: any = {
      username: registerData.username,
      password: registerData.password,
      invitationToken: invitationToken // Required now
    };
    
    registerMutation.mutate(registrationData, {
      onSuccess: (data: any) => {
        if (data.isOnboarding) {
          setRegistrationSuccess({
            message: data.message,
            formsSent: data.formsSent
          });
          toast({
            title: "Registration Successful",
            description: data.message,
            duration: 10000
          });
          // Navigate to dashboard after delay to show message
          setTimeout(() => {
            navigate("/");
          }, 5000);
        }
      },
      onError: (error: any) => {
        toast({
          title: "Registration Failed",
          description: error.error || error.message || "Failed to create account",
          variant: "destructive"
        });
      }
    });
  };

  if (user && !showPasswordChange) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5 flex">
      {/* Left side - Auth Forms */}
      <div className="flex-1 flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-4">
            <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center mx-auto">
              <Users className="w-8 h-8 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-2xl">HR Management System</CardTitle>
              <CardDescription>
                {isOnboarding ? "Complete Your Employee Onboarding" : "Medical Staff Employee Portal"}
              </CardDescription>
            </div>
          </CardHeader>
          
          <CardContent>
            <Tabs defaultValue="login" className="space-y-4">
              <TabsList className={`grid w-full ${invitationToken ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <TabsTrigger value="login">Sign In</TabsTrigger>
                {invitationToken && (
                  <TabsTrigger value="register">Register</TabsTrigger>
                )}
              </TabsList>
              
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4" data-testid="login-form">
                  <div>
                    <Label htmlFor="login-username">Username</Label>
                    <Input
                      id="login-username"
                      type="text"
                      placeholder="Enter your username"
                      value={loginData.username}
                      onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
                      required
                      data-testid="input-login-username"
                    />
                  </div>
                  <div>
                    <Label htmlFor="login-password">Password</Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="Enter your password"
                      value={loginData.password}
                      onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                      required
                      data-testid="input-login-password"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={loginMutation.isPending}
                    data-testid="button-login-submit"
                  >
                    {loginMutation.isPending ? "Signing In..." : "Sign In"}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="register">
                {registrationSuccess ? (
                  <div className="space-y-4">
                    <Alert className="border-green-200 bg-green-50">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-800">
                        {registrationSuccess.message}
                      </AlertDescription>
                    </Alert>
                    {registrationSuccess.formsSent && registrationSuccess.formsSent > 0 && (
                      <Alert>
                        <Mail className="h-4 w-4" />
                        <AlertDescription>
                          <strong>{registrationSuccess.formsSent} onboarding form(s)</strong> have been sent to your email.
                          Please check your inbox and complete all required forms to finish your onboarding.
                        </AlertDescription>
                      </Alert>
                    )}
                    <p className="text-sm text-muted-foreground text-center">
                      Redirecting to dashboard...
                    </p>
                  </div>
                ) : (
                <form onSubmit={handleRegister} className="space-y-4" data-testid="register-form">
                  {isOnboarding && (
                    <Alert>
                      <Mail className="h-4 w-4" />
                      <AlertDescription>
                        Welcome! Create your account to begin the onboarding process.
                        Required forms will be sent to your email after registration.
                      </AlertDescription>
                    </Alert>
                  )}
                  <div>
                    <Label htmlFor="register-username">Username</Label>
                    <Input
                      id="register-username"
                      type="text"
                      placeholder="Choose a username"
                      value={registerData.username}
                      onChange={(e) => setRegisterData({ ...registerData, username: e.target.value })}
                      required
                      data-testid="input-register-username"
                    />
                  </div>
                  <div>
                    <Label htmlFor="register-password">Password</Label>
                    <Input
                      id="register-password"
                      type="password"
                      placeholder="Choose a password"
                      value={registerData.password}
                      onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                      required
                      data-testid="input-register-password"
                    />
                  </div>
                  <div>
                    <Label htmlFor="confirm-password">Confirm Password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder="Confirm your password"
                      value={registerData.confirmPassword}
                      onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })}
                      required
                      data-testid="input-register-confirm-password"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={registerMutation.isPending || registerData.password !== registerData.confirmPassword}
                    data-testid="button-register-submit"
                  >
                    {registerMutation.isPending ? "Creating Account..." : "Create Account"}
                  </Button>
                </form>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
      
      {/* Right side - Hero Section */}
      <div className="flex-1 bg-gradient-to-br from-primary to-secondary flex items-center justify-center p-12">
        <div className="max-w-lg text-center text-primary-foreground space-y-8">
          <h1 className="text-4xl font-bold">
            Streamline Your Medical Staff Management
          </h1>
          
          <p className="text-lg opacity-90">
            Comprehensive HR solution for healthcare organizations. Manage employee records, 
            track certifications, handle compliance, and maintain audit trails with ease.
          </p>
          
          <div className="grid grid-cols-1 gap-6 mt-8">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-primary-foreground/10 rounded-lg flex items-center justify-center">
                <Shield className="w-6 h-6" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold">Secure & Compliant</h3>
                <p className="text-sm opacity-80">HIPAA-compliant with comprehensive audit logging</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-primary-foreground/10 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold">Complete Employee Lifecycle</h3>
                <p className="text-sm opacity-80">From onboarding to license management and beyond</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-primary-foreground/10 rounded-lg flex items-center justify-center">
                <Eye className="w-6 h-6" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold">Real-time Insights</h3>
                <p className="text-sm opacity-80">Dashboard analytics and expiration monitoring</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {showPasswordChange && (
        <PasswordChangeDialog 
          open={showPasswordChange}
          onSuccess={() => {
            setShowPasswordChange(false);
            navigate("/");
          }}
        />
      )}
    </div>
  );
}
