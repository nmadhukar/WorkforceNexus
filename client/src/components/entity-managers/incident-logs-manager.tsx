import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Edit, Trash2, AlertTriangle } from "lucide-react";

const incidentSchema = z.object({
  incidentDate: z.string().min(1, "Incident date is required"),
  incidentType: z.string().min(1, "Incident type is required"),
  description: z.string().min(1, "Description is required"),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  resolution: z.string().optional()
});

type IncidentFormData = z.infer<typeof incidentSchema>;

interface IncidentLogsManagerProps {
  employeeId: number;
}

export function IncidentLogsManager({ employeeId }: IncidentLogsManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<any>(null);
  const [deleteIncident, setDeleteIncident] = useState<any>(null);
  const { toast } = useToast();

  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ["/api/employees", employeeId, "incident-logs"],
    enabled: !!employeeId
  });

  const form = useForm<IncidentFormData>({
    resolver: zodResolver(incidentSchema),
    defaultValues: {
      incidentDate: "",
      incidentType: "",
      description: "",
      severity: "low",
      resolution: ""
    }
  });

  const createMutation = useMutation({
    mutationFn: (data: IncidentFormData) =>
      apiRequest(`/api/employees/${employeeId}/incident-logs`, {
        method: "POST",
        body: JSON.stringify(data)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees", employeeId, "incident-logs"] });
      toast({ title: "Incident log added successfully" });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Failed to add incident log", variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data: IncidentFormData) =>
      apiRequest(`/api/incident-logs/${selectedIncident?.id}`, {
        method: "PUT",
        body: JSON.stringify(data)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees", employeeId, "incident-logs"] });
      toast({ title: "Incident log updated successfully" });
      setIsDialogOpen(false);
      setSelectedIncident(null);
      form.reset();
    },
    onError: () => {
      toast({ title: "Failed to update incident log", variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/api/incident-logs/${id}`, {
        method: "DELETE"
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees", employeeId, "incident-logs"] });
      toast({ title: "Incident log deleted successfully" });
      setDeleteIncident(null);
    },
    onError: () => {
      toast({ title: "Failed to delete incident log", variant: "destructive" });
    }
  });

  const handleSubmit = (data: IncidentFormData) => {
    if (selectedIncident) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (incident: any) => {
    setSelectedIncident(incident);
    form.reset({
      incidentDate: incident.incidentDate || "",
      incidentType: incident.incidentType || "",
      description: incident.description || "",
      severity: incident.severity || "low",
      resolution: incident.resolution || ""
    });
    setIsDialogOpen(true);
  };

  const handleDelete = () => {
    if (deleteIncident) {
      deleteMutation.mutate(deleteIncident.id);
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'low':
        return <Badge className="bg-blue-100 text-blue-800">Low</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-100 text-yellow-800">Medium</Badge>;
      case 'high':
        return <Badge className="bg-orange-100 text-orange-800">High</Badge>;
      case 'critical':
        return <Badge className="bg-red-100 text-red-800">Critical</Badge>;
      default:
        return <Badge variant="secondary">{severity}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            <CardTitle>Incident Logs</CardTitle>
          </div>
          <Button
            onClick={() => {
              setSelectedIncident(null);
              form.reset();
              setIsDialogOpen(true);
            }}
            size="sm"
            data-testid="button-add-incident"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Incident
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">Loading incident logs...</p>
        ) : incidents.length === 0 ? (
          <p className="text-muted-foreground">No incident logs found</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {incidents.map((incident: any) => (
                <TableRow key={incident.id} data-testid={`row-incident-${incident.id}`}>
                  <TableCell>{incident.incidentDate}</TableCell>
                  <TableCell>{incident.incidentType}</TableCell>
                  <TableCell className="max-w-xs truncate">{incident.description}</TableCell>
                  <TableCell>{getSeverityBadge(incident.severity || "low")}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(incident)}
                      data-testid={`button-edit-incident-${incident.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteIncident(incident)}
                      data-testid={`button-delete-incident-${incident.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedIncident ? "Edit Incident Log" : "Add Incident Log"}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="incidentDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Incident Date *</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" data-testid="input-incident-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="incidentType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Incident Type *</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger data-testid="select-incident-type">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Safety">Safety</SelectItem>
                          <SelectItem value="Performance">Performance</SelectItem>
                          <SelectItem value="Compliance">Compliance</SelectItem>
                          <SelectItem value="Patient Care">Patient Care</SelectItem>
                          <SelectItem value="Behavioral">Behavioral</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="severity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Severity</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-severity">
                          <SelectValue placeholder="Select severity" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description *</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="Describe the incident" 
                        data-testid="input-description"
                        rows={4}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="resolution"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Resolution</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="Describe how the incident was resolved" 
                        data-testid="input-resolution"
                        rows={3}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-submit"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? "Saving..."
                    : selectedIncident
                    ? "Update"
                    : "Add"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteIncident} onOpenChange={() => setDeleteIncident(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this incident log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}