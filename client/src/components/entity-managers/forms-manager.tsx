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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
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
  PenTool,
  ClipboardSignature,
  FileText,
  AlertCircle,
  UserCheck,
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
  documentUrl?: string | null; // Made optional - won't be sent in list responses
  submissionUrl?: string | null; // Made optional - won't be sent in list responses
  sentAt: string | null;
  viewedAt: string | null;
  metadata?: any;
  submissionData?: {
    employeeSigned?: boolean;
    hrSigned?: boolean;
    requiresHrSignature?: boolean;
    requiresEmployeeFirst?: boolean;
  };
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

interface Employee {
  id: number;
  userId: number | null;
  firstName: string;
  lastName: string;
  [key: string]: any;
}

export function FormsManager({ employeeId }: FormsManagerProps) {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [sendFormDialogOpen, setSendFormDialogOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [sendingForm, setSendingForm] = useState(false);

  // Fetch employee data to get userId for context detection
  const { data: employee } = useQuery<Employee>({
    queryKey: [`/api/employees/${employeeId}`],
  });

  // Determine viewing context
  const isOwnProfile = employee?.userId === currentUser?.id;
  const isManagementView = currentUser?.role === 'admin' || currentUser?.role === 'hr';
  const showEmployeeView = isOwnProfile && !isManagementView;

  // Fetch form submissions for the employee
  const { data: submissions = [], isLoading: submissionsLoading } = useQuery<FormSubmission[]>({
    queryKey: [`/api/forms/submissions?employeeId=${employeeId}`],
  });

  // Fetch available templates
  const { data: templates = [], isLoading: templatesLoading } = useQuery<DocusealTemplate[]>({
    queryKey: ["/api/admin/docuseal-templates"],
    enabled: sendFormDialogOpen,
  });

  // Send form mutation
  const sendFormMutation = useMutation({
    mutationFn: async (templateId: string) => {
      return await apiRequest("POST", "/api/forms/send", {
        employeeId,
        templateId,
      });
    },
    onSuccess: () => {
      toast({
        title: "Form Sent",
        description: "The form has been sent to the employee successfully.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/forms/submissions?employeeId=${employeeId}`] });
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
      return await apiRequest("POST", `/api/forms/submissions/${submissionId}/resend`);
    },
    onSuccess: () => {
      toast({
        title: "Form Resent",
        description: "The form has been resent to the employee successfully.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/forms/submissions?employeeId=${employeeId}`] });
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

  const handleViewForm = async (submission: FormSubmission) => {
    try {
      // Fetch signing URL on-demand for security
      const response = await apiRequest("GET", `/api/forms/submissions/${submission.id}/sign`);
      const data = await response.json();
      if (data.signingUrl) {
        window.open(data.signingUrl, '_blank');
      }
    } catch (error: any) {
      toast({
        title: "Failed to Access Form",
        description: error.message || "Unable to retrieve form URL. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadForm = async (submission: FormSubmission) => {
    try {
      // Use secure download endpoint
      window.open(`/api/forms/submission/${submission.id}/download`, '_blank');
    } catch (error: any) {
      toast({
        title: "Failed to Download",
        description: "Unable to download document. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSignDocument = async (submission: FormSubmission) => {
    try {
      // For HR/Admin signing HR signature on multi-party forms
      const submissionData = submission.metadata || submission.submissionData || {};
      const isHrUser = currentUser?.role === 'admin' || currentUser?.role === 'hr';
      
      if (isHrUser && submissionData.requiresHrSignature && !submissionData.hrSigned) {
        // HR needs to counter-sign
        const response = await apiRequest("GET", `/api/forms/submissions/${submission.id}/hr-sign`);
        const data = await response.json();
        if (data.signingUrl) {
          window.open(data.signingUrl, '_blank');
        }
      } else {
        // Employee signing or general signing
        const response = await apiRequest("GET", `/api/forms/submissions/${submission.id}/sign`);
        const data = await response.json();
        if (data.signingUrl) {
          window.open(data.signingUrl, '_blank');
        }
      }
    } catch (error: any) {
      toast({
        title: "Failed to Access Signing Form",
        description: error.message || "Unable to retrieve signing URL. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleViewDocument = async (submission: FormSubmission) => {
    try {
      if (submission.status === 'completed') {
        // View completed document
        window.open(`/api/forms/submission/${submission.id}/download`, '_blank');
      } else {
        // Get signing URL for in-progress document
        const response = await apiRequest("GET", `/api/forms/submissions/${submission.id}/sign`);
        const data = await response.json();
        if (data.signingUrl) {
          window.open(data.signingUrl, '_blank');
        }
      }
    } catch (error: any) {
      toast({
        title: "Failed to View Document",
        description: "Unable to access document. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleReviewDocument = async (submission: FormSubmission) => {
    try {
      // HR/Admin review - check if they need to counter-sign
      const submissionData = submission.metadata || submission.submissionData || {};
      
      if (submissionData.requiresHrSignature && !submissionData.hrSigned && submissionData.employeeSigned) {
        // Get HR signing URL
        const response = await apiRequest("GET", `/api/forms/submissions/${submission.id}/hr-sign`);
        const data = await response.json();
        if (data.signingUrl) {
          window.open(data.signingUrl, '_blank');
        }
      } else if (submission.status === 'completed') {
        // View completed document
        window.open(`/api/forms/submission/${submission.id}/download`, '_blank');
      } else {
        // Get employee signing URL for review
        const response = await apiRequest("GET", `/api/forms/submissions/${submission.id}/sign`);
        const data = await response.json();
        if (data.signingUrl) {
          window.open(data.signingUrl, '_blank');
        }
      }
    } catch (error: any) {
      toast({
        title: "Failed to Review Document",
        description: error.message || "Unable to access document. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getEmployeeActionButton = (submission: FormSubmission) => {
    const submissionData = submission.metadata || submission.submissionData || {};
    const employeeSigned = submissionData.employeeSigned || false;
    
    // If employee has already signed, show view button
    if (employeeSigned) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleViewDocument(submission)}
                data-testid={`button-view-document-${submission.id}`}
              >
                <Eye className="h-4 w-4 mr-2" />
                {submission.status === 'completed' ? 'View Document' : 'View Status'}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{submission.status === 'completed' ? 'View the completed document' : 'View document status'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    
    // Otherwise show sign button based on status
    switch (submission.status) {
      case 'pending':
      case 'sent':
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleSignDocument(submission)}
                  data-testid={`button-sign-${submission.id}`}
                >
                  <PenTool className="h-4 w-4 mr-2" />
                  Sign Document
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Click to sign this document</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      case 'viewed':
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleSignDocument(submission)}
                  data-testid={`button-continue-signing-${submission.id}`}
                >
                  <ClipboardSignature className="h-4 w-4 mr-2" />
                  Continue Signing
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Continue signing this document</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      case 'completed':
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleViewDocument(submission)}
                  data-testid={`button-view-document-${submission.id}`}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Document
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>View the completed document</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2">
          <FileSignature className="h-5 w-5" />
          {showEmployeeView ? "My Documents" : "Document Forms"}
        </CardTitle>
        {!showEmployeeView && (
          <Button
            onClick={() => setSendFormDialogOpen(true)}
            size="sm"
            data-testid="button-send-form"
          >
            <Plus className="h-4 w-4 mr-2" />
            Send Form
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {submissionsLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : submissions.length === 0 ? (
          <div className="text-center py-12">
            <FileCheck className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-muted-foreground mb-4">
              {showEmployeeView 
                ? "No documents require your signature at this time" 
                : "No forms have been sent to this employee yet."}
            </p>
            {!showEmployeeView && (
              <Button
                variant="outline"
                onClick={() => setSendFormDialogOpen(true)}
                data-testid="button-send-first-form"
              >
                <Send className="h-4 w-4 mr-2" />
                Send First Form
              </Button>
            )}
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
                  {isManagementView && !showEmployeeView && (
                    <TableHead>Required Signers</TableHead>
                  )}
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
                    {isManagementView && !showEmployeeView && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {/* Employee Signature Status */}
                          <Badge 
                            variant={submission.metadata?.employeeSigned || submission.submissionData?.employeeSigned ? "default" : "outline"} 
                            className={`text-xs ${
                              submission.metadata?.employeeSigned || submission.submissionData?.employeeSigned 
                                ? "bg-green-100 text-green-800 border-green-200" 
                                : ""
                            }`}
                          >
                            {(submission.metadata?.employeeSigned || submission.submissionData?.employeeSigned) ? (
                              <>
                                <UserCheck className="h-3 w-3 mr-1" />
                                Employee
                              </>
                            ) : (
                              <>Employee</>  
                            )}
                          </Badge>
                          
                          {/* HR Signature Status if required */}
                          {(submission.metadata?.requiresHrSignature || submission.submissionData?.requiresHrSignature) && (
                            <>
                              <Badge 
                                variant={(submission.metadata?.hrSigned || submission.submissionData?.hrSigned) ? "default" : "outline"} 
                                className={`text-xs ${
                                  (submission.metadata?.hrSigned || submission.submissionData?.hrSigned)
                                    ? "bg-green-100 text-green-800 border-green-200" 
                                    : ""
                                }`}
                              >
                                {(submission.metadata?.hrSigned || submission.submissionData?.hrSigned) ? (
                                  <>
                                    <UserCheck className="h-3 w-3 mr-1" />
                                    HR
                                  </>
                                ) : (
                                  <>HR</>  
                                )}
                              </Badge>
                              {!(submission.metadata?.hrSigned || submission.submissionData?.hrSigned) && 
                               (submission.metadata?.employeeSigned || submission.submissionData?.employeeSigned) && (
                                <AlertCircle className="h-3 w-3 text-amber-500" />
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {showEmployeeView ? (
                          // Employee self-service actions
                          getEmployeeActionButton(submission)
                        ) : (
                          // HR/Admin management actions
                          <>
                            {submission.status === 'completed' && (
                              <>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDownloadForm(submission)}
                                        data-testid={`button-download-${submission.id}`}
                                      >
                                        <Download className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Download document</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleReviewDocument(submission)}
                                        data-testid={`button-review-${submission.id}`}
                                      >
                                        <FileText className="h-4 w-4 mr-2" />
                                        Review
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Review completed document</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                {/* HR Counter-Sign Button - Only show if employee has signed and HR hasn't */}
                                {((submission.metadata?.requiresHrSignature || submission.submissionData?.requiresHrSignature) && 
                                  !(submission.metadata?.hrSigned || submission.submissionData?.hrSigned) &&
                                  (submission.metadata?.employeeSigned || submission.submissionData?.employeeSigned || submission.status === 'completed')) && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="default"
                                          size="sm"
                                          onClick={() => handleSignDocument(submission)}
                                          data-testid={`button-hr-sign-${submission.id}`}
                                        >
                                          <UserCheck className="h-4 w-4 mr-2" />
                                          Complete HR Signature
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Add HR signature to complete this document</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </>
                            )}
                            {submission.status !== 'completed' && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleViewForm(submission)}
                                      data-testid={`button-view-${submission.id}`}
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>View form submission</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            {(submission.status === 'sent' || submission.status === 'viewed') && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => resendFormMutation.mutate(submission.id)}
                                      disabled={resendFormMutation.isPending}
                                      data-testid={`button-resend-${submission.id}`}
                                    >
                                      <RefreshCw className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Resend form to employee</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </>
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