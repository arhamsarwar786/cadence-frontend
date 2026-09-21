import Link from "next/link";
import { AuthSplitLayout } from "@/app/(public)/_components/AuthSplitLayout";

/** Self-serve account mint (A16 door 4) is not designed yet — placeholder only. */
export default function CandidateOnboardingGatePage() {
  return (
    <AuthSplitLayout title="Complete onboarding" strapline="Self-serve signup is the product — doors are still being designed.">
      <h2 className="font-heading text-2xl text-cadence-ink">Almost there</h2>
      <p className="mt-3 font-body text-sm leading-relaxed text-cadence-ink/65">
        Creating a candidate account at the end of onboarding needs new portal write doors for
        encrypted PII. Until those ship, ask your recruiter for an invite, then finish onboarding
        inside the portal after you sign in.
      </p>
      <p className="mt-8 flex flex-col gap-2 font-body text-sm">
        <Link href="/login/candidate" className="underline">
          Back to candidate login
        </Link>
        <Link href="/login" className="underline">
          All sign-in options
        </Link>
      </p>
    </AuthSplitLayout>
  );
}
