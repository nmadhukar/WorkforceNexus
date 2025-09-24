// Encrypt AWS SES credentials using the correct encryption method
import crypto from 'crypto';

// Get or generate encryption key from environment (matching server/utils/encryption.ts)
const getEncryptionKey = () => {
  const key = process.env.ENCRYPTION_KEY || 'default-encryption-key-change-this-in-production';
  // Create a 32-byte key for AES-256
  return crypto.createHash('sha256').update(key).digest();
};

// Encrypt function matching server/utils/encryption.ts
function encrypt(text) {
  if (!text) return '';
  
  const algorithm = 'aes-256-gcm';
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Combine IV, auth tag, and encrypted data
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

// Get the AWS credentials from environment variables
const accessKeyId = process.env.AWS_SES_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SES_SECRET_ACCESS_KEY;

if (!accessKeyId || !secretAccessKey) {
  console.error('AWS credentials not found in environment variables!');
  process.exit(1);
}

console.log('AWS_SES_ACCESS_KEY_ID found:', accessKeyId.substring(0, 10) + '...');
console.log('AWS_SES_SECRET_ACCESS_KEY found:', secretAccessKey.substring(0, 10) + '...');
console.log('Using ENCRYPTION_KEY:', process.env.ENCRYPTION_KEY ? 'From environment' : 'Default (development)');

// Encrypt the credentials using the correct algorithm
const encryptedAccessKeyId = encrypt(accessKeyId);
const encryptedSecretAccessKey = encrypt(secretAccessKey);

console.log('\nEncrypted credentials (AES-256-GCM):');
console.log('Encrypted Access Key ID:', encryptedAccessKeyId);
console.log('Encrypted Secret Access Key:', encryptedSecretAccessKey);

// Verify format
const accessKeyParts = encryptedAccessKeyId.split(':');
const secretKeyParts = encryptedSecretAccessKey.split(':');

console.log('\nValidation:');
console.log('Access Key encrypted format valid:', accessKeyParts.length === 3 ? 'YES' : 'NO');
console.log('Secret Key encrypted format valid:', secretKeyParts.length === 3 ? 'YES' : 'NO');