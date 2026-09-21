import { redirect } from "next/navigation";

export default async function LegacyPayslipDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/portal/pay-statements/${id}`);
}
