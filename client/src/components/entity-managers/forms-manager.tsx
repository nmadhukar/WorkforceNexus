import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  FileSignature,
  Send,
  Download,
  Eye,
  RefreshCw,
  CheckCircle,
  Clock,
  XCircle,
  Plus,
  Mail,
  FileCheck,
} from "lucide-react";
import { Label } from "@/components/ui/label";

interface FormSubmission {
  id: number;
  employeeId: number;
  templateId: string;
  templateName: string;
  status: 'pending' | 'sent' | 'viewed' | 'completed' | 'expired' | 'declined';
  submittedAt: string | null;
  completedAt: string | null;
  documentUrl: string | null;
  submissionUrl: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
}

interface DocusealTemplate {
  id: number;
  templateId: string;
  name: string;
  description?: string;
  enabled: boolean;
  requiredForOnboarding: boolean;
  category?: string;
}

interface FormsManagerProps {
  employeeId: number;
}

export function FormsManager({ employeeId }: FormsManagerProps) {
  const { toast } = useToast();
  const [sendFormDialogOpen, setSendFormDialogOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [sendingForm, setSendingForm] = useState(false);

  // Fetch form submissions for the employee
  const { data: submissions = [], isLoading: submissionsLoading } = useQuery<FormSubmission[]>({
    queryKey: ["/api/forms/submissions", employeeId],
  });

  // Fetch available templates
  const { data: templates = [], isLoading: templatesLoading } = useQuery<DocusealTemplate[]>({
    queryKey: ["/api/admin/docuseal-templates"],
    enabled: sendFormDialogOpen,
  });

  // Send form mutation
  const sendFormMutation = useMutation({
    mutationFn: async (templateId: string) => {
      return await apiRequest("/api/forms/send", {
        method: "POST",
        body: JSON.stringify({
          employeeId,
          templateId,
        }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Form Sent",
        description: "The form has been sent to the employee successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/forms/submissions", employeeId] });
      setSendFormDialogOpen(false);
      setSelectedTemplateId("");
    },
    onError: (error) => {
      toast({
        title: "Failed to Send Form",
        description: "There was an error sending the form. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Resend form mutation
  const resendFormMutation = useMutation({
    mutationFn: async (submissionId: number) => {
      return await apiRequest(`/api/forms/submissions/${submissionId}/resend`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      toast({
        title: "Form Resent",
        description: "The form has been resent to the employee successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/forms/submissions", employeeId] });
    },
    onError: (error) => {
      toast({
        title: "Failed to Resend Form",
        description: "There was an error resending the form. Please try again.",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            Completed
          </Badge>
        );
      case 'sent':
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-200">
            <Mail className="w-3 h-3 mr-1" />
            Sent
          </Badge>
        );
      case 'viewed':
        return (
          <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200">
            <Eye className="w-3 h-3 mr-1" />
            Viewed
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      case 'expired':
        return (
          <Badge className="bg-gray-100 text-gray-800 border-gray-200">
            <XCircle className="w-3 h-3 mr-1" />
            Expired
          </Badge>
        );
      case 'declined':
        return (
          <Badge className="bg-red-100 text-red-800 border-red-200">
            <XCircle className="w-3 h-3 mr-1" />
            Declined
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleSendForm = async () => {
    if (!selectedTemplateId) {
      toast({
        title: "Template Required",
        description: "Please select a template to send.",
        variant: "destructive",
      });
      return;
    }
    
    setSendingForm(true);
    await sendFormMutation.mutateAsync(selectedTemplateId);
    setSendingForm(false);
  };

  const handleViewForm = (submission: FormSubmission) => {
    if (submission.submissionUrl) {
      window.open(submission.submissionUrl, '_blank');
    }
  };

  const handleDownloadForm = (submission: FormSubmission) => {
    if (submission.documentUrl) {
      window.open(submission.documentUrl, '_blank');
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2">
          <FileSignature className="h-5 w-5" />
          Document Forms
        </CardTitle>
        <Button
          onClick={() => setSendFormDialogOpen(true)}
          size="sm"
          data-testid="button-send-form"
        >
          <Plus className="h-4 w-4 mr-2" />
          Send Form
        </Button>
      </CardHeader>
      <CardContent>
        {submissionsLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : submissions.length === 0 ? (
          <div className="text-center py-12">
            <FileCheck className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-muted-foreground mb-4">No forms have been sent to this employee yet.</p>
            <Button
              variant="outline"
              onClick={() => setSendFormDialogOpen(true)}
              data-testid="button-send-first-form"
            >
              <Send className="h-4 w-4 mr-2" />
              Send First Form
            </Button>
          </div>
        ) : (
          <div className="relative overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Form Template</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent Date</TableHead>
                  <TableHead>Completed Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((submission) => (
                  <TableRow key={submission.id} data-testid={`form-submission-${submission.id}`}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <FileSignature className="h-4 w-4 text-muted-foreground" />
                        {submission.templateName}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(submission.status)}</TableCell>
                    <TableCell>{formatDate(submission.sentAt || submission.createdAt)}</TableCell>
                    <TableCell>{formatDate(submission.completedAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {submission.status === 'completed' && submission.documentUrl && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownloadForm(submission)}
                            data-testid={`button-download-${submission.id}`}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                        {submission.submissionUrl && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewForm(submission)}
                            data-testid={`button-view-${submission.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        {(submission.status === 'sent' || submission.status === 'viewed') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => resendFormMutation.mutate(submission.id)}
                            disabled={resendFormMutation.isPending}
                            data-testid={`button-resend-${submission.id}`}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Send Form Dialog */}
      <Dialog open={sendFormDialogOpen} onOpenChange={setSendFormDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Form to Employee</DialogTitle>
            <DialogDescription>
              Select a form template to send to the employee for completion.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="template-select">Form Template</Label>
              {templatesLoading ? (
                <div className="flex items-center justify-center py-4">
                  <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground mr-2" />
                  <span className="text-muted-foreground">Loading templates...</span>
                </div>
              ) : (
                <Select
                  value={selectedTemplateId}
                  onValueChange={setSelectedTemplateId}
                  data-testid="select-form-template"
                >
                  <SelectTrigger id="template-select">
                    <SelectValue placeholder="Select a form template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates
                      .filter(template => template.enabled)
                      .map((template) => (
                        <SelectItem
                          key={template.templateId}
                          value={template.templateId}
                          data-testid={`option-template-${template.id}`}
                        >
                          <div className="flex flex-col">
                            <span>{template.name}</span>
                            {template.description && (
                              <span className="text-xs text-muted-foreground">{template.description}</span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setSendFormDialogOpen(false);
                setSelectedTemplateId("");
              }}
              data-testid="button-cancel-send-form"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendForm}
              disabled={sendingForm || !selectedTemplateId}
              data-testid="button-confirm-send-form"
            >
              {sendingForm ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Form
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}