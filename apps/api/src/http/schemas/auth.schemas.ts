import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email('Invalid email format').max(254),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const RefreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});
export type RefreshInput = z.infer<typeof RefreshSchema>;
