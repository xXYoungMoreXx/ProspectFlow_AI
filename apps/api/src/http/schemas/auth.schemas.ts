import { z } from "zod";

export const LoginSchema = z.object({
  email: z.string().email("Invalid email format").max(254),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const RefreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});
export type RefreshInput = z.infer<typeof RefreshSchema>;

export const RegisterSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters")
      .max(100),
    email: z.string().email("Invalid email format").max(254),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128)
      .regex(/[a-z]/, "Password must contain a lowercase letter")
      .regex(/[A-Z]/, "Password must contain an uppercase letter")
      .regex(/[0-9]/, "Password must contain a number")
      .regex(/[^a-zA-Z0-9]/, "Password must contain a special character"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const VerifyEmailSchema = z.object({
  token: z
    .string()
    .length(64, "Invalid token")
    .regex(/^[0-9a-f]{64}$/, "Invalid token format"),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email("Invalid email format").max(254),
});

export const ResetPasswordSchema = z
  .object({
    token: z
      .string()
      .length(64, "Invalid token")
      .regex(/^[0-9a-f]{64}$/, "Invalid token format"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128)
      .regex(/[a-z]/, "Password must contain a lowercase letter")
      .regex(/[A-Z]/, "Password must contain an uppercase letter")
      .regex(/[0-9]/, "Password must contain a number")
      .regex(/[^a-zA-Z0-9]/, "Password must contain a special character"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const ResendVerificationSchema = z.object({
  email: z.string().email("Invalid email format").max(254),
});
