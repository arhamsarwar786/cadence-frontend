import { z } from "zod";

export const loginSchema = z.object({
  login: z.string().min(1, "Enter your email or username."),
  password: z.string().min(1, "Enter your password."),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
