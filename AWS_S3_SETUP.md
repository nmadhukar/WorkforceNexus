# AWS S3 Integration for Document Storage

## Overview
The HR Management System now includes complete AWS S3 integration for document storage, providing scalable and secure cloud storage for all employee documents while maintaining backward compatibility with existing local files.

## Implementation Summary

### ✅ Completed Features

1. **AWS SDK Integration**
   - ✅ Installed `@aws-sdk/client-s3` for S3 operations
   - ✅ Installed `@aws-sdk/s3-request-presigner` for generating signed URLs

2. **S3 Service Module** (`server/services/s3Service.ts`)
   - ✅ S3 client initialization with credentials
   - ✅ `uploadFile()` - Upload documents to S3
   - ✅ `downloadFile()` - Download documents from S3  
   - ✅ `deleteFile()` - Delete documents from S3
   - ✅ `getSignedUrl()` - Generate temporary URLs for secure access
   - ✅ `listFiles()` - List files with prefix filtering
   - ✅ `migrateToS3()` - Migrate local files to S3
   - ✅ Automatic fallback to local storage when S3 not configured

3. **Database Schema Updates**
   - ✅ Added `storageType` field ('local' | 's3')
   - ✅ Added `storageKey` field for S3 object keys
   - ✅ Added `s3Etag` field for S3 ETag tracking

4. **Document Routes Updates**
   - ✅ Upload routes automatically use S3 when configured
   - ✅ Download routes handle both S3 and local files
   - ✅ Backward compatibility maintained for existing local files
   - ✅ Migration endpoint at `/api/storage/migrate`
   - ✅ Storage status endpoint at `/api/storage/status`
   - ✅ Signed URL generation at `/api/storage/documents/:id/url`

5. **Settings UI**
   - ✅ S3 configuration status display
   - ✅ Storage statistics (S3 vs local documents)
   - ✅ Environment variable status indicators
   - ✅ Document migration tool with dry-run option
   - ✅ Visual progress indicators for S3 usage

## Configuration

### Required Environment Variables

```bash
# AWS Credentials
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
AWS_REGION=us-east-1                    # Optional, defaults to us-east-1
AWS_S3_BUCKET_NAME=your_bucket_name
AWS_S3_ENDPOINT=                        # Optional, for S3-compatible services
```

### Setting Up AWS S3

1. **Create AWS Account**
   - Sign up at [aws.amazon.com](https://aws.amazon.com)
   - Navigate to the S3 service

2. **Create S3 Bucket**
   ```bash
   # Using AWS CLI
   aws s3 mb s3://your-hr-documents-bucket --region us-east-1
   ```

3. **Create IAM User**
   - Go to IAM service in AWS Console
   - Create a new user with programmatic access
   - Attach the following policy:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "s3:GetObject",
           "s3:PutObject",
           "s3:DeleteObject",
           "s3:ListBucket"
         ],
         "Resource": [
           "arn:aws:s3:::your-hr-documents-bucket/*",
           "arn:aws:s3:::your-hr-documents-bucket"
         ]
       }
     ]
   }
   ```

4. **Configure Environment Variables**
   - Copy the access key ID and secret access key
   - Set them in your environment or `.env` file
   - Restart the application

## Usage

### Uploading Documents
Documents are automatically uploaded to S3 when configured. The system determines storage location based on:
- If S3 is configured → Upload to S3
- If S3 is not configured → Upload to local storage

### File Organization
Documents are organized in S3 with structured keys:
```
documents/{employeeId}/{documentType}/{timestamp}-{filename}
```

Example:
```
documents/123/resume/1700000000000-john_doe_resume.pdf
documents/123/license/1700000000000-medical_license.pdf
```

### Migrating Existing Documents

1. **Via Settings UI**
   - Navigate to Settings page
   - Find the "Document Storage (Amazon S3)" section
   - Click "Migrate Documents to S3"
   - Choose batch size (1-100 documents)
   - Run dry run first to preview
   - Execute migration

2. **Via API**
   ```bash
   # Dry run (preview)
   curl -X POST http://localhost:5000/api/storage/migrate \
     -H "Content-Type: application/json" \
     -d '{"batchSize": 10, "dryRun": true}'

   # Actual migration
   curl -X POST http://localhost:5000/api/storage/migrate \
     -H "Content-Type: application/json" \
     -d '{"batchSize": 10, "dryRun": false}'
   ```

## Security Features

1. **Time-Limited Signed URLs**
   - Downloads use presigned URLs valid for 1 hour
   - No direct bucket access required

2. **Server-Side Encryption**
   - AES256 encryption enabled by default
   - All documents encrypted at rest

3. **Minimal IAM Permissions**
   - Only required S3 actions allowed
   - Bucket-specific access only

4. **Audit Logging**
   - All S3 operations logged
   - Migration activities tracked

## Fallback Behavior

When S3 is not configured:
- System automatically uses local storage
- No errors or interruptions
- Seamless operation continues
- Configuration can be added anytime

## Testing

1. **Check S3 Status**
   ```bash
   curl http://localhost:5000/api/storage/status
   ```

2. **Upload Test Document**
   - Upload any document through the UI
   - Check storage location in Settings → S3 Storage

3. **Verify Migration**
   - Run dry run first
   - Check migration results
   - Verify documents accessible after migration

## Troubleshooting

### Common Issues

1. **"S3 Service: AWS credentials not configured"**
   - Ensure all required environment variables are set
   - Restart the application after setting variables

2. **"Access Denied" errors**
   - Verify IAM user has correct permissions
   - Check bucket policy allows access

3. **"Bucket not found"**
   - Verify bucket name is correct
   - Ensure bucket exists in specified region

4. **Migration failures**
   - Check local files exist
   - Verify S3 credentials are valid
   - Review error logs for details

## Benefits

- ✅ **Scalability**: Unlimited document storage
- ✅ **Reliability**: 99.999999999% durability
- ✅ **Security**: Enterprise-grade encryption
- ✅ **Cost-Effective**: Pay only for storage used
- ✅ **Global Access**: Documents available worldwide
- ✅ **Backward Compatible**: Existing files continue working
- ✅ **Gradual Migration**: Move documents at your pace

## Future Enhancements

Potential improvements for consideration:
- CloudFront CDN integration for faster downloads
- S3 lifecycle policies for archival
- Cross-region replication for disaster recovery
- S3 Intelligent-Tiering for cost optimization
- Batch operations for bulk document management