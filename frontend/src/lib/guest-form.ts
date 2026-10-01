import { z } from 'zod';

export const guestPhoneSchema = z
  .string()
  .regex(/^\+\d{8,15}$/, 'Enter the phone number');

export const guestEmailSchema = z
  .string()
  .optional()
  .transform((value) => (value ?? '').trim())
  .refine((value) => value === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), 'Enter a valid email');
