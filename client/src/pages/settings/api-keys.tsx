import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Key,
  Plus,
  Copy,
  RotateCw,
  Trash2,
  Eye,
  AlertCircle,
  CheckCircle,
  Clock,
  Shield,
  Activity,
} from "lucide-react";
import { format } from "date-fns";

interface ApiKey {
  id: number;
  name: string;
  keyPrefix: string;
  permissions: string[];
  lastUsedAt: string | null;
  expiresAt: string;
  createdAt: string;
  revokedAt: string | null;
  environment: string;
  rateLimitPerHour: number;
}

interface NewKeyResponse {
  id: number;
  name: string;
  key: string;
  keyPrefix: string;
  permissions: string[];
  expiresAt: string;
  environment: string;
  message: string;
}

interface KeyUsageStats {
  keyId: number;
  name: string;
  created: string;
  lastUsed: string | null;
  expiresAt: string;
  isExpired: boolean;
  isRevoked: boolean;
  rotationCount: number;
  rotations: Array<{
    rotatedAt: string;
    type: string;
    reason: string;
  }>;
  authAttempts: number;
  successfulAuths: number;
  failedAuths: number;
}

const AVAILABLE_PERMISSIONS = [
  { value: "read:employees", label: "Read Employees" },
  { value: "write:employees", label: "Write Employees" },
  { value: "delete:employees", label: "Delete Employees" },
  { value: "read:licenses", label: "Read Licenses" },
  { value: "write:licenses", label: "Write Licenses" },
  { value: "read:documents", label: "Read Documents" },
  { value: "write:documents", label: "Write Documents" },
  { value: "read:reports", label: "Read Reports" },
  { value: "read:audits", label: "Read Audits" },
  { value: "manage:api_keys", label: "Manage API Keys" },
];

