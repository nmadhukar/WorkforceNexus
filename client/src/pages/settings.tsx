import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Settings as SettingsIcon, Users, Bell, Shield, Edit, Trash2, Plus, Save, Key, Cloud, Database, CheckCircle, XCircle, ArrowUpCircle, Mail, Send, MailCheck, FileSignature, RefreshCw, Link2, FileText, ChevronUp, ChevronDown, GripVertical } from "lucide-react";
import { Link } from "wouter";
import { insertRequiredDocumentTypeSchema, type RequiredDocumentType, type InsertRequiredDocumentType } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


/**
 * System-wide configuration settings
 */
interface SystemSettings {
  emailAlertsEnabled: boolean;
  dailyReportsEnabled: boolean;
  weeklyAuditSummaries: boolean;
  licenseExpiryWarningDays: number;
  caqhReattestationWarningDays: number;
}

interface S3Status {
  configured: boolean;
  bucketName: string;
  region: string;
  endpoint: string;
  statistics: {
    totalDocuments: number;
    s3Documents: number;
    localDocuments: number;
    s3Percentage: string;
  };
  environment: {
    AWS_ACCESS_KEY_ID: string;
    AWS_SECRET_ACCESS_KEY: string;
    AWS_REGION: string;
    AWS_S3_BUCKET_NAME: string;
    AWS_S3_ENDPOINT: string;
  };
}

interface S3Configuration {
  source: 'database' | 'environment' | 'none';
  enabled: boolean;
  region?: string;
  bucketName?: string;
  endpoint?: string | null;
  accessKeyId?: string | null;
  secretAccessKey?: string | null;
  updatedAt?: string;
  updatedBy?: number;
  message?: string;
}

interface MigrationResponse {
  dryRun: boolean;
  migrated: number;
  failed: number;
  skipped: number;
  message?: string;
}

interface S3TestResponse {
  success: boolean;
  message: string;
}

interface S3MigrateResponse {
  success: boolean;
  message: string;
}

interface SESConfiguration {
  configured: boolean;
  enabled: boolean;
  verified: boolean;
  fromEmail?: string;
  fromName?: string;
  region?: string;
  lastVerifiedAt?: string;
}

interface SESTestResponse {
  message: string;
  details?: string;
}

interface DocusealConfiguration {
  id?: number;
  apiKey?: string;
  environment?: string;
  baseUrl?: string;
  name?: string;
  enabled?: boolean;
  lastTestAt?: string;
  lastTestSuccess?: boolean;
  lastTestError?: string;
}

interface DocusealTemplate {
  id: number;
  templateId: string;
  name: string;
  description?: string;
  enabled: boolean;
  requiredForOnboarding: boolean;
  category?: string;
  sortOrder: number;
  tags?: string[];
  lastSyncedAt?: string;
}

/**
 * Comprehensive system settings and configuration management page
 * @component
 * @returns {JSX.Element} Multi-section settings interface for system administration
 * @example
 * <Settings />
 * 
 * @description
 * - User Management: Create/delete user accounts with role-based access control
 * - S3 Storage Configuration: Object storage setup with AWS S3 or compatible services
 * - SES Email Configuration: Amazon SES setup for system email notifications
 * - DocuSeal Integration: Document signing service configuration and template management
 * - System Settings: Global preferences for notifications, alerts, and automation
 * - Role-based access control: Different features available based on user role (admin/hr/viewer)
 * - Real-time configuration testing with connection validation
 * - Database migration tools for storage configuration changes
 * - Email verification workflow for SES setup
 * - Template synchronization with DocuSeal service
 * - Advanced configuration options with environment variable support
 * - Comprehensive error handling and user feedback
 * - Uses data-testid attributes for testing automation
 * - Security-focused with credential protection and validation
 */
