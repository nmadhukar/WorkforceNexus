import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Users, AlertCircle, CheckCircle, Lock, User, Clock, ChevronRight } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription
} from "@/components/ui/form";

/**
 * Password validation schema
 * Enforces strong password requirements for security
 */
const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[@$!%*?&]/, "Password must contain at least one special character (@$!%*?&)");

/**
 * Registration form schema with password confirmation
 */
const registrationSchema = z.object({
  username: z.string()
    .min(3, "Username must be at least 3 characters")
    .max(50, "Username must be less than 50 characters")
    .regex(/^[a-zA-Z0-9._-]+$/, "Username can only contain letters, numbers, dots, underscores, and hyphens"),
  password: passwordSchema,
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

type RegistrationFormData = z.infer<typeof registrationSchema>;

/**
 * Employee Onboarding Registration Page
 * 
 * @component
 * @returns {JSX.Element} Registration interface for invited employees
 * 
 * @description
 * - Public page accessible without authentication
 * - Validates invitation token from URL
 * - Displays personalized registration form
 * - Enforces strong password requirements
 * - Handles various error states
 * - Auto-redirects to login after successful registration
 */
export default function OnboardingRegisterPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [token, setToken] = useState<string | null>(null);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [countdown, setCountdown] = useState(3);

  /**
   * Extract token from URL on component mount
   */
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const invitationToken = urlParams.get('token');
    
    if (!invitationToken) {
      toast({
        title: "Invalid Link",
        description: "This registration link appears to be invalid. Please contact your HR administrator.",
        variant: "destructive",
        duration: 0 // Don't auto-dismiss
      });
    } else {
      setToken(invitationToken);
    }
  }, [toast]);

  /**
   * Fetch invitation details based on token
   * Uses the public GET /api/invitations/:token endpoint
   */
  const { data: invitation, isLoading: loadingInvitation, error: invitationError } = useQuery({
    queryKey: ['/api/invitations', token],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/invitations/${token}`, null);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to validate invitation');
      }
      
      return response.json();
    },
    enabled: !!token,
    retry: false
  });

  /**
   * Registration form
   */
  const form = useForm<RegistrationFormData>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      username: "",
      password: "",
      confirmPassword: ""
    }
  });

  /**
   * Registration mutation
   */
  const registerMutation = useMutation({
    mutationFn: async (data: RegistrationFormData) => {
      const response = await apiRequest('POST', '/api/register', {
        username: data.username,
        password: data.password,
        invitationToken: token
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Registration failed');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setRegistrationSuccess(true);
      toast({
        title: "Registration Successful",
        description: data.message || "Your account has been created successfully. You will be redirected to the login page.",
        duration: 10000
      });
      
      // Start countdown for redirect
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            navigate("/auth");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    },
    onError: (error: Error) => {
      // Parse specific error types
      const message = error.message;
      
      if (message.includes("expired")) {
        toast({
          title: "Invitation Expired",
          description: "This invitation link has expired. Please contact your HR administrator for a new invitation.",
          variant: "destructive",
          duration: 0
        });
      } else if (message.includes("invalid")) {
        toast({
          title: "Invalid Invitation",
          description: "This invitation link is invalid. Please check the link or contact your HR administrator.",
          variant: "destructive",
          duration: 0
        });
      } else if (message.includes("username") && message.includes("exists")) {
        form.setError("username", { message: "This username is already taken. Please choose a different one." });
      } else if (message.includes("already registered")) {
        toast({
          title: "Already Registered",
          description: "This invitation has already been used. Please log in with your credentials.",
          variant: "destructive"
        });
        setTimeout(() => navigate("/auth"), 3000);
      } else {
        toast({
          title: "Registration Failed",
          description: message,
          variant: "destructive"
        });
      }
    }
  });

  /**
   * Handle form submission
   */
  const onSubmit = (data: RegistrationFormData) => {
    registerMutation.mutate(data);
  };

  /**
   * Calculate password strength
   */
  const getPasswordStrength = (password: string): number => {
    let strength = 0;
    if (password.length >= 8) strength += 25;
    if (/[a-z]/.test(password)) strength += 25;
    if (/[A-Z]/.test(password)) strength += 25;
    if (/[0-9]/.test(password)) strength += 12.5;
    if (/[@$!%*?&]/.test(password)) strength += 12.5;
    return Math.min(strength, 100);
  };

  /**
   * Get password strength color
   */
  const getPasswordStrengthColor = (strength: number): string => {
    if (strength < 50) return "bg-destructive";
    if (strength < 75) return "bg-yellow-500";
    return "bg-green-500";
  };

  const passwordValue = form.watch("password");
  const passwordStrength = getPasswordStrength(passwordValue || "");

  /**
   * Check if invitation is close to expiring (within 24 hours)
   */
  const isExpiringSoon = invitation?.isExpiringSoon || (
    invitation?.expiresAt && 
    new Date(invitation.expiresAt).getTime() - Date.now() < 24 * 60 * 60 * 1000
  );

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5 flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-4">
            <div className="w-16 h-16 bg-destructive rounded-lg flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8 text-destructive-foreground" />
            </div>
            <div>
              <CardTitle className="text-2xl">Invalid Registration Link</CardTitle>
              <CardDescription>
                The registration link appears to be invalid or incomplete.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Alert className="border-destructive/20 bg-destructive/10">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Please check the link in your invitation email or contact your HR administrator for assistance.
              </AlertDescription>
            </Alert>
            <Button 
              onClick={() => navigate("/auth")}
              className="w-full mt-4"
              variant="outline"
              data-testid="button-go-to-login"
            >
              Go to Login Page
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (registrationSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5 flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-4">
            <div className="w-16 h-16 bg-green-500 rounded-lg flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl">Registration Successful!</CardTitle>
              <CardDescription>
                Your account has been created successfully.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                You can now log in with your new credentials. Check your email for onboarding forms and instructions.
              </AlertDescription>
            </Alert>
            
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Redirecting to login page in {countdown} seconds...
              </p>
              <Progress value={(3 - countdown) * 33.33} className="w-full" />
            </div>
            
            <Button 
              onClick={() => navigate("/auth")}
              className="w-full"
              data-testid="button-login-now"
            >
              Go to Login Now
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5 flex">
      {/* Left side - Registration Form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-4">
            <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center mx-auto">
              <User className="w-8 h-8 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-2xl">Complete Your Registration</CardTitle>
              <CardDescription>
                Create your account to access the HR Management System
              </CardDescription>
            </div>
          </CardHeader>
          
          <CardContent>
            {isExpiringSoon && (
              <Alert className="mb-4 border-yellow-200 bg-yellow-50">
                <Clock className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-800">
                  This invitation expires soon. Please complete your registration promptly.
                </AlertDescription>
              </Alert>
            )}
            
            {invitationError && (
              <Alert className="mb-4 border-destructive/20 bg-destructive/10">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Unable to validate invitation. You may still attempt to register.
                </AlertDescription>
              </Alert>
            )}

            {invitation && (
              <div className="mb-4 p-4 bg-muted rounded-lg space-y-2">
                <div className="font-medium text-sm text-muted-foreground">Registering as:</div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium" data-testid="text-invited-name">
                      {invitation.firstName} {invitation.lastName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground" data-testid="text-invited-email">
                      {invitation.email}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Enter your username"
                          data-testid="input-username"
                          disabled={registerMutation.isPending}
                        />
                      </FormControl>
                      <FormDescription>
                        This will be your login username
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="password"
                          placeholder="Enter your password"
                          data-testid="input-password"
                          disabled={registerMutation.isPending}
                        />
                      </FormControl>
                      <FormDescription>
                        Must be at least 8 characters with uppercase, lowercase, number, and special character
                      </FormDescription>
                      <FormMessage />
                      
                      {passwordValue && (
                        <div className="space-y-2 mt-2">
                          <div className="flex justify-between text-xs">
                            <span>Password strength</span>
                            <span>{passwordStrength}%</span>
                          </div>
                          <Progress 
                            value={passwordStrength} 
                            className="h-2"
                            data-testid="progress-password-strength"
                          />
                          <div className="h-2 rounded-full overflow-hidden bg-secondary">
                            <div 
                              className={`h-full transition-all ${getPasswordStrengthColor(passwordStrength)}`}
                              style={{ width: `${passwordStrength}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm Password</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="password"
                          placeholder="Re-enter your password"
                          data-testid="input-confirm-password"
                          disabled={registerMutation.isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={registerMutation.isPending}
                  data-testid="button-register"
                >
                  {registerMutation.isPending ? (
                    <>
                      <span className="animate-pulse">Creating Account...</span>
                    </>
                  ) : (
                    "Create Account"
                  )}
                </Button>

                <div className="text-center text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <Button
                    type="button"
                    variant="link"
                    className="p-0 h-auto font-normal"
                    onClick={() => navigate("/auth")}
                    data-testid="link-login"
                  >
                    Log in here
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      {/* Right side - Information Panel */}
      <div className="hidden lg:flex flex-1 bg-primary text-primary-foreground p-12 items-center justify-center">
        <div className="max-w-md space-y-6">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold">Welcome to Your New Role!</h2>
            <p className="text-primary-foreground/80">
              You're just a few steps away from joining our healthcare team.
            </p>
          </div>
          
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary-foreground/10 flex items-center justify-center flex-shrink-0">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Secure Access</h3>
                <p className="text-sm text-primary-foreground/70">
                  Your account is protected with enterprise-grade security
                </p>
              </div>
            </div>
            
            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary-foreground/10 flex items-center justify-center flex-shrink-0">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Complete Onboarding</h3>
                <p className="text-sm text-primary-foreground/70">
                  After registration, you'll receive onboarding forms via email
                </p>
              </div>
            </div>
            
            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary-foreground/10 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Track Your Progress</h3>
                <p className="text-sm text-primary-foreground/70">
                  Monitor your credential status and compliance requirements
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}