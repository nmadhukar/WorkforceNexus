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
import { Settings as SettingsIcon, Users, Bell, Shield, Edit, Trash2, Plus, Save, Key, Cloud, Database, CheckCircle, XCircle, ArrowUpCircle } from "lucide-react";
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
  s3: {
    configured: boolean;
    bucketName: string;
    region: string;
    endpoint: string;
  };
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

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [deleteUserId, setDeleteUserId] = useState<number | null>(null);
  const [newUserDialogOpen, setNewUserDialogOpen] = useState(false);
  const [migrateDialogOpen, setMigrateDialogOpen] = useState(false);
  const [migrationBatchSize, setMigrationBatchSize] = useState(10);
  const [migrationDryRun, setMigrationDryRun] = useState(true);
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

  const isAdmin = user?.role === 'admin';

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
                      {s3Status.s3.configured ? (
                        <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                      ) : (
                        <XCircle className="w-5 h-5 text-destructive mr-2" />
                      )}
                      <span className="font-medium">
                        S3 Storage {s3Status.s3.configured ? 'Configured' : 'Not Configured'}
                      </span>
                    </div>
                    
                    {s3Status.s3.configured && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Bucket:</span>{' '}
                          <span className="font-medium">{s3Status.s3.bucketName || 'Not set'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Region:</span>{' '}
                          <span className="font-medium">{s3Status.s3.region || 'Not set'}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Storage Statistics */}
                  <div>
                    <Label className="text-base font-medium mb-2">Storage Statistics</Label>
                    <div className="grid grid-cols-3 gap-4 mt-2">
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <p className="text-2xl font-bold">{s3Status.statistics.totalDocuments}</p>
                        <p className="text-sm text-muted-foreground">Total Documents</p>
                      </div>
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <Database className="w-5 h-5 mx-auto mb-1 text-primary" />
                        <p className="text-xl font-bold">{s3Status.statistics.localDocuments}</p>
                        <p className="text-sm text-muted-foreground">Local Storage</p>
                      </div>
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <Cloud className="w-5 h-5 mx-auto mb-1 text-primary" />
                        <p className="text-xl font-bold">{s3Status.statistics.s3Documents}</p>
                        <p className="text-sm text-muted-foreground">S3 Storage</p>
                      </div>
                    </div>
                    
                    {s3Status.statistics.totalDocuments > 0 && (
                      <div className="mt-3">
                        <div className="flex justify-between text-sm mb-1">
                          <span>S3 Usage</span>
                          <span className="font-medium">{s3Status.statistics.s3Percentage}%</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div 
                            className="bg-primary rounded-full h-2" 
                            style={{ width: `${s3Status.statistics.s3Percentage}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Environment Variables Status */}
                  <div>
                    <Label className="text-base font-medium mb-2">Environment Configuration</Label>
                    <div className="space-y-2 text-sm">
                      {Object.entries(s3Status.environment).map(([key, value]) => (
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
                  {isAdmin && s3Status.s3.configured && s3Status.statistics.localDocuments > 0 && (
                    <div className="pt-4 border-t">
                      <Label className="text-base font-medium mb-2">Document Migration</Label>
                      <p className="text-sm text-muted-foreground mb-3">
                        Migrate {s3Status.statistics.localDocuments} local documents to S3 storage.
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

                  {/* Configuration Help */}
                  {!s3Status.s3.configured && (
                    <div className="mt-4 p-4 bg-muted/30 rounded-lg">
                      <p className="text-sm font-medium mb-2">To enable S3 storage:</p>
                      <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                        <li>Set AWS_ACCESS_KEY_ID environment variable</li>
                        <li>Set AWS_SECRET_ACCESS_KEY environment variable</li>
                        <li>Set AWS_S3_BUCKET_NAME environment variable</li>
                        <li>Optionally set AWS_REGION (defaults to us-east-1)</li>
                        <li>Restart the application after configuration</li>
                      </ol>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">Unable to fetch storage status</p>
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