export default function ApiKeysPage() {
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newKeyData, setNewKeyData] = useState<NewKeyResponse | null>(null);
  const [selectedKeyId, setSelectedKeyId] = useState<number | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRotateDialog, setShowRotateDialog] = useState(false);
  const [showUsageDialog, setShowUsageDialog] = useState(false);
  const [usageStats, setUsageStats] = useState<KeyUsageStats | null>(null);
  
  // Form state for new key
  const [keyName, setKeyName] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [environment, setEnvironment] = useState<"live" | "test">("live");
  const [expiresInDays, setExpiresInDays] = useState(90);
  const [rateLimit, setRateLimit] = useState(1000);

  // Fetch API keys
  const { data: apiKeys, isLoading } = useQuery<ApiKey[]>({
    queryKey: ["/api/settings/api-keys"],
  });

  // Create API key mutation
  const createKeyMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/settings/api-keys", {
        name: keyName,
        permissions: selectedPermissions,
        environment,
        expiresInDays,
        rateLimitPerHour: rateLimit,
      });
      if (!response.ok) {
        throw new Error("Failed to create API key");
      }
      return response.json() as Promise<NewKeyResponse>;
    },
    onSuccess: (data) => {
      setNewKeyData(data);
      setCreateDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/settings/api-keys"] });
      toast({
        title: "API Key Created",
        description: "Your new API key has been created successfully. Please save it securely.",
      });
      // Reset form
      setKeyName("");
      setSelectedPermissions([]);
      setEnvironment("live");
      setExpiresInDays(90);
      setRateLimit(1000);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create API key",
        variant: "destructive",
      });
    },
  });

  // Revoke API key mutation
  const revokeKeyMutation = useMutation({
    mutationFn: async (keyId: number) => {
      const response = await apiRequest("DELETE", `/api/settings/api-keys/${keyId}`);
      if (!response.ok) {
        throw new Error("Failed to revoke API key");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/api-keys"] });
      toast({
        title: "API Key Revoked",
        description: "The API key has been revoked successfully.",
      });
      setShowDeleteDialog(false);
      setSelectedKeyId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to revoke API key",
        variant: "destructive",
      });
    },
  });

  // Rotate API key mutation
  const rotateKeyMutation = useMutation({
    mutationFn: async (keyId: number) => {
      const response = await apiRequest("POST", `/api/settings/api-keys/${keyId}/rotate`, {
        gracePeriodHours: 24,
        reason: "Manual rotation requested by user",
      });
      if (!response.ok) {
        throw new Error("Failed to rotate API key");
      }
      return response.json() as Promise<NewKeyResponse>;
    },
    onSuccess: (data) => {
      setNewKeyData(data);
      queryClient.invalidateQueries({ queryKey: ["/api/settings/api-keys"] });
      toast({
        title: "API Key Rotated",
        description: "Your API key has been rotated. Please save the new key securely.",
      });
      setShowRotateDialog(false);
      setSelectedKeyId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to rotate API key",
        variant: "destructive",
      });
    },
  });

  // Fetch usage statistics
  const fetchUsageStats = async (keyId: number) => {
    try {
      const response = await fetch(`/api/settings/api-keys/${keyId}/usage`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch usage statistics");
      const data = await response.json();
      setUsageStats(data);
      setShowUsageDialog(true);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch usage statistics",
        variant: "destructive",
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "API key copied to clipboard",
    });
  };

  const togglePermission = (permission: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permission)
        ? prev.filter((p) => p !== permission)
        : [...prev, permission]
    );
  };

  const getStatusBadge = (key: ApiKey) => {
    if (key.revokedAt) {
      return <Badge variant="destructive">Revoked</Badge>;
    }
    const expiryDate = new Date(key.expiresAt);
    const now = new Date();
    const daysUntilExpiry = Math.ceil(
      (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysUntilExpiry < 0) {
      return <Badge variant="destructive">Expired</Badge>;
    } else if (daysUntilExpiry < 7) {
      return <Badge variant="outline" className="border-orange-500 text-orange-500">
        Expires Soon
      </Badge>;
    } else {
      return <Badge variant="outline" className="border-green-500 text-green-500">
        Active
      </Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6" data-testid="api-keys-page">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">API Keys</h1>
          <p className="text-muted-foreground mt-1">
            Manage API keys for external application integration
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-api-key">
              <Plus className="mr-2 h-4 w-4" />
              Create API Key
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New API Key</DialogTitle>
              <DialogDescription>
                Generate a new API key for external applications to access the HR system.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Key Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Production Integration"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  data-testid="input-key-name"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Environment</Label>
                <Select value={environment} onValueChange={(v) => setEnvironment(v as "live" | "test")}>
                  <SelectTrigger data-testid="select-environment">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="live">Live</SelectItem>
                    <SelectItem value="test">Test</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Permissions</Label>
                <div className="grid grid-cols-2 gap-3">
                  {AVAILABLE_PERMISSIONS.map((perm) => (
                    <div key={perm.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={perm.value}
                        checked={selectedPermissions.includes(perm.value)}
                        onCheckedChange={() => togglePermission(perm.value)}
                        data-testid={`checkbox-${perm.value}`}
                      />
                      <label
                        htmlFor={perm.value}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {perm.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expires">Expires In (days)</Label>
                  <Input
                    id="expires"
                    type="number"
                    min="1"
                    max="365"
                    value={expiresInDays}
                    onChange={(e) => setExpiresInDays(parseInt(e.target.value))}
                    data-testid="input-expires-days"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="rateLimit">Rate Limit (per hour)</Label>
                  <Input
                    id="rateLimit"
                    type="number"
                    min="10"
                    max="10000"
                    value={rateLimit}
                    onChange={(e) => setRateLimit(parseInt(e.target.value))}
                    data-testid="input-rate-limit"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                onClick={() => createKeyMutation.mutate()}
                disabled={!keyName || selectedPermissions.length === 0 || createKeyMutation.isPending}
                data-testid="button-create"
              >
                {createKeyMutation.isPending ? "Creating..." : "Create Key"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Show new key dialog */}
      {newKeyData && (
        <Dialog open={!!newKeyData} onOpenChange={() => setNewKeyData(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                API Key Created Successfully
              </DialogTitle>
              <DialogDescription className="text-red-500 font-semibold">
                {newKeyData.message}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center justify-between">
                  <code className="text-sm break-all" data-testid="text-api-key">
                    {newKeyData.key}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(newKeyData.key)}
                    data-testid="button-copy-key"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <p><strong>Name:</strong> {newKeyData.name}</p>
                <p><strong>Prefix:</strong> {newKeyData.keyPrefix}</p>
                <p><strong>Environment:</strong> {newKeyData.environment}</p>
                <p><strong>Expires:</strong> {format(new Date(newKeyData.expiresAt), "PPP")}</p>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setNewKeyData(null)} data-testid="button-close-key-dialog">
                I've Saved the Key
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* API Keys Table */}
      <Card>
        <CardHeader>
          <CardTitle>Your API Keys</CardTitle>
          <CardDescription>
            Active and revoked API keys for your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : apiKeys && apiKeys.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key Prefix</TableHead>
                  <TableHead>Environment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map((key) => (
                  <TableRow key={key.id} data-testid={`row-api-key-${key.id}`}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Key className="h-4 w-4 text-muted-foreground" />
                        {key.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs">{key.keyPrefix}...</code>
                    </TableCell>
                    <TableCell>
                      <Badge variant={key.environment === "live" ? "default" : "secondary"}>
                        {key.environment}
                      </Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(key)}</TableCell>
                    <TableCell>
                      {key.lastUsedAt ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Clock className="h-3 w-3" />
                          {format(new Date(key.lastUsedAt), "PPp")}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Never</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {format(new Date(key.expiresAt), "PP")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => fetchUsageStats(key.id)}
                          disabled={!!key.revokedAt}
                          data-testid={`button-usage-${key.id}`}
                        >
                          <Activity className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedKeyId(key.id);
                            setShowRotateDialog(true);
                          }}
                          disabled={!!key.revokedAt}
                          data-testid={`button-rotate-${key.id}`}
                        >
                          <RotateCw className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedKeyId(key.id);
                            setShowDeleteDialog(true);
                          }}
                          disabled={!!key.revokedAt}
                          data-testid={`button-revoke-${key.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No API keys found</p>
              <p className="text-sm mt-1">Create your first API key to get started</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API Key</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke this API key? This action cannot be undone 
              and any applications using this key will lose access immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedKeyId(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedKeyId && revokeKeyMutation.mutate(selectedKeyId)}
              className="bg-destructive text-destructive-foreground"
            >
              Revoke Key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rotate Confirmation Dialog */}
      <AlertDialog open={showRotateDialog} onOpenChange={setShowRotateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rotate API Key</AlertDialogTitle>
            <AlertDialogDescription>
              This will generate a new API key with the same permissions. The old key will 
              remain valid for 24 hours to allow time for updating your applications.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedKeyId(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedKeyId && rotateKeyMutation.mutate(selectedKeyId)}
            >
              Rotate Key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Usage Statistics Dialog */}
      {usageStats && (
        <Dialog open={showUsageDialog} onOpenChange={setShowUsageDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>API Key Usage Statistics</DialogTitle>
              <DialogDescription>
                Usage and activity details for {usageStats.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Authentication Stats</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1 text-sm">
                      <p>Total Attempts: {usageStats.authAttempts}</p>
                      <p className="text-green-600">Successful: {usageStats.successfulAuths}</p>
                      <p className="text-red-600">Failed: {usageStats.failedAuths}</p>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Key Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1 text-sm">
                      <p>Created: {format(new Date(usageStats.created), "PP")}</p>
                      <p>Last Used: {usageStats.lastUsed ? format(new Date(usageStats.lastUsed), "PP") : "Never"}</p>
                      <p>Rotations: {usageStats.rotationCount}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              {usageStats.rotations.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Rotation History</h4>
                  <div className="space-y-2">
                    {usageStats.rotations.map((rotation, i) => (
                      <div key={i} className="flex items-center justify-between text-sm p-2 bg-muted rounded">
                        <span>{rotation.reason}</span>
                        <span className="text-muted-foreground">
                          {format(new Date(rotation.rotatedAt), "PPp")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <div className="text-sm">
                  <p className="font-medium">
                    {usageStats.isExpired ? "This key has expired" : 
                     usageStats.isRevoked ? "This key has been revoked" :
                     `Expires on ${format(new Date(usageStats.expiresAt), "PPP")}`}
                  </p>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setShowUsageDialog(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}