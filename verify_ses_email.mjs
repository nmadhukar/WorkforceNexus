// Verify email address in AWS SES
import { SESClient, VerifyEmailIdentityCommand, GetIdentityVerificationAttributesCommand } from "@aws-sdk/client-ses";

// Create SES client with credentials from environment
const client = new SESClient({
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY
  }
});

const emailToVerify = "admin@atcemr.com";

async function checkAndVerifyEmail() {
  try {
    // First check if email is already verified
    console.log(`Checking verification status for: ${emailToVerify}`);
    const checkCommand = new GetIdentityVerificationAttributesCommand({
      Identities: [emailToVerify]
    });
    
    const checkResult = await client.send(checkCommand);
    console.log("Current verification status:", checkResult.VerificationAttributes);
    
    if (checkResult.VerificationAttributes && 
        checkResult.VerificationAttributes[emailToVerify] && 
        checkResult.VerificationAttributes[emailToVerify].VerificationStatus === "Success") {
      console.log("✅ Email is already verified!");
      return;
    }
    
    // If not verified, send verification request
    console.log(`\nSending verification request for: ${emailToVerify}`);
    const verifyCommand = new VerifyEmailIdentityCommand({
      EmailAddress: emailToVerify
    });
    
    const result = await client.send(verifyCommand);
    console.log("Verification request sent successfully!");
    console.log("Response:", result);
    console.log("\n⚠️  IMPORTANT: A verification email has been sent to admin@atcemr.com");
    console.log("Please check that inbox and click the verification link to complete the setup.");
    
  } catch (error) {
    console.error("Error:", error.message);
    if (error.Code === 'AccessDenied') {
      console.error("\n❌ The IAM user doesn't have permission to verify email addresses.");
      console.error("You'll need to:");
      console.error("1. Log into AWS Console with appropriate permissions");
      console.error("2. Go to SES and verify admin@atcemr.com manually");
      console.error("OR");
      console.error("3. Use a different 'from' email that's already verified");
    }
  }
}

checkAndVerifyEmail();