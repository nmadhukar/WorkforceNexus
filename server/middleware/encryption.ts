import crypto from "crypto";

const algorithm = 'aes-256-gcm';
const secretKey = process.env.SECRET_KEY || 'default-secret-key-change-in-production';
const key = crypto.scryptSync(secretKey, 'salt', 32);

export function encrypt(text: string): string {
  if (!text) return text;
  
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipher(algorithm, key);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

export function decrypt(encryptedText: string): string {
  if (!encryptedText || !encryptedText.includes(':')) return encryptedText;
  
  try {
    const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipher(algorithm, key);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption failed:', error);
    return encryptedText; // Return original if decryption fails
  }
}

export function maskSSN(ssn: string): string {
  if (!ssn) return '';
  const decryptedSSN = decrypt(ssn);
  if (decryptedSSN.length >= 4) {
    return '***-**-' + decryptedSSN.slice(-4);
  }
  return '***-**-****';
}

export function encryptSensitiveFields(data: any): any {
  if (!data) return data;
  
  const sensitiveFields = ['ssn', 'caqhPassword', 'nppesPassword'];
  const result = { ...data };
  
  sensitiveFields.forEach(field => {
    if (result[field]) {
      result[field] = encrypt(result[field]);
    }
  });
  
  return result;
}

export function decryptSensitiveFields(data: any): any {
  if (!data) return data;
  
  const sensitiveFields = ['ssn', 'caqhPassword', 'nppesPassword'];
  const result = { ...data };
  
  sensitiveFields.forEach(field => {
    if (result[field]) {
      result[field] = decrypt(result[field]);
    }
  });
  
  return result;
}
