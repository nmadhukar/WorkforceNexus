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
import { Settings as SettingsIcon, Users, Bell, Shield, Edit, Trash2, Plus, Save, Key, Cloud, Database, CheckCircle, XCircle, ArrowUpCircle, Mail, Send, Clock, UserPlus, RefreshCw } from "lucide-react";
import { Link } from "wouter";

interface User {
  id: number;
  username: string;
  role: string;
  createdAt: string;
}

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
}

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === 'admin';
  const [deleteUserId, setDeleteUserId] = useState<number | null>(null);
  const [newUserDialogOpen, setNewUserDialogOpen] = useState(false);
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
  const [invitationDialogOpen, setInvitationDialogOpen] = useState(false);
  const [resendInvitationId, setResendInvitationId] = useState<number | null>(null);
  const [newInvitation, setNewInvitation] = useState({
    email: "",
    firstName: "",
    lastName: "",
    position: "",
    department: ""
  });
  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    role: "hr"
  });
  const [settings, setSettings] = useState<SystemSettings>({
    emailAlertsEnabled: true,
    dailyReportsEnabled: true,
    weeklyAuditSummaries: false,
    licenseExpiryWarningDays: 30,
    caqhReattestationWarningDays: 90
  });

  // S3 Storage Status Query
  const { data: s3Status, isLoading: s3StatusLoading } = useQuery<S3Status>({
    queryKey: ["/api/storage/status"],
    enabled: isAdmin || user?.role === 'hr'
  });

  // S3 Configuration Query (Admin only)
  const { data: s3Config, isLoading: s3ConfigLoading } = useQuery<S3Configuration>({
    queryKey: ["/api/admin/s3-config"],
    enabled: isAdmin
  });

  // Employee Invitations Query (Admin and HR only)
  const { data: invitations = [], isLoading: invitationsLoading } = useQuery<EmployeeInvitation[]>({
    queryKey: ["/api/invitations"],
    enabled: isAdmin || user?.role === 'hr'
  });

  // Mock users query - in a real app this would fetch from /api/users
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      // For demo purposes, return mock data since user management isn't fully implemented
      return [
        {
          id: 1,
          username: user?.username || "admin",
          role: user?.role || "admin",
          createdAt: new Date().toISOString()
        }
      ];
    }
  });

  // S3 Migration Mutation
  const migrateMutation = useMutation({
    mutationFn: (data: { batchSize: number; dryRun: boolean }) => 
      apiRequest("POST", "/api/storage/migrate", data),
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

  const createUserMutation = useMutation({
    mutationFn: (userData: typeof newUser) => apiRequest("POST", "/api/register", userData),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "User created successfully"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setNewUserDialogOpen(false);
      setNewUser({ username: "", password: "", role: "hr" });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId: number) => apiRequest("DELETE", `/api/users/${userId}`),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "User deleted successfully"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
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

  const testS3ConfigMutation = useMutation({
    mutationFn: (configData: typeof s3FormData) => 
      apiRequest("POST", "/api/admin/s3-config/test", configData),
    onSuccess: (data) => {
      toast({
        title: data.success ? "Success" : "Connection Failed",
        description: data.message,
        variant: data.success ? "default" : "destructive"
      });
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

  const migrateS3ConfigMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/s3-config/migrate"),
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

  // Employee Invitation Mutations
  const sendInvitationMutation = useMutation({
    mutationFn: (invitationData: typeof newInvitation) => 
      apiRequest("POST", "/api/invitations/send", invitationData),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Invitation sent successfully"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/invitations"] });
      setInvitationDialogOpen(false);
      setNewInvitation({
        email: "",
        firstName: "",
        lastName: "",
        position: "",
        department: ""
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

  const resendInvitationMutation = useMutation({
    mutationFn: (invitationId: number) => 
      apiRequest("POST", `/api/invitations/${invitationId}/resend`, {}),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Invitation resent successfully"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/invitations"] });
      setResendInvitationId(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleCreateUser = () => {
    createUserMutation.mutate(newUser);
  };

  const handleDeleteUser = (userId: number) => {
    deleteUserMutation.mutate(userId);
    setDeleteUserId(null);
  };

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

  const handleSendInvitation = () => {
    sendInvitationMutation.mutate(newInvitation);
  };

  const handleResendInvitation = (invitationId: number) => {
    resendInvitationMutation.mutate(invitationId);
  };

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

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge className="bg-destructive/10 text-destructive">Admin</Badge>;
      case 'hr':
        return <Badge className="bg-primary/10 text-primary">HR</Badge>;
      case 'viewer':
        return <Badge className="bg-muted/10 text-muted-foreground">Viewer</Badge>;
      default:
        return <Badge variant="secondary">{role}</Badge>;
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
          {/* User Management */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center">
                <Users className="w-5 h-5 mr-2" />
                User Management
              </CardTitle>
              {isAdmin && (
                <Dialog open={newUserDialogOpen} onOpenChange={setNewUserDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" data-testid="button-add-user">
                      <Plus className="w-4 h-4 mr-2" />
                      Add User
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New User</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="username">Username</Label>
                        <Input
                          id="username"
                          value={newUser.username}
                          onChange={(e) => setNewUser(prev => ({ ...prev, username: e.target.value }))}
                          placeholder="Enter username"
                          data-testid="input-new-username"
                        />
                      </div>
                      <div>
                        <Label htmlFor="password">Password</Label>
                        <Input
                          id="password"
                          type="password"
                          value={newUser.password}
                          onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                          placeholder="Enter password"
                          data-testid="input-new-password"
                        />
                      </div>
                      <div>
                        <Label htmlFor="role">Role</Label>
                        <select
                          id="role"
                          value={newUser.role}
                          onChange={(e) => setNewUser(prev => ({ ...prev, role: e.target.value }))}
                          className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                          data-testid="select-new-role"
                        >
                          <option value="hr">HR Staff</option>
                          <option value="admin">Administrator</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      </div>
                      <Button 
                        onClick={handleCreateUser}
                        disabled={createUserMutation.isPending || !newUser.username || !newUser.password}
                        className="w-full"
                        data-testid="button-create-user"
                      >
                        {createUserMutation.isPending ? "Creating..." : "Create User"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {users.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-4 border border-border rounded-lg" data-testid={`user-item-${user.id}`}>
                    <div>
                      <p className="font-medium text-foreground">{user.username}</p>
                      <p className="text-sm text-muted-foreground">
                        {getRoleBadge(user.role)} • Created {new Date(user.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    {isAdmin && user.id !== 1 && ( // Don't allow deleting the main admin
                      <div className="flex items-center space-x-2">
                        <Button variant="ghost" size="sm" data-testid={`button-edit-user-${user.id}`}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteUserId(user.id)}
                          className="text-destructive hover:text-destructive/80"
                          data-testid={`button-delete-user-${user.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}

                {users.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">No users found</p>
                )}
              </div>
            </CardContent>
          </Card>

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
                    <div className="flex items-center mb-3">
                      {s3Status?.configured ? (
                        <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                      ) : (
                        <XCircle className="w-5 h-5 text-destructive mr-2" />
                      )}
                      <span className="font-medium">
                        S3 Storage {s3Status?.configured ? 'Configured' : 'Not Configured'}
                      </span>
                    </div>
                    
                    {s3Status?.configured && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Bucket:</span>{' '}
                          <span className="font-medium">{s3Status?.bucketName || 'Not set'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Region:</span>{' '}
                          <span className="font-medium">{s3Status?.region || 'Not set'}</span>
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

                  {/* Admin S3 Configuration */}
                  {isAdmin && (
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
                              <Settings className="w-4 h-4 mr-2" />
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
                                  onChange={(e) => setS3FormData(prev => ({ ...prev, bucketName: e.target.value }))}
                                  placeholder="my-bucket-name"
                                  data-testid="input-s3-bucket"
                                />
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

        {/* Employee Invitations */}
        {(isAdmin || user?.role === 'hr') && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center">
                <UserPlus className="w-5 h-5 mr-2" />
                Employee Invitations
              </CardTitle>
              <Dialog open={invitationDialogOpen} onOpenChange={setInvitationDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="button-send-invitation">
                    <Send className="w-4 h-4 mr-2" />
                    Send Invitation
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Send Employee Invitation</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="invite-firstName">First Name</Label>
                        <Input
                          id="invite-firstName"
                          value={newInvitation.firstName}
                          onChange={(e) => setNewInvitation(prev => ({ ...prev, firstName: e.target.value }))}
                          placeholder="John"
                          data-testid="input-invite-firstName"
                        />
                      </div>
                      <div>
                        <Label htmlFor="invite-lastName">Last Name</Label>
                        <Input
                          id="invite-lastName"
                          value={newInvitation.lastName}
                          onChange={(e) => setNewInvitation(prev => ({ ...prev, lastName: e.target.value }))}
                          placeholder="Doe"
                          data-testid="input-invite-lastName"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="invite-email">Email Address</Label>
                      <Input
                        id="invite-email"
                        type="email"
                        value={newInvitation.email}
                        onChange={(e) => setNewInvitation(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="john.doe@example.com"
                        data-testid="input-invite-email"
                      />
                    </div>
                    <div>
                      <Label htmlFor="invite-position">Position</Label>
                      <Input
                        id="invite-position"
                        value={newInvitation.position}
                        onChange={(e) => setNewInvitation(prev => ({ ...prev, position: e.target.value }))}
                        placeholder="Registered Nurse"
                        data-testid="input-invite-position"
                      />
                    </div>
                    <div>
                      <Label htmlFor="invite-department">Department</Label>
                      <Input
                        id="invite-department"
                        value={newInvitation.department}
                        onChange={(e) => setNewInvitation(prev => ({ ...prev, department: e.target.value }))}
                        placeholder="Emergency Department"
                        data-testid="input-invite-department"
                      />
                    </div>
                    <Button 
                      onClick={handleSendInvitation}
                      disabled={sendInvitationMutation.isPending || !newInvitation.email || !newInvitation.firstName || !newInvitation.lastName}
                      className="w-full"
                      data-testid="button-send-invitation-confirm"
                    >
                      {sendInvitationMutation.isPending ? "Sending..." : "Send Invitation"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {invitationsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : invitations.length > 0 ? (
                <div className="space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2 text-sm font-medium text-muted-foreground">Name</th>
                          <th className="text-left p-2 text-sm font-medium text-muted-foreground">Email</th>
                          <th className="text-left p-2 text-sm font-medium text-muted-foreground">Position</th>
                          <th className="text-left p-2 text-sm font-medium text-muted-foreground">Status</th>
                          <th className="text-left p-2 text-sm font-medium text-muted-foreground">Invited</th>
                          <th className="text-left p-2 text-sm font-medium text-muted-foreground">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invitations.map((invitation) => (
                          <tr key={invitation.id} className="border-b" data-testid={`invitation-row-${invitation.id}`}>
                            <td className="p-2 text-sm">
                              {invitation.firstName} {invitation.lastName}
                            </td>
                            <td className="p-2 text-sm">{invitation.email}</td>
                            <td className="p-2 text-sm">
                              <div>
                                <p>{invitation.position}</p>
                                <p className="text-xs text-muted-foreground">{invitation.department}</p>
                              </div>
                            </td>
                            <td className="p-2 text-sm">
                              {getInvitationStatusBadge(invitation.status)}
                              {invitation.reminderCount > 0 && (
                                <div className="flex items-center mt-1">
                                  <Clock className="w-3 h-3 mr-1 text-muted-foreground" />
                                  <span className="text-xs text-muted-foreground">{invitation.reminderCount} reminders</span>
                                </div>
                              )}
                            </td>
                            <td className="p-2 text-sm">
                              <p>{new Date(invitation.invitedAt).toLocaleDateString()}</p>
                              {invitation.expiresAt && (
                                <p className="text-xs text-muted-foreground">
                                  Expires: {new Date(invitation.expiresAt).toLocaleDateString()}
                                </p>
                              )}
                            </td>
                            <td className="p-2">
                              {invitation.status === 'pending' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleResendInvitation(invitation.id)}
                                  disabled={resendInvitationMutation.isPending && resendInvitationId === invitation.id}
                                  data-testid={`button-resend-invitation-${invitation.id}`}
                                >
                                  <RefreshCw className="w-4 h-4 mr-1" />
                                  {resendInvitationMutation.isPending && resendInvitationId === invitation.id ? "Sending..." : "Resend"}
                                </Button>
                              )}
                              {invitation.status === 'registered' && (
                                <Badge className="bg-blue-500/10 text-blue-700 dark:text-blue-400">
                                  Awaiting Approval
                                </Badge>
                              )}
                              {invitation.status === 'approved' && invitation.registeredAt && (
                                <p className="text-xs text-muted-foreground">
                                  Approved {new Date(invitation.approvedAt!).toLocaleDateString()}
                                </p>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      <Mail className="w-4 h-4 inline mr-1" />
                      Invitations are sent via AWS SES with automatic reminders every 24 hours (up to 3 times).
                      New hires can complete their onboarding forms independently and will be in "Onboarding" status until approved.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <UserPlus className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No invitations sent yet</p>
                  <p className="text-sm text-muted-foreground mt-2">Send an invitation to get started with employee onboarding</p>
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
                {getRoleBadge(user?.role || "viewer")}
              </div>
              
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Password Hashing</p>
                <p className="font-medium">bcrypt</p>
                <Badge className="bg-secondary/10 text-secondary">Enabled</Badge>
              </div>
              
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Data Encryption</p>
                <p className="font-medium">AES-256</p>
                <Badge className="bg-secondary/10 text-secondary">Active</Badge>
              </div>
              
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Audit Logging</p>
                <p className="font-medium">All Actions</p>
                <Badge className="bg-secondary/10 text-secondary">Tracking</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Delete User Confirmation */}
        <AlertDialog open={deleteUserId !== null} onOpenChange={() => setDeleteUserId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete User</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this user? This action cannot be undone and will revoke all access immediately.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete-user">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteUserId && handleDeleteUser(deleteUserId)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="button-confirm-delete-user"
              >
                Delete User
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
}
