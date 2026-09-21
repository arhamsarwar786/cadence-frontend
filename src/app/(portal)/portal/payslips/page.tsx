import { redirect } from "next/navigation";

export default function LegacyPayslipsRedirect() {
  redirect("/portal/pay-statements");
}
