import Link from "next/link";
import { AuthSplitLayout } from "@/app/(public)/_components/AuthSplitLayout";

export default function ForgotPasswordPage() {
  return (
    <AuthSplitLayout title="Password reset" strapline="Self-serve reset is being built.">
      <h2 className="font-heading text-2xl text-cadence-ink">Forgot your password?</h2>
      <p className="mt-3 font-body text-sm leading-relaxed text-cadence-ink/65">
        A self-service reset door is not live yet. Staff: ask a root user to reset your credentials.
        Workers: ask the office that placed you.
      </p>
      <p className="mt-8 font-body text-sm">
        <Link href="/login" className="underline">
          Back to sign in
        </Link>
      </p>
    </AuthSplitLayout>
  );
}