export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === 'admin';
  const [migrateDialogOpen, setMigrateDialogOpen] = useState(false);
  const [migrationBatchSize, setMigrationBatchSize] = useState(10);
  const [migrationDryRun, setMigrationDryRun] = useState(true);
  const [s3ConfigDialogOpen, setS3ConfigDialogOpen] = useState(false);
  const [testingS3, setTestingS3] = useState(false);
  const [s3FormData, setS3FormData] = useState({
    accessKeyId: "",
    secretAccessKey: "",
    region: "us-east-1",
    bucketName: "",
    endpoint: "",
    enabled: true
  });
  const [sesConfigDialogOpen, setSesConfigDialogOpen] = useState(false);
  const [testEmailDialogOpen, setTestEmailDialogOpen] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState("");
  const [docusealConfigDialogOpen, setDocusealConfigDialogOpen] = useState(false);
  const [docusealFormData, setDocusealFormData] = useState({
    apiKey: "",
    environment: "production",
    name: "DocuSeal Configuration",
    baseUrl: "https://api.docuseal.co"
  });
  const [docusealTestLoading, setDocusealTestLoading] = useState(false);
  const [docusealSyncLoading, setDocusealSyncLoading] = useState(false);
  const [docusealTemplateDialogOpen, setDocusealTemplateDialogOpen] = useState(false);
  const [sesFormData, setSesFormData] = useState({
    accessKeyId: "",
    secretAccessKey: "",
    region: "us-east-1",
    fromEmail: "",
    fromName: "HR Management System",
    enabled: true
  });
  const [settings, setSettings] = useState<SystemSettings>({
    emailAlertsEnabled: true,
    dailyReportsEnabled: true,
    weeklyAuditSummaries: false,
    licenseExpiryWarningDays: 30,
    caqhReattestationWarningDays: 90
  });
  
  // Required Documents state
  const [documentTypeDialogOpen, setDocumentTypeDialogOpen] = useState(false);
  const [editingDocumentType, setEditingDocumentType] = useState<RequiredDocumentType | null>(null);
  const [deleteDocumentTypeId, setDeleteDocumentTypeId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("general");

  // S3 Storage Status Query
  const { data: s3Status, isLoading: s3StatusLoading } = useQuery<S3Status>({
    queryKey: ["/api/storage/status"],
    enabled: isAdmin || user?.role === 'hr'
  });

  // S3 Configuration Query (Admin and HR users)
  const { data: s3Config, isLoading: s3ConfigLoading } = useQuery<S3Configuration>({
    queryKey: ["/api/admin/s3-config"],
    enabled: isAdmin || user?.role === 'hr'
  });

  // SES Configuration Query (Admin and HR users)
  const { data: sesConfig, isLoading: sesConfigLoading } = useQuery<SESConfiguration>({
    queryKey: ["/api/admin/ses-config"],
    enabled: isAdmin || user?.role === 'hr'
  });

  // DocuSeal Configuration Query (Admin only)
  const { data: docusealConfig, isLoading: docusealConfigLoading } = useQuery<DocusealConfiguration>({
    queryKey: ["/api/admin/docuseal-config"],
    enabled: isAdmin
  });

  // DocuSeal Templates Query (Admin and HR users)
  const { data: docusealTemplates = [], isLoading: docusealTemplatesLoading } = useQuery<DocusealTemplate[]>({
    queryKey: ["/api/admin/docuseal-templates"],
    enabled: (isAdmin || user?.role === 'hr') && !!docusealConfig
  });
  
  // Required Document Types Query (Admin only)
  const { data: requiredDocuments = [], isLoading: requiredDocumentsLoading } = useQuery<RequiredDocumentType[]>({
    queryKey: ["/api/admin/required-documents"],
    enabled: isAdmin
  });


  // S3 Migration Mutation
  const migrateMutation = useMutation<MigrationResponse, Error, { batchSize: number; dryRun: boolean }>({
    mutationFn: async (data: { batchSize: number; dryRun: boolean }) => {
      const response = await apiRequest("POST", "/api/storage/migrate", data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.dryRun ? "Dry Run Complete" : "Migration Complete",
        description: `Migrated: ${data.migrated}, Failed: ${data.failed}, Skipped: ${data.skipped}`
      });
      queryClient.invalidateQueries({ queryKey: ["/api/storage/status"] });
      setMigrateDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Migration Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });



  const saveSettingsMutation = useMutation({
    mutationFn: (settingsData: SystemSettings) => apiRequest("PUT", "/api/settings", settingsData),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Settings saved successfully"
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // S3 Configuration Mutations
  const updateS3ConfigMutation = useMutation({
    mutationFn: (configData: typeof s3FormData) => 
      apiRequest("PUT", "/api/admin/s3-config", configData),
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: "S3 configuration updated successfully"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/s3-config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/storage/status"] });
      setS3ConfigDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const testS3ConfigMutation = useMutation<any, Error, typeof s3FormData>({
    mutationFn: async (configData: typeof s3FormData) => {
      const response = await apiRequest("POST", "/api/admin/s3-config/test", configData);
      const data = await response.json();
      
      console.log('S3 Test Response:', {
        status: response.status,
        ok: response.ok,
        data,
        canCreate: data.details?.canCreate,
        errorCode: data.details?.errorCode
      });
      
      // Check if this is a 404 (bucket doesn't exist)
      if (response.status === 404 && data.details?.canCreate === true) {
        console.log('Bucket does not exist, showing create dialog...');
        // Show confirmation dialog to create bucket
        if (confirm(`The bucket "${configData.bucketName}" does not exist.\n\nWould you like to create it?`)) {
          // Create the bucket
          const createResponse = await apiRequest("POST", "/api/admin/s3-config/create-bucket", configData);
          const createData = await createResponse.json();
          
          if (createResponse.ok) {
            // Bucket created successfully, now test again
            const retestResponse = await apiRequest("POST", "/api/admin/s3-config/test", configData);
            return retestResponse.json();
          } else {
            throw new Error(createData.error || 'Failed to create bucket');
          }
        } else {
          // User cancelled bucket creation
          return data;
        }
      }
      
      // Check for region mismatch
      if (!response.ok && data.details?.errorCode === 'PermanentRedirect' && data.details?.correctRegion) {
        // Automatically update the region in the form
        const correctRegion = data.details.correctRegion;
        if (confirm(`The bucket "${configData.bucketName}" exists in region "${correctRegion}".\n\nWould you like to switch to that region and try again?`)) {
          // Update the form data with correct region
          setS3FormData(prev => ({ ...prev, region: correctRegion }));
          // Retry with correct region
          const retryResponse = await apiRequest("POST", "/api/admin/s3-config/test", {
            ...configData,
            region: correctRegion
          });
          return retryResponse.json();
        }
      }
      
      if (!response.ok && response.status !== 404) {
        // Return the error data for display
        return data;
      }
      
      return data;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Connection Successful",
          description: data.message,
          variant: "default"
        });
      } else {
        // Show detailed error message
        toast({
          title: data.message || "Connection Failed",
          description: data.error || data.details?.suggestion || "Check your configuration",
          variant: "destructive"
        });
      }
      setTestingS3(false);
    },
    onError: (error) => {
      toast({
        title: "Test Failed",
        description: error.message,
        variant: "destructive"
      });
      setTestingS3(false);
    }
  });

  const migrateS3ConfigMutation = useMutation<S3MigrateResponse, Error>({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/s3-config/migrate");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: data.message
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/s3-config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/storage/status"] });
    },
    onError: (error) => {
      toast({
        title: "Migration Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // SES Configuration Mutations
  const updateSesConfigMutation = useMutation({
    mutationFn: (configData: typeof sesFormData) => 
      apiRequest("POST", "/api/admin/ses-config", configData),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "SES configuration saved successfully"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ses-config"] });
      setSesConfigDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const testSesEmailMutation = useMutation<SESTestResponse, Error, { testEmail: string }>({
    mutationFn: async (data: { testEmail: string }) => {
      const response = await apiRequest("POST", "/api/admin/ses-config/test", data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: data.message || "Test email sent successfully",
      });
      setTestEmailDialogOpen(false);
      setTestEmailAddress("");
    },
    onError: (error) => {
      toast({
        title: "Test Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const verifySesEmailMutation = useMutation({
    mutationFn: (email: string) => 
      apiRequest("POST", "/api/admin/ses-config/verify", { email }),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Verification email sent. Please check your inbox and click the verification link."
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ses-config"] });
    },
    onError: (error) => {
      toast({
        title: "Verification Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Required Document Types Mutations
  const createDocumentTypeMutation = useMutation({
    mutationFn: (data: InsertRequiredDocumentType) => 
      apiRequest("POST", "/api/admin/required-documents", data),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Document type created successfully"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/required-documents"] });
      setDocumentTypeDialogOpen(false);
      setEditingDocumentType(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  const updateDocumentTypeMutation = useMutation({
    mutationFn: ({ id, ...data }: RequiredDocumentType) => 
      apiRequest("PUT", `/api/admin/required-documents/${id}`, data),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Document type updated successfully"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/required-documents"] });
      setDocumentTypeDialogOpen(false);
      setEditingDocumentType(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  const deleteDocumentTypeMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest("DELETE", `/api/admin/required-documents/${id}`),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Document type deleted successfully"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/required-documents"] });
      setDeleteDocumentTypeId(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  const reorderDocumentTypeMutation = useMutation({
    mutationFn: ({ id, sortOrder }: { id: number; sortOrder: number }) => 
      apiRequest("PUT", `/api/admin/required-documents/${id}`, { sortOrder }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/required-documents"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to reorder document type",
        variant: "destructive"
      });
    }
  });


  const handleSaveSettings = () => {
    saveSettingsMutation.mutate(settings);
  };

  const handleSettingChange = (key: keyof SystemSettings, value: boolean | number) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleTestS3Connection = () => {
    setTestingS3(true);
    testS3ConfigMutation.mutate(s3FormData);
  };

  const handleSaveS3Config = () => {
    updateS3ConfigMutation.mutate(s3FormData);
  };

  const handleOpenS3ConfigDialog = () => {
    // Pre-fill form with current configuration if exists
    if (s3Config && s3Config.source !== 'none') {
      setS3FormData({
        accessKeyId: "", // Don't pre-fill sensitive data
        secretAccessKey: "", // Don't pre-fill sensitive data
        region: s3Config.region || "us-east-1",
        bucketName: s3Config.bucketName || "",
        endpoint: s3Config.endpoint || "",
        enabled: s3Config.enabled
      });
    }
    setS3ConfigDialogOpen(true);
  };

  const handleOpenSesConfigDialog = () => {
    // Pre-fill form with current configuration if exists
    if (sesConfig && sesConfig.configured) {
      setSesFormData({
        accessKeyId: "", // Don't pre-fill sensitive data
        secretAccessKey: "", // Don't pre-fill sensitive data
        region: sesConfig.region || "us-east-1",
        fromEmail: sesConfig.fromEmail || "",
        fromName: sesConfig.fromName || "HR Management System",
        enabled: sesConfig.enabled
      });
    }
    setSesConfigDialogOpen(true);
  };

  const handleSaveSesConfig = () => {
    updateSesConfigMutation.mutate(sesFormData);
  };

  const handleTestSesEmail = () => {
    if (testEmailAddress) {
      testSesEmailMutation.mutate({ testEmail: testEmailAddress });
    }
  };

  const handleVerifySesEmail = () => {
    if (sesConfig?.fromEmail) {
      verifySesEmailMutation.mutate(sesConfig.fromEmail);
    } else if (sesFormData.fromEmail) {
      verifySesEmailMutation.mutate(sesFormData.fromEmail);
    }
  };
  
  const handleMoveDocumentType = (id: number, direction: "up" | "down") => {
    const sortedDocs = [...requiredDocuments].sort((a, b) => a.sortOrder - b.sortOrder);
    const currentIndex = sortedDocs.findIndex(doc => doc.id === id);
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    
    if (targetIndex >= 0 && targetIndex < sortedDocs.length) {
      const currentDoc = sortedDocs[currentIndex];
      const targetDoc = sortedDocs[targetIndex];
      
      // Swap sort orders
      reorderDocumentTypeMutation.mutate({ id: currentDoc.id, sortOrder: targetDoc.sortOrder });
      reorderDocumentTypeMutation.mutate({ id: targetDoc.id, sortOrder: currentDoc.sortOrder });
    }
  };
  
  const documentTypeForm = useForm<InsertRequiredDocumentType>({
    resolver: zodResolver(insertRequiredDocumentTypeSchema),
    defaultValues: {
      name: "",
      description: "",
      category: "tax",
      isRequired: true,
      sortOrder: 0
    }
  });
  
  const onSubmitDocumentType = (data: InsertRequiredDocumentType) => {
    if (editingDocumentType) {
      updateDocumentTypeMutation.mutate({ ...editingDocumentType, ...data });
    } else {
      createDocumentTypeMutation.mutate(data);
    }
  };
  
  const handleEditDocumentType = (doc: RequiredDocumentType) => {
    setEditingDocumentType(doc);
    documentTypeForm.reset({
      name: doc.name,
      description: doc.description || "",
      category: doc.category as "tax" | "compliance" | "payroll" | "identification" | "other",
      isRequired: doc.isRequired,
      sortOrder: doc.sortOrder
    });
    setDocumentTypeDialogOpen(true);
  };
  
  const handleAddDocumentType = () => {
    setEditingDocumentType(null);
    documentTypeForm.reset({
      name: "",
      description: "",
      category: "tax",
      isRequired: true,
      sortOrder: requiredDocuments.length > 0 ? Math.max(...requiredDocuments.map(d => d.sortOrder)) + 1 : 0
    });
    setDocumentTypeDialogOpen(true);
  };
  
  const getCategoryBadgeColor = (category: string) => {
    switch (category) {
      case "tax": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      case "compliance": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "payroll": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "identification": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };


  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground flex items-center" data-testid="text-settings-title">
            <SettingsIcon className="w-8 h-8 mr-3" />
            Settings
          </h1>
          <p className="text-muted-foreground">Manage system configuration and user accounts</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* User Management Navigation */}
          {isAdmin && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="w-5 h-5 mr-2" />
                  User Management
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-muted-foreground">
                    Manage user accounts, roles, and permissions for the HR management system.
                  </p>
                  <Link href="/settings/users">
                    <Button className="w-full" data-testid="link-manage-users">
                      <Users className="w-4 h-4 mr-2" />
                      Manage Users
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {/* System Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Bell className="w-5 h-5 mr-2" />
                System Configuration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Notification Settings */}
                <div>
                  <Label className="text-base font-medium">Notification Settings</Label>
                  <div className="space-y-3 mt-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="emailAlerts"
                        checked={settings.emailAlertsEnabled}
                        onCheckedChange={(checked) => handleSettingChange("emailAlertsEnabled", !!checked)}
                        data-testid="checkbox-email-alerts"
                      />
                      <Label htmlFor="emailAlerts" className="text-sm">Email alerts for expiring licenses</Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="dailyReports"
                        checked={settings.dailyReportsEnabled}
                        onCheckedChange={(checked) => handleSettingChange("dailyReportsEnabled", !!checked)}
                        data-testid="checkbox-daily-reports"
                      />
                      <Label htmlFor="dailyReports" className="text-sm">Daily compliance reports</Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="weeklyAudits"
                        checked={settings.weeklyAuditSummaries}
                        onCheckedChange={(checked) => handleSettingChange("weeklyAuditSummaries", !!checked)}
                        data-testid="checkbox-weekly-audits"
                      />
                      <Label htmlFor="weeklyAudits" className="text-sm">Weekly audit summaries</Label>
                    </div>
                  </div>
                </div>

                {/* Alert Thresholds */}
                <div>
                  <Label className="text-base font-medium">Alert Thresholds</Label>
                  <div className="grid grid-cols-1 gap-4 mt-2">
                    <div>
                      <Label htmlFor="licenseWarning" className="text-sm">License expiry warning (days)</Label>
                      <Input
                        id="licenseWarning"
                        type="number"
                        value={settings.licenseExpiryWarningDays}
                        onChange={(e) => handleSettingChange("licenseExpiryWarningDays", parseInt(e.target.value) || 30)}
                        min="1"
                        max="365"
                        data-testid="input-license-warning-days"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="caqhWarning" className="text-sm">CAQH re-attestation warning (days)</Label>
                      <Input
                        id="caqhWarning"
                        type="number"
                        value={settings.caqhReattestationWarningDays}
                        onChange={(e) => handleSettingChange("caqhReattestationWarningDays", parseInt(e.target.value) || 90)}
                        min="1"
                        max="365"
                        data-testid="input-caqh-warning-days"
                      />
                    </div>
                  </div>
                </div>

                <Button 
                  onClick={handleSaveSettings}
                  disabled={saveSettingsMutation.isPending}
                  className="w-full"
                  data-testid="button-save-settings"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saveSettingsMutation.isPending ? "Saving..." : "Save Settings"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Required Documents Configuration - Admin Only */}
        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <FileText className="w-5 h-5 mr-2" />
                  Required Documents Configuration
                </div>
                <Button
                  onClick={handleAddDocumentType}
                  size="sm"
                  data-testid="button-add-document-type"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Document Type
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {requiredDocumentsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center space-x-4">
                      <Skeleton className="h-12 flex-1" />
                    </div>
                  ))}
                </div>
              ) : requiredDocuments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No document types configured yet.</p>
                  <p className="text-sm mt-2">Click "Add Document Type" to get started.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">Order</TableHead>
                        <TableHead>Document Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-center">Required</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...requiredDocuments].sort((a, b) => a.sortOrder - b.sortOrder).map((doc, index) => (
                        <TableRow key={doc.id}>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleMoveDocumentType(doc.id, "up")}
                                disabled={index === 0}
                              >
                                <ChevronUp className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleMoveDocumentType(doc.id, "down")}
                                disabled={index === requiredDocuments.length - 1}
                              >
                                <ChevronDown className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{doc.name}</TableCell>
                          <TableCell>
                            <Badge className={getCategoryBadgeColor(doc.category)}>
                              {doc.category.charAt(0).toUpperCase() + doc.category.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {doc.description || <span className="text-muted-foreground">No description</span>}
                          </TableCell>
                          <TableCell className="text-center">
                            {doc.isRequired ? (
                              <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />
                            ) : (
                              <XCircle className="w-5 h-5 text-gray-400 mx-auto" />
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditDocumentType(doc)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteDocumentTypeId(doc.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Document Type Dialog */}
        <Dialog open={documentTypeDialogOpen} onOpenChange={(open) => {
          if (!open) {
            setEditingDocumentType(null);
            documentTypeForm.reset();
          }
          setDocumentTypeDialogOpen(open);
        }}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {editingDocumentType ? "Edit Document Type" : "Add Document Type"}
              </DialogTitle>
            </DialogHeader>
            <Form {...documentTypeForm}>
              <form onSubmit={documentTypeForm.handleSubmit(onSubmitDocumentType)} className="space-y-4">
                <FormField
                  control={documentTypeForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Document Name *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="e.g., W-4 Form"
                          data-testid="input-document-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={documentTypeForm.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-document-category">
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="tax">Tax</SelectItem>
                          <SelectItem value="compliance">Compliance</SelectItem>
                          <SelectItem value="payroll">Payroll</SelectItem>
                          <SelectItem value="identification">Identification</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={documentTypeForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Describe the purpose of this document..."
                          className="resize-none"
                          rows={3}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={documentTypeForm.control}
                  name="isRequired"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          Required Document
                        </FormLabel>
                        <FormDescription>
                          Is this document mandatory for all employees?
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-is-required"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={documentTypeForm.control}
                  name="sortOrder"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sort Order</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>
                        Lower numbers appear first in the list
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDocumentTypeDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createDocumentTypeMutation.isPending || updateDocumentTypeMutation.isPending}
                  >
                    {createDocumentTypeMutation.isPending || updateDocumentTypeMutation.isPending ? (
                      "Saving..."
                    ) : editingDocumentType ? (
                      "Update"
                    ) : (
                      "Create"
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDocumentTypeId !== null} onOpenChange={(open) => !open && setDeleteDocumentTypeId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Document Type</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this document type? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deleteDocumentTypeId) {
                    deleteDocumentTypeMutation.mutate(deleteDocumentTypeId);
                  }
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* S3 Storage Configuration */}
        {(isAdmin || user?.role === 'hr') && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Cloud className="w-5 h-5 mr-2" />
                Document Storage (Amazon S3)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {s3StatusLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : s3Status ? (
                <div className="space-y-4">
                  {/* S3 Configuration Status */}
                  <div className="p-4 bg-muted/50 rounded-lg">
                    {/* Show both config saved status and bucket exists status */}
                    <div className="space-y-3">
                      {/* Configuration saved status */}
                      <div className="flex items-center">
                        {s3Config && s3Config.source !== 'none' ? (
                          <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                        ) : (
                          <XCircle className="w-5 h-5 text-yellow-500 mr-2" />
                        )}
                        <span className="font-medium">
                          Configuration: {s3Config && s3Config.source !== 'none' ? 'Saved' : 'Not Set'}
                        </span>
                      </div>
                      
                      {/* Bucket exists status */}
                      <div className="flex items-center">
                        {s3Status?.configured ? (
                          <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                        ) : (
                          <XCircle className="w-5 h-5 text-destructive mr-2" />
                        )}
                        <span className="font-medium">
                          Bucket Status: {s3Status?.configured ? 'Active & Accessible' : 'Not Accessible'}
                        </span>
                      </div>
                    </div>
                    
                    {/* Show config details if saved */}
                    {s3Config && s3Config.source !== 'none' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm mt-3 pt-3 border-t">
                        <div>
                          <span className="text-muted-foreground">Bucket Name:</span>{' '}
                          <span className="font-medium">{s3Config?.bucketName || 'Not set'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Region:</span>{' '}
                          <span className="font-medium">{s3Config?.region || 'Not set'}</span>
                        </div>
                      </div>
                    )}
                    
                    {/* Show warning if config saved but bucket not accessible */}
                    {s3Config && s3Config.source !== 'none' && !s3Status?.configured && (
                      <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
                        <p className="text-sm text-amber-900 dark:text-amber-200 mb-3">
                          ⚠️ Configuration is saved but the bucket "{s3Config.bucketName}" is not accessible. 
                          The bucket may not exist or you may not have permissions to access it.
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => {
                              // Create bucket using saved config
                              const createBucket = async () => {
                                try {
                                  const response = await apiRequest("POST", "/api/admin/s3-config/create-bucket", {
                                    accessKeyId: "", // Will use saved config
                                    secretAccessKey: "", // Will use saved config
                                    region: s3Config.region,
                                    bucketName: s3Config.bucketName,
                                    endpoint: s3Config.endpoint
                                  });
                                  const data = await response.json();
                                  
                                  if (response.ok) {
                                    toast({
                                      title: "Bucket Created",
                                      description: `Successfully created bucket: ${s3Config.bucketName}`,
                                      variant: "default"
                                    });
                                    // Refresh status
                                    queryClient.invalidateQueries({ queryKey: ["/api/storage/status"] });
                                    queryClient.invalidateQueries({ queryKey: ["/api/admin/s3-config"] });
                                  } else {
                                    toast({
                                      title: "Failed to Create Bucket",
                                      description: data.error || data.message || "Unknown error",
                                      variant: "destructive"
                                    });
                                  }
                                } catch (error: any) {
                                  toast({
                                    title: "Error",
                                    description: error.message,
                                    variant: "destructive"
                                  });
                                }
                              };
                              createBucket();
                            }}
                            data-testid="button-create-s3-bucket"
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Create Bucket
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setS3ConfigDialogOpen(true)}
                            data-testid="button-update-s3-config"
                          >
                            Update Configuration
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Storage Statistics */}
                  <div>
                    <Label className="text-base font-medium mb-2">Storage Statistics</Label>
                    <div className="grid grid-cols-3 gap-4 mt-2">
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <p className="text-2xl font-bold">{s3Status?.statistics?.totalDocuments || 0}</p>
                        <p className="text-sm text-muted-foreground">Total Documents</p>
                      </div>
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <Database className="w-5 h-5 mx-auto mb-1 text-primary" />
                        <p className="text-xl font-bold">{s3Status?.statistics?.localDocuments || 0}</p>
                        <p className="text-sm text-muted-foreground">Local Storage</p>
                      </div>
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <Cloud className="w-5 h-5 mx-auto mb-1 text-primary" />
                        <p className="text-xl font-bold">{s3Status?.statistics?.s3Documents || 0}</p>
                        <p className="text-sm text-muted-foreground">S3 Storage</p>
                      </div>
                    </div>
                    
                    {(s3Status?.statistics?.totalDocuments || 0) > 0 && (
                      <div className="mt-3">
                        <div className="flex justify-between text-sm mb-1">
                          <span>S3 Usage</span>
                          <span className="font-medium">{s3Status?.statistics?.s3Percentage || '0'}%</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div 
                            className="bg-primary rounded-full h-2" 
                            style={{ width: `${s3Status?.statistics?.s3Percentage || '0'}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Environment Variables Status */}
                  <div>
                    <Label className="text-base font-medium mb-2">Environment Configuration</Label>
                    <div className="space-y-2 text-sm">
                      {Object.entries(s3Status?.environment || {}).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                          <span className="font-mono text-xs">{key}</span>
                          <Badge 
                            variant={value === 'configured' ? 'default' : 'secondary'}
                            className={value === 'configured' ? 'bg-green-500/10 text-green-600' : ''}
                          >
                            {value}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Migration Actions */}
                  {isAdmin && s3Status?.configured && (s3Status?.statistics?.localDocuments || 0) > 0 && (
                    <div className="pt-4 border-t">
                      <Label className="text-base font-medium mb-2">Document Migration</Label>
                      <p className="text-sm text-muted-foreground mb-3">
                        Migrate {s3Status?.statistics?.localDocuments || 0} local documents to S3 storage.
                      </p>
                      
                      <Dialog open={migrateDialogOpen} onOpenChange={setMigrateDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" className="w-full">
                            <ArrowUpCircle className="w-4 h-4 mr-2" />
                            Migrate Documents to S3
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Migrate Documents to S3</DialogTitle>
                          </DialogHeader>
                          
                          <div className="space-y-4 py-4">
                            <div>
                              <Label htmlFor="batchSize">Batch Size</Label>
                              <Input
                                id="batchSize"
                                type="number"
                                value={migrationBatchSize}
                                onChange={(e) => setMigrationBatchSize(Math.min(100, Math.max(1, parseInt(e.target.value) || 10)))}
                                min="1"
                                max="100"
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                Number of documents to migrate at once (max 100)
                              </p>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="dryRun"
                                checked={migrationDryRun}
                                onCheckedChange={(checked) => setMigrationDryRun(!!checked)}
                              />
                              <Label htmlFor="dryRun">
                                Dry Run (simulate migration without changes)
                              </Label>
                            </div>
                            
                            <Button
                              onClick={() => migrateMutation.mutate({ 
                                batchSize: migrationBatchSize, 
                                dryRun: migrationDryRun 
                              })}
                              disabled={migrateMutation.isPending}
                              className="w-full"
                            >
                              {migrateMutation.isPending 
                                ? "Migrating..." 
                                : migrationDryRun 
                                  ? "Run Migration Test" 
                                  : "Start Migration"}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  )}

                  {/* S3 Configuration - Admin and HR users */}
                  {(isAdmin || user?.role === 'hr') && (
                    <div className="pt-4 border-t">
                      <div className="flex items-center justify-between mb-3">
                        <Label className="text-base font-medium">S3 Configuration</Label>
                        {s3ConfigLoading ? (
                          <Badge variant="secondary">Loading...</Badge>
                        ) : s3Config ? (
                          <Badge 
                            variant={s3Config.source === 'database' ? 'default' : 'secondary'}
                            className={s3Config.source === 'database' ? 'bg-green-500/10 text-green-600' : ''}
                          >
                            {s3Config.source === 'database' ? 'Database Config' : 
                             s3Config.source === 'environment' ? 'Env Variables' : 'Not Configured'}
                          </Badge>
                        ) : null}
                      </div>
                      
                      {s3Config?.source === 'database' && s3Config.updatedAt && (
                        <p className="text-sm text-muted-foreground mb-3">
                          Last updated: {new Date(s3Config.updatedAt).toLocaleString()}
                        </p>
                      )}
                      
                      <div className="space-y-2">
                        <Dialog open={s3ConfigDialogOpen} onOpenChange={setS3ConfigDialogOpen}>
                          <DialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              className="w-full"
                              onClick={handleOpenS3ConfigDialog}
                              data-testid="button-configure-s3"
                            >
                              <SettingsIcon className="w-4 h-4 mr-2" />
                              Configure S3 Settings
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Configure AWS S3 Storage</DialogTitle>
                            </DialogHeader>
                            
                            <div className="space-y-4 py-4">
                              {s3Config?.message && (
                                <div className="p-3 bg-amber-500/10 text-amber-700 rounded-lg text-sm">
                                  {s3Config.message}
                                </div>
                              )}
                              
                              <div>
                                <Label htmlFor="s3-access-key">AWS Access Key ID</Label>
                                <Input
                                  id="s3-access-key"
                                  type="text"
                                  value={s3FormData.accessKeyId}
                                  onChange={(e) => setS3FormData(prev => ({ ...prev, accessKeyId: e.target.value }))}
                                  placeholder="AKIA..."
                                  data-testid="input-s3-access-key"
                                />
                                {s3Config?.accessKeyId && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Current: {s3Config.accessKeyId}
                                  </p>
                                )}
                              </div>
                              
                              <div>
                                <Label htmlFor="s3-secret-key">AWS Secret Access Key</Label>
                                <Input
                                  id="s3-secret-key"
                                  type="password"
                                  value={s3FormData.secretAccessKey}
                                  onChange={(e) => setS3FormData(prev => ({ ...prev, secretAccessKey: e.target.value }))}
                                  placeholder="Enter secret key"
                                  data-testid="input-s3-secret-key"
                                />
                                {s3Config?.secretAccessKey && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Current: ****
                                  </p>
                                )}
                              </div>
                              
                              <div>
                                <Label htmlFor="s3-region">AWS Region</Label>
                                <select
                                  id="s3-region"
                                  value={s3FormData.region}
                                  onChange={(e) => setS3FormData(prev => ({ ...prev, region: e.target.value }))}
                                  className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                                  data-testid="select-s3-region"
                                >
                                  <option value="us-east-1">US East (N. Virginia)</option>
                                  <option value="us-east-2">US East (Ohio)</option>
                                  <option value="us-west-1">US West (N. California)</option>
                                  <option value="us-west-2">US West (Oregon)</option>
                                  <option value="eu-west-1">Europe (Ireland)</option>
                                  <option value="eu-central-1">Europe (Frankfurt)</option>
                                  <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
                                  <option value="ap-northeast-1">Asia Pacific (Tokyo)</option>
                                </select>
                              </div>
                              
                              <div>
                                <Label htmlFor="s3-bucket">Bucket Name</Label>
                                <Input
                                  id="s3-bucket"
                                  type="text"
                                  value={s3FormData.bucketName}
                                  onChange={(e) => setS3FormData(prev => ({ ...prev, bucketName: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                                  placeholder="my-company-hr-docs-2025"
                                  data-testid="input-s3-bucket"
                                />
                                <div className="mt-2 space-y-1">
                                  <p className="text-xs text-muted-foreground">
                                    ⚠️ Bucket names must be globally unique across ALL AWS accounts
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const randomSuffix = Math.random().toString(36).substring(2, 8);
                                      const suggestedName = `hr-docs-${randomSuffix}`;
                                      setS3FormData(prev => ({ ...prev, bucketName: suggestedName }));
                                    }}
                                    className="text-xs text-primary hover:underline"
                                  >
                                    Generate unique name: hr-docs-{Math.random().toString(36).substring(2, 8)}
                                  </button>
                                </div>
                              </div>
                              
                              <div>
                                <Label htmlFor="s3-endpoint">Custom Endpoint (Optional)</Label>
                                <Input
                                  id="s3-endpoint"
                                  type="text"
                                  value={s3FormData.endpoint}
                                  onChange={(e) => setS3FormData(prev => ({ ...prev, endpoint: e.target.value }))}
                                  placeholder="https://s3-compatible-endpoint.com"
                                  data-testid="input-s3-endpoint"
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                  For S3-compatible services like MinIO or DigitalOcean Spaces
                                </p>
                              </div>
                              
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id="s3-enabled"
                                  checked={s3FormData.enabled}
                                  onCheckedChange={(checked) => setS3FormData(prev => ({ ...prev, enabled: !!checked }))}
                                  data-testid="checkbox-s3-enabled"
                                />
                                <Label htmlFor="s3-enabled">Enable S3 storage</Label>
                              </div>
                              
                              <div className="flex gap-2">
                                <Button
                                  onClick={handleTestS3Connection}
                                  disabled={testingS3 || !s3FormData.accessKeyId || !s3FormData.secretAccessKey || !s3FormData.bucketName}
                                  variant="outline"
                                  className="flex-1"
                                  data-testid="button-test-s3"
                                >
                                  {testingS3 ? "Testing..." : "Test Connection"}
                                </Button>
                                
                                <Button
                                  onClick={handleSaveS3Config}
                                  disabled={updateS3ConfigMutation.isPending || !s3FormData.accessKeyId || !s3FormData.secretAccessKey || !s3FormData.bucketName}
                                  className="flex-1"
                                  data-testid="button-save-s3"
                                >
                                  {updateS3ConfigMutation.isPending ? "Saving..." : "Save Configuration"}
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                        
                        {s3Config?.source === 'environment' && (
                          <Button
                            onClick={() => migrateS3ConfigMutation.mutate()}
                            disabled={migrateS3ConfigMutation.isPending}
                            variant="secondary"
                            className="w-full"
                            data-testid="button-migrate-s3"
                          >
                            <ArrowUpCircle className="w-4 h-4 mr-2" />
                            {migrateS3ConfigMutation.isPending ? "Migrating..." : "Migrate from Environment Variables"}
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Configuration Help */}
                  {!isAdmin && !s3Status?.configured && (
                    <div className="mt-4 p-4 bg-muted/30 rounded-lg">
                      <p className="text-sm font-medium mb-2">S3 storage is not configured.</p>
                      <p className="text-sm text-muted-foreground">
                        Please contact an administrator to configure S3 storage settings.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">Unable to fetch storage status</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Email Configuration (AWS SES) - Admin and HR users */}
        {(isAdmin || user?.role === 'hr') && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Mail className="w-5 h-5 mr-2" />
                Email Configuration (AWS SES)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sesConfigLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* SES Configuration Status */}
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center mb-3">
                      {sesConfig?.configured ? (
                        <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                      ) : (
                        <XCircle className="w-5 h-5 text-destructive mr-2" />
                      )}  
                      <span className="font-medium">
                        SES Email {sesConfig?.configured ? 'Configured' : 'Not Configured'}
                      </span>
                    </div>
                    
                    {sesConfig?.configured && (
                      <div className="space-y-2 text-sm">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <div>
                            <span className="text-muted-foreground">From Email:</span>{' '}
                            <span className="font-medium">{sesConfig?.fromEmail || 'Not set'}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Region:</span>{' '}
                            <span className="font-medium">{sesConfig?.region || 'Not set'}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Status:</span>
                          {sesConfig?.enabled ? (
                            <Badge className="bg-green-500/10 text-green-500">Enabled</Badge>
                          ) : (
                            <Badge className="bg-yellow-500/10 text-yellow-500">Disabled</Badge>
                          )}
                          {sesConfig?.verified ? (
                            <Badge className="bg-green-500/10 text-green-500">
                              <MailCheck className="w-3 h-3 mr-1" />
                              Verified
                            </Badge>
                          ) : (
                            <Badge className="bg-yellow-500/10 text-yellow-500">Unverified</Badge>
                          )}
                        </div>
                        {sesConfig?.lastVerifiedAt && (
                          <div>
                            <span className="text-muted-foreground">Last Verified:</span>{' '}
                            <span className="font-medium">
                              {new Date(sesConfig.lastVerifiedAt).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Configuration Details */}
                  {sesConfig?.configured && (
                    <div>
                      <Label className="text-base font-medium mb-2">Configuration Details</Label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm mt-2">
                        <div className="p-2 bg-muted/30 rounded">
                          <span className="text-muted-foreground">Access Key ID:</span>{' '}
                          <span className="font-mono text-xs">****</span>
                        </div>
                        <div className="p-2 bg-muted/30 rounded">
                          <span className="text-muted-foreground">Secret Access Key:</span>{' '}
                          <span className="font-mono text-xs">****</span>
                        </div>
                        <div className="p-2 bg-muted/30 rounded">
                          <span className="text-muted-foreground">From Name:</span>{' '}
                          <span className="font-medium">{sesConfig?.fromName || 'HR Management System'}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2 mt-4">
                    <Button 
                      onClick={handleOpenSesConfigDialog} 
                      variant="outline"
                      data-testid="button-configure-ses"
                    >
                      <SettingsIcon className="w-4 h-4 mr-2" />
                      {sesConfig?.configured ? 'Update Configuration' : 'Configure SES'}
                    </Button>
                    
                    {sesConfig?.configured && (
                      <>
                        <Button
                          onClick={() => setTestEmailDialogOpen(true)}
                          variant="secondary"
                          data-testid="button-test-email"
                        >
                          <Send className="w-4 h-4 mr-2" />
                          Test Email
                        </Button>
                        
                        {!sesConfig?.verified && (
                          <Button
                            onClick={handleVerifySesEmail}
                            variant="secondary"
                            disabled={verifySesEmailMutation.isPending}
                            data-testid="button-verify-email"
                          >
                            <MailCheck className="w-4 h-4 mr-2" />
                            {verifySesEmailMutation.isPending ? 'Sending...' : 'Verify Email'}
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                  
                  {/* Configuration Help */}
                  {!sesConfig?.configured && (
                    <div className="mt-4 p-4 bg-muted/30 rounded-lg">
                      <p className="text-sm font-medium mb-2">Email sending is not configured.</p>
                      <p className="text-sm text-muted-foreground">
                        Configure AWS SES to enable email invitations and notifications.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* API Keys Management */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center">
              <Key className="w-5 h-5 mr-2" />
              API Keys
            </CardTitle>
            <Link href="/settings/api-keys">
              <Button size="sm" variant="outline" data-testid="button-manage-api-keys">
                Manage API Keys
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Create and manage API keys for external application integration. 
              API keys provide secure, token-based authentication for programmatic access to the HR system.
            </p>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Key Rotation</p>
                <p className="font-medium">Automatic</p>
                <Badge variant="outline" className="mt-1">90 days</Badge>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Hashing</p>
                <p className="font-medium">bcrypt</p>
                <Badge variant="outline" className="mt-1">Secure</Badge>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Rate Limiting</p>
                <p className="font-medium">Per Key</p>
                <Badge variant="outline" className="mt-1">1000/hr</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="w-5 h-5 mr-2" />
              Security Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Current User</p>
                <p className="font-medium">{user?.username}</p>
                <div className="mt-1">
                  <Badge variant="secondary">{user?.role || "viewer"}</Badge>
                </div>
              </div>
              
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Password Hashing</p>
                <p className="font-medium">bcrypt</p>
                <div className="mt-1">
                  <Badge className="bg-secondary/10 text-secondary">Enabled</Badge>
                </div>
              </div>
              
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Data Encryption</p>
                <p className="font-medium">AES-256</p>
                <div className="mt-1">
                  <Badge className="bg-secondary/10 text-secondary">Active</Badge>
                </div>
              </div>
              
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Audit Logging</p>
                <p className="font-medium">All Actions</p>
                <div className="mt-1">
                  <Badge className="bg-secondary/10 text-secondary">Tracking</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* DocuSeal Forms Configuration Card */}
        {isAdmin && (
          <Card data-testid="card-docuseal-config">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FileSignature className="h-5 w-5" />
                  DocuSeal Forms Configuration
                </span>
                <div className="flex items-center gap-2">
                  {docusealConfig && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          setDocusealSyncLoading(true);
                          try {
                            const response = await apiRequest("POST", "/api/admin/docuseal-templates/sync");
                            const data = await response.json();
                            toast({
                              title: "Templates Synced",
                              description: data.message || "Templates synced successfully"
                            });
                            queryClient.invalidateQueries({ queryKey: ["/api/admin/docuseal-templates"] });
                          } catch (error) {
                            toast({
                              title: "Sync Failed",
                              description: "Failed to sync DocuSeal templates",
                              variant: "destructive"
                            });
                          }
                          setDocusealSyncLoading(false);
                        }}
                        disabled={docusealSyncLoading}
                        data-testid="button-sync-templates"
                      >
                        {docusealSyncLoading ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                        Sync Templates
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDocusealTemplateDialogOpen(true)}
                        data-testid="button-manage-templates"
                      >
                        Manage Templates
                      </Button>
                    </>
                  )}
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => {
                      if (docusealConfig) {
                        setDocusealFormData({
                          apiKey: "",
                          environment: docusealConfig.environment || "production",
                          name: docusealConfig.name || "DocuSeal Configuration",
                          baseUrl: docusealConfig.baseUrl || "https://api.docuseal.co"
                        });
                      }
                      setDocusealConfigDialogOpen(true);
                    }}
                    data-testid="button-configure-docuseal"
                  >
                    <SettingsIcon className="h-4 w-4" />
                    {docusealConfig ? "Update" : "Configure"}
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {docusealConfigLoading ? (
                <div className="text-center py-8">
                  <div className="inline-flex items-center gap-2 text-muted-foreground">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Loading configuration...
                  </div>
                </div>
              ) : docusealConfig ? (
                <div className="space-y-4">
                  <div className="bg-secondary/20 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        DocuSeal Configured
                      </h3>
                      {docusealConfig.lastTestAt && (
                        <Badge variant={docusealConfig.lastTestSuccess ? "secondary" : "destructive"}>
                          {docusealConfig.lastTestSuccess ? "Connection Verified" : "Connection Failed"}
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Environment:</span>
                        <span data-testid="text-docuseal-environment">{docusealConfig.environment}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">API Key:</span>
                        <span data-testid="text-docuseal-apikey">{docusealConfig.apiKey}</span>
                      </div>
                      {docusealConfig.lastTestAt && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Last Tested:</span>
                          <span data-testid="text-docuseal-lasttest">
                            {new Date(docusealConfig.lastTestAt).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Template Summary */}
                  {docusealTemplates.length > 0 && (
                    <div className="bg-accent/10 rounded-lg p-4">
                      <h3 className="text-sm font-medium mb-3">Template Summary</h3>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground block">Total Templates</span>
                          <span className="text-xl font-semibold" data-testid="text-total-templates">
                            {docusealTemplates.length}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">Enabled</span>
                          <span className="text-xl font-semibold" data-testid="text-enabled-templates">
                            {docusealTemplates.filter((t: DocusealTemplate) => t.enabled).length}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">Onboarding</span>
                          <span className="text-xl font-semibold" data-testid="text-onboarding-templates">
                            {docusealTemplates.filter((t: DocusealTemplate) => t.requiredForOnboarding).length}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={async () => {
                      setDocusealTestLoading(true);
                      try {
                        const response = await apiRequest("POST", "/api/admin/docuseal-config/test");
                        const data = await response.json();
                        toast({
                          title: "Connection Successful",
                          description: data.message || "DocuSeal API connection verified"
                        });
                        queryClient.invalidateQueries({ queryKey: ["/api/admin/docuseal-config"] });
                      } catch (error) {
                        toast({
                          title: "Connection Failed",
                          description: "Failed to connect to DocuSeal API",
                          variant: "destructive"
                        });
                      }
                      setDocusealTestLoading(false);
                    }}
                    disabled={docusealTestLoading}
                    data-testid="button-test-docuseal"
                  >
                    {docusealTestLoading ? (
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Link2 className="h-4 w-4 mr-2" />
                    )}
                    Test Connection
                  </Button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileSignature className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground mb-4">
                    Configure DocuSeal to enable document signing and form management
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* SES Configuration Dialog */}
        <Dialog open={sesConfigDialogOpen} onOpenChange={setSesConfigDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Configure AWS SES Email</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="ses-region">AWS Region</Label>
                <Input
                  id="ses-region"
                  value={sesFormData.region}
                  onChange={(e) => setSesFormData(prev => ({ ...prev, region: e.target.value }))}
                  placeholder="e.g., us-east-1"
                  data-testid="input-ses-region"
                />
              </div>
              <div>
                <Label htmlFor="ses-access-key">AWS Access Key ID</Label>
                <Input
                  id="ses-access-key"
                  type="password"
                  value={sesFormData.accessKeyId}
                  onChange={(e) => setSesFormData(prev => ({ ...prev, accessKeyId: e.target.value }))}
                  placeholder="Enter AWS Access Key ID"
                  data-testid="input-ses-access-key"
                />
              </div>
              <div>
                <Label htmlFor="ses-secret-key">AWS Secret Access Key</Label>
                <Input
                  id="ses-secret-key"
                  type="password"
                  value={sesFormData.secretAccessKey}
                  onChange={(e) => setSesFormData(prev => ({ ...prev, secretAccessKey: e.target.value }))}
                  placeholder="Enter AWS Secret Access Key"
                  data-testid="input-ses-secret-key"
                />
              </div>
              <div>
                <Label htmlFor="ses-from-email">From Email Address</Label>
                <Input
                  id="ses-from-email"
                  type="email"
                  value={sesFormData.fromEmail}
                  onChange={(e) => setSesFormData(prev => ({ ...prev, fromEmail: e.target.value }))}
                  placeholder="noreply@yourdomain.com"
                  data-testid="input-ses-from-email"
                />
              </div>
              <div>
                <Label htmlFor="ses-from-name">From Name</Label>
                <Input
                  id="ses-from-name"
                  value={sesFormData.fromName}
                  onChange={(e) => setSesFormData(prev => ({ ...prev, fromName: e.target.value }))}
                  placeholder="HR Management System"
                  data-testid="input-ses-from-name"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="ses-enabled"
                  checked={sesFormData.enabled}
                  onCheckedChange={(checked) => setSesFormData(prev => ({ ...prev, enabled: !!checked }))}
                  data-testid="checkbox-ses-enabled"
                />
                <Label htmlFor="ses-enabled">Enable email sending</Label>
              </div>
              <Button
                onClick={handleSaveSesConfig}
                disabled={updateSesConfigMutation.isPending || !sesFormData.accessKeyId || !sesFormData.secretAccessKey || !sesFormData.fromEmail}
                className="w-full"
                data-testid="button-save-ses-config"
              >
                {updateSesConfigMutation.isPending ? "Saving..." : "Save Configuration"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Test Email Dialog */}
        <Dialog open={testEmailDialogOpen} onOpenChange={setTestEmailDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Send Test Email</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Enter an email address to send a test email and verify your SES configuration is working.
              </p>
              <div>
                <Label htmlFor="test-email">Test Email Address</Label>
                <Input
                  id="test-email"
                  type="email"
                  value={testEmailAddress}
                  onChange={(e) => setTestEmailAddress(e.target.value)}
                  placeholder="test@example.com"
                  data-testid="input-test-email"
                />
              </div>
              <Button
                onClick={handleTestSesEmail}
                disabled={testSesEmailMutation.isPending || !testEmailAddress}
                className="w-full"
                data-testid="button-send-test-email"
              >
                <Send className="w-4 h-4 mr-2" />
                {testSesEmailMutation.isPending ? "Sending..." : "Send Test Email"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* DocuSeal Configuration Dialog */}
        <Dialog open={docusealConfigDialogOpen} onOpenChange={setDocusealConfigDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {docusealConfig ? "Update" : "Configure"} DocuSeal Integration
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="docuseal-apikey">API Key *</Label>
                <Input
                  id="docuseal-apikey"
                  type="password"
                  placeholder={docusealConfig ? "Enter new API key to update" : "Enter DocuSeal API key"}
                  value={docusealFormData.apiKey}
                  onChange={(e) => setDocusealFormData({ ...docusealFormData, apiKey: e.target.value })}
                  data-testid="input-docuseal-apikey"
                />
                <p className="text-sm text-muted-foreground">
                  Get your API key from your DocuSeal account settings
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="docuseal-environment">Environment</Label>
                <select
                  id="docuseal-environment"
                  className="w-full p-2 border rounded-md"
                  value={docusealFormData.environment}
                  onChange={(e) => setDocusealFormData({ ...docusealFormData, environment: e.target.value })}
                  data-testid="select-docuseal-environment"
                >
                  <option value="production">Production</option>
                  <option value="sandbox">Sandbox</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="docuseal-name">Configuration Name</Label>
                <Input
                  id="docuseal-name"
                  placeholder="e.g., Main DocuSeal Config"
                  value={docusealFormData.name}
                  onChange={(e) => setDocusealFormData({ ...docusealFormData, name: e.target.value })}
                  data-testid="input-docuseal-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="docuseal-baseurl">Base URL (Optional)</Label>
                <Input
                  id="docuseal-baseurl"
                  placeholder="https://api.docuseal.co"
                  value={docusealFormData.baseUrl}
                  onChange={(e) => setDocusealFormData({ ...docusealFormData, baseUrl: e.target.value })}
                  data-testid="input-docuseal-baseurl"
                />
                <p className="text-sm text-muted-foreground">
                  Leave empty to use the default DocuSeal API endpoint
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setDocusealConfigDialogOpen(false)}
                data-testid="button-cancel-docuseal"
              >
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  if (!docusealFormData.apiKey && !docusealConfig) {
                    toast({
                      title: "Validation Error",
                      description: "API key is required",
                      variant: "destructive"
                    });
                    return;
                  }

                  try {
                    const payload: any = { ...docusealFormData };
                    if (!docusealFormData.apiKey) {
                      delete payload.apiKey;
                    }

                    await apiRequest("POST", "/api/admin/docuseal-config", payload);

                    toast({
                      title: "Configuration Saved",
                      description: "DocuSeal configuration has been saved successfully"
                    });

                    queryClient.invalidateQueries({ queryKey: ["/api/admin/docuseal-config"] });
                    queryClient.invalidateQueries({ queryKey: ["/api/admin/docuseal-templates"] });
                    setDocusealConfigDialogOpen(false);
                    setDocusealFormData({
                      apiKey: "",
                      environment: "production",
                      name: "DocuSeal Configuration",
                      baseUrl: "https://api.docuseal.co"
                    });
                  } catch (error) {
                    toast({
                      title: "Configuration Failed",
                      description: "Failed to save DocuSeal configuration",
                      variant: "destructive"
                    });
                  }
                }}
                data-testid="button-save-docuseal"
              >
                Save Configuration
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* DocuSeal Templates Management Dialog */}
        <Dialog open={docusealTemplateDialogOpen} onOpenChange={setDocusealTemplateDialogOpen}>
          <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Manage DocuSeal Templates</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {docusealTemplatesLoading ? (
                <div className="text-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
                  <p className="text-muted-foreground">Loading templates...</p>
                </div>
              ) : docusealTemplates.length === 0 ? (
                <div className="text-center py-8">
                  <FileSignature className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground mb-4">
                    No templates found. Click "Sync Templates" to fetch from DocuSeal.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {docusealTemplates.map((template) => (
                    <div key={template.id} className="border rounded-lg p-4" data-testid={`template-${template.id}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h4 className="font-medium">{template.name}</h4>
                          {template.description && (
                            <p className="text-sm text-muted-foreground mt-1">{template.description}</p>
                          )}
                          {template.category && (
                            <Badge variant="outline" className="mt-2">{template.category}</Badge>
                          )}
                        </div>
                        <Badge variant={template.enabled ? "secondary" : "outline"}>
                          {template.enabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={template.enabled}
                              onCheckedChange={async (checked) => {
                                try {
                                  await apiRequest("PUT", `/api/admin/docuseal-templates/${template.id}`, { enabled: checked });
                                  queryClient.invalidateQueries({ queryKey: ["/api/admin/docuseal-templates"] });
                                  toast({
                                    title: "Template Updated",
                                    description: `Template ${checked ? "enabled" : "disabled"} successfully`
                                  });
                                } catch (error) {
                                  toast({
                                    title: "Update Failed",
                                    description: "Failed to update template",
                                    variant: "destructive"
                                  });
                                }
                              }}
                              data-testid={`checkbox-enable-${template.id}`}
                            />
                            <Label className="text-sm">Enabled</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={template.requiredForOnboarding}
                              onCheckedChange={async (checked) => {
                                try {
                                  await apiRequest("PUT", `/api/admin/docuseal-templates/${template.id}`, { requiredForOnboarding: checked });
                                  queryClient.invalidateQueries({ queryKey: ["/api/admin/docuseal-templates"] });
                                  toast({
                                    title: "Template Updated",
                                    description: `Template ${checked ? "marked as" : "removed from"} onboarding requirement`
                                  });
                                } catch (error) {
                                  toast({
                                    title: "Update Failed",
                                    description: "Failed to update template",
                                    variant: "destructive"
                                  });
                                }
                              }}
                              data-testid={`checkbox-onboarding-${template.id}`}
                            />
                            <Label className="text-sm">Required for Onboarding</Label>
                          </div>
                        </div>
                        {template.lastSyncedAt && (
                          <span className="text-xs text-muted-foreground">
                            Last synced: {new Date(template.lastSyncedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={() => setDocusealTemplateDialogOpen(false)}
                data-testid="button-close-templates"
              >
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </MainLayout>
  );
}
