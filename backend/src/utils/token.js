import { v4 as uuidv4 } from 'uuid';

export function generateToken() {
  return uuidv4();
}

export function getExpiryDate(hours = 24) {
  const expiryHours = parseInt(process.env.TOKEN_EXPIRY_HOURS || hours, 10);
  const expiryDate = new Date();
  expiryDate.setHours(expiryDate.getHours() + expiryHours);
  return expiryDate;
}

