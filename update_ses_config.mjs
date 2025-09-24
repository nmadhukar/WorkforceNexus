// Update SES configuration with real AWS credentials
import crypto from 'crypto';

// Encryption function (matching the one in server/utils/encryption.ts)
function encrypt(text) {
  const algorithm = 'aes-256-cbc';
  const key = process.env.ENCRYPTION_KEY ? 
    Buffer.from(process.env.ENCRYPTION_KEY, 'base64') : 
    Buffer.from('development_key_only_for_testing', 'utf8');
  
  // Ensure key is 32 bytes
  if (key.length !== 32) {
    const hash = crypto.createHash('sha256');
    hash.update(key.length > 32 ? key.slice(0, 32) : key);
    const hashedKey = hash.digest();
    const finalKey = hashedKey.slice(0, 32);
    
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, finalKey, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }
  
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return iv.toString('hex') + ':' + encrypted;
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

// Encrypt the credentials
const encryptedAccessKeyId = encrypt(accessKeyId);
const encryptedSecretAccessKey = encrypt(secretAccessKey);

console.log('\nEncrypted credentials:');
console.log('Encrypted Access Key ID:', encryptedAccessKeyId);
console.log('Encrypted Secret Access Key:', encryptedSecretAccessKey);