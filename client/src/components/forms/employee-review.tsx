import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface EmployeeReviewProps {
  data: any;
  onValidationChange?: (isValid: boolean) => void;
  registerValidation?: (validationFn: () => Promise<boolean>) => void;
}

export function EmployeeReview({ data, onValidationChange, registerValidation }: EmployeeReviewProps) {
  // Report validation state - review step is always valid
  useEffect(() => {
    if (registerValidation) {
      registerValidation(async () => true);
    }
    if (onValidationChange) {
      onValidationChange(true);
    }
  }, [registerValidation, onValidationChange]);

  const maskSSN = (ssn: string) => {
    if (!ssn || ssn.length < 4) return "****";
    return `***-**-${ssn.slice(-4)}`;
  };

  const formatDate = (date: string) => {
    if (!date) return "Not provided";
    return new Date(date).toLocaleDateString();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case 'expired':
        return <Badge className="bg-red-100 text-red-800">Expired</Badge>;
      case 'expiring_soon':
        return <Badge className="bg-amber-100 text-amber-800">Expiring Soon</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case 'sent':
        return <Badge className="bg-blue-100 text-blue-800">Sent</Badge>;
      case 'uploaded':
        return <Badge className="bg-green-100 text-green-800">Uploaded</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
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
        return <Badge variant="secondary">{severity || "Low"}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Personal Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Personal Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-muted-foreground">Full Name:</span>
              <p data-testid="review-full-name">
                {[data.firstName, data.middleName, data.lastName].filter(Boolean).join(" ") || "Not provided"}
              </p>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">Date of Birth:</span>
              <p data-testid="review-date-of-birth">{formatDate(data.dateOfBirth)}</p>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">Gender:</span>
              <p data-testid="review-gender">{data.gender || "Not provided"}</p>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">SSN:</span>
              <p data-testid="review-ssn">{maskSSN(data.ssn)}</p>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">Personal Email:</span>
              <p data-testid="review-personal-email">{data.personalEmail || "Not provided"}</p>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">Work Email:</span>
              <p data-testid="review-work-email">{data.workEmail || "Not provided"}</p>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">Cell Phone:</span>
              <p data-testid="review-cell-phone">{data.cellPhone || "Not provided"}</p>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">Work Phone:</span>
              <p data-testid="review-work-phone">{data.workPhone || "Not provided"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Address */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Address</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm">
            <span className="font-medium text-muted-foreground">Home Address:</span>
            <p data-testid="review-address">
              {[
                data.homeAddress1,
                data.homeAddress2,
                data.homeCity && data.homeState && `${data.homeCity}, ${data.homeState}`,
                data.homeZip
              ].filter(Boolean).join(", ") || "Not provided"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Professional Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Professional Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-muted-foreground">Job Title:</span>
              <p data-testid="review-job-title">{data.jobTitle || "Not provided"}</p>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">Work Location:</span>
              <p data-testid="review-work-location">{data.workLocation || "Not provided"}</p>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">Status:</span>
              <Badge 
                variant={data.status === 'active' ? 'default' : 'secondary'}
                data-testid="review-status"
              >
                {data.status || "Not provided"}
              </Badge>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">NPI Number:</span>
              <p data-testid="review-npi-number">{data.npiNumber || "Not provided"}</p>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">Enumeration Date:</span>
              <p data-testid="review-enumeration-date">{formatDate(data.enumerationDate)}</p>
            </div>
          </div>
          {data.qualification && (
            <div className="mt-4">
              <span className="font-medium text-muted-foreground">Qualifications:</span>
              <p className="mt-1" data-testid="review-qualification">{data.qualification}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Credentials */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Credentials & CAQH</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-muted-foreground">Medical License:</span>
              <p data-testid="review-medical-license">{data.medicalLicenseNumber || "Not provided"}</p>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">Substance Use License:</span>
              <p data-testid="review-substance-use-license">{data.substanceUseLicenseNumber || "Not provided"}</p>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">Mental Health License:</span>
              <p data-testid="review-mental-health-license">{data.mentalHealthLicenseNumber || "Not provided"}</p>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">Medicaid Number:</span>
              <p data-testid="review-medicaid-number">{data.medicaidNumber || "Not provided"}</p>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">Medicare PTAN:</span>
              <p data-testid="review-medicare-ptan">{data.medicarePtanNumber || "Not provided"}</p>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">CAQH Provider ID:</span>
              <p data-testid="review-caqh-provider-id">{data.caqhProviderId || "Not provided"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step 5: Education & Employment */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Education & Employment History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Education */}
          <div>
            <h4 className="font-medium text-sm mb-2">Education History</h4>
            {!data.educations || data.educations.length === 0 ? (
              <p className="text-muted-foreground text-sm" data-testid="review-no-educations">No education records provided</p>
            ) : (
              <div className="space-y-2">
                {data.educations.map((edu: any, index: number) => (
                  <div key={index} className="border-l-2 border-muted pl-3 py-1" data-testid={`review-education-${index}`}>
                    <div className="text-sm">
                      <p className="font-medium">{edu.degree || "Degree not specified"} - {edu.specialtyMajor || "Major not specified"}</p>
                      <p className="text-muted-foreground">
                        {edu.schoolInstitution || "Institution not specified"}
                        {edu.startDate && edu.endDate && ` • ${formatDate(edu.startDate)} - ${formatDate(edu.endDate)}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Employment */}
          <div>
            <h4 className="font-medium text-sm mb-2">Employment History</h4>
            {!data.employments || data.employments.length === 0 ? (
              <p className="text-muted-foreground text-sm" data-testid="review-no-employments">No employment records provided</p>
            ) : (
              <div className="space-y-2">
                {data.employments.map((emp: any, index: number) => (
                  <div key={index} className="border-l-2 border-muted pl-3 py-1" data-testid={`review-employment-${index}`}>
                    <div className="text-sm">
                      <p className="font-medium">{emp.position || "Position not specified"}</p>
                      <p className="text-muted-foreground">
                        {emp.employer || "Employer not specified"}
                        {emp.startDate && ` • ${formatDate(emp.startDate)}`}
                        {emp.endDate && ` - ${formatDate(emp.endDate)}`}
                      </p>
                      {emp.description && <p className="text-xs mt-1">{emp.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Step 6: Licenses */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Licenses</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* State Licenses */}
          <div>
            <h4 className="font-medium text-sm mb-2">State Licenses</h4>
            {!data.stateLicenses || data.stateLicenses.length === 0 ? (
              <p className="text-muted-foreground text-sm" data-testid="review-no-state-licenses">No state licenses provided</p>
            ) : (
              <div className="space-y-2">
                {data.stateLicenses.map((license: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-muted/30 rounded" data-testid={`review-state-license-${index}`}>
                    <div className="text-sm">
                      <p className="font-medium">License #{license.licenseNumber}</p>
                      <p className="text-muted-foreground">
                        {license.state && `State: ${license.state}`}
                        {license.expirationDate && ` • Expires: ${formatDate(license.expirationDate)}`}
                      </p>
                    </div>
                    {license.status && getStatusBadge(license.status)}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* DEA Licenses */}
          <div>
            <h4 className="font-medium text-sm mb-2">DEA Licenses</h4>
            {!data.deaLicenses || data.deaLicenses.length === 0 ? (
              <p className="text-muted-foreground text-sm" data-testid="review-no-dea-licenses">No DEA licenses provided</p>
            ) : (
              <div className="space-y-2">
                {data.deaLicenses.map((license: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-muted/30 rounded" data-testid={`review-dea-license-${index}`}>
                    <div className="text-sm">
                      <p className="font-medium">DEA #{license.licenseNumber}</p>
                      <p className="text-muted-foreground">
                        {license.state && `State: ${license.state}`}
                        {license.expirationDate && ` • Expires: ${formatDate(license.expirationDate)}`}
                      </p>
                    </div>
                    {license.status && getStatusBadge(license.status)}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Step 7: Board Certifications */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Board Certifications</CardTitle>
        </CardHeader>
        <CardContent>
          {!data.boardCertifications || data.boardCertifications.length === 0 ? (
            <p className="text-muted-foreground text-sm" data-testid="review-no-certifications">No board certifications provided</p>
          ) : (
            <div className="space-y-2">
              {data.boardCertifications.map((cert: any, index: number) => (
                <div key={index} className="p-2 bg-muted/30 rounded" data-testid={`review-certification-${index}`}>
                  <div className="text-sm">
                    <p className="font-medium">{cert.certification || "Certification not specified"}</p>
                    <p className="text-muted-foreground">
                      {cert.boardName || "Board not specified"}
                      {cert.issueDate && ` • Issued: ${formatDate(cert.issueDate)}`}
                      {cert.expirationDate && ` • Expires: ${formatDate(cert.expirationDate)}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 8: Emergency Contacts & References */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Emergency Contacts & References</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Emergency Contacts */}
          <div>
            <h4 className="font-medium text-sm mb-2">Emergency Contacts</h4>
            {!data.emergencyContacts || data.emergencyContacts.length === 0 ? (
              <p className="text-muted-foreground text-sm" data-testid="review-no-emergency-contacts">No emergency contacts provided</p>
            ) : (
              <div className="space-y-2">
                {data.emergencyContacts.map((contact: any, index: number) => (
                  <div key={index} className="text-sm p-2 bg-muted/30 rounded" data-testid={`review-emergency-contact-${index}`}>
                    <p className="font-medium">{contact.name} ({contact.relationship})</p>
                    <p className="text-muted-foreground">
                      {contact.phone}
                      {contact.email && ` • ${contact.email}`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Peer References */}
          <div>
            <h4 className="font-medium text-sm mb-2">Peer References</h4>
            {!data.peerReferences || data.peerReferences.length === 0 ? (
              <p className="text-muted-foreground text-sm" data-testid="review-no-references">No peer references provided</p>
            ) : (
              <div className="space-y-2">
                {data.peerReferences.map((ref: any, index: number) => (
                  <div key={index} className="text-sm p-2 bg-muted/30 rounded" data-testid={`review-reference-${index}`}>
                    <p className="font-medium">{ref.referenceName || "Name not provided"}</p>
                    <p className="text-muted-foreground">
                      {ref.relationship && `${ref.relationship}`}
                      {ref.contactInfo && ` • ${ref.contactInfo}`}
                    </p>
                    {ref.comments && <p className="text-xs mt-1">{ref.comments}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Step 9: Documents */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Document Submission</CardTitle>
        </CardHeader>
        <CardContent>
          {data.allRequiredDocumentsUploaded !== undefined && (
            <div className="mb-4 p-3 bg-muted/30 rounded">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Document Upload Status</span>
                <Badge 
                  variant={data.allRequiredDocumentsUploaded ? "default" : "secondary"}
                  data-testid="review-documents-status"
                >
                  {data.uploadedRequiredCount || 0} of {data.requiredDocumentsCount || 0} Required Documents
                </Badge>
              </div>
            </div>
          )}
          
          {!data.documentUploads || data.documentUploads.length === 0 ? (
            <p className="text-muted-foreground text-sm" data-testid="review-no-documents">No documents uploaded</p>
          ) : (
            <div className="space-y-2">
              {data.documentUploads.map((doc: any, index: number) => (
                <div key={index} className="flex items-center justify-between text-sm p-2 bg-muted/30 rounded" data-testid={`review-document-${index}`}>
                  <div>
                    <p className="font-medium">{doc.documentTypeName || doc.documentName || "Document"}</p>
                    <p className="text-muted-foreground text-xs">{doc.fileName}</p>
                  </div>
                  {doc.status && getStatusBadge(doc.status)}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 10: Training & Payer */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Training & Payer Enrollments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Trainings */}
          <div>
            <h4 className="font-medium text-sm mb-2">Training & Certifications</h4>
            {!data.trainings || data.trainings.length === 0 ? (
              <p className="text-muted-foreground text-sm" data-testid="review-no-trainings">No trainings provided</p>
            ) : (
              <div className="space-y-2">
                {data.trainings.map((training: any, index: number) => (
                  <div key={index} className="text-sm p-2 bg-muted/30 rounded" data-testid={`review-training-${index}`}>
                    <p className="font-medium">{training.trainingName}</p>
                    <p className="text-muted-foreground text-xs">
                      {training.provider && `Provider: ${training.provider}`}
                      {training.completionDate && ` • Completed: ${formatDate(training.completionDate)}`}
                      {training.expirationDate && ` • Expires: ${formatDate(training.expirationDate)}`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Payer Enrollments */}
          <div>
            <h4 className="font-medium text-sm mb-2">Payer Enrollments</h4>
            {!data.payerEnrollments || data.payerEnrollments.length === 0 ? (
              <p className="text-muted-foreground text-sm" data-testid="review-no-payers">No payer enrollments provided</p>
            ) : (
              <div className="space-y-2">
                {data.payerEnrollments.map((enrollment: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-muted/30 rounded" data-testid={`review-payer-${index}`}>
                    <div className="text-sm">
                      <p className="font-medium">{enrollment.payerName}</p>
                      <p className="text-muted-foreground text-xs">
                        {enrollment.providerId && `Provider ID: ${enrollment.providerId}`}
                        {enrollment.effectiveDate && ` • Effective: ${formatDate(enrollment.effectiveDate)}`}
                      </p>
                    </div>
                    {enrollment.enrollmentStatus && getStatusBadge(enrollment.enrollmentStatus)}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Step 11: Forms */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">DocuSeal Forms</CardTitle>
        </CardHeader>
        <CardContent>
          {data.totalRequiredForms !== undefined && (
            <div className="mb-4 p-3 bg-muted/30 rounded">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Forms Completion Status</span>
                <Badge 
                  variant={data.allFormsCompleted ? "default" : "secondary"}
                  data-testid="review-forms-status"
                >
                  {data.completedForms || 0} of {data.totalRequiredForms || 0} Forms Completed
                </Badge>
              </div>
            </div>
          )}
          
          {!data.submissions || data.submissions.length === 0 ? (
            <p className="text-muted-foreground text-sm" data-testid="review-no-forms">No forms submitted</p>
          ) : (
            <div className="space-y-2">
              {data.submissions.map((submission: any, index: number) => (
                <div key={index} className="flex items-center justify-between text-sm p-2 bg-muted/30 rounded" data-testid={`review-form-${index}`}>
                  <span>Form {submission.templateId}</span>
                  {submission.status && getStatusBadge(submission.status)}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 12: Incidents */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Incident Logs</CardTitle>
        </CardHeader>
        <CardContent>
          {!data.incidentLogs || data.incidentLogs.length === 0 ? (
            <p className="text-muted-foreground text-sm" data-testid="review-no-incidents">No incidents reported</p>
          ) : (
            <div className="space-y-2">
              {data.incidentLogs.map((incident: any, index: number) => (
                <div key={index} className="p-3 border rounded" data-testid={`review-incident-${index}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{incident.incidentType} - {formatDate(incident.incidentDate)}</span>
                    {incident.severity && getSeverityBadge(incident.severity)}
                  </div>
                  <p className="text-sm text-muted-foreground">{incident.description}</p>
                  {incident.resolution && (
                    <div className="mt-2 pt-2 border-t">
                      <p className="text-xs font-medium">Resolution:</p>
                      <p className="text-xs text-muted-foreground">{incident.resolution}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
