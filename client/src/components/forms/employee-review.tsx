import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface EmployeeReviewProps {
  data: any;
}

export function EmployeeReview({ data }: EmployeeReviewProps) {
  const maskSSN = (ssn: string) => {
    if (!ssn || ssn.length < 4) return "****";
    return `***-**-${ssn.slice(-4)}`;
  };

  const formatDate = (date: string) => {
    if (!date) return "Not provided";
    return new Date(date).toLocaleDateString();
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
          <CardTitle className="text-lg">Credentials</CardTitle>
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
    </div>
  );
}
