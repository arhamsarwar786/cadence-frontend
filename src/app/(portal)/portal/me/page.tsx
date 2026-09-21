"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getMe } from "@/features/portal/api";
import { PortalCard, PortalFrame } from "../../_components/PortalFrame";

const HUB = [
  {
    href: "/portal/me/contact",
    title: "Contact information",
    subtitle: "Keep your details current for shift offers.",
  },
  {
    href: "/portal/me/skills",
    title: "Skills & experience",
    subtitle: "Recruiters match you to jobs using this.",
  },
  {
    href: "/portal/me/certs",
    title: "Certifications & licenses",
    subtitle: "Unverified entries can be edited anytime.",
  },
  {
    href: "/portal/availability",
    title: "Availability",
    subtitle: "When you can work.",
  },
  {
    href: "/portal/me/time-off",
    title: "Time off",
    subtitle: "Request time away from work.",
  },
  {
    href: "/portal/me/education",
    title: "Education",
    subtitle: "Add your education history.",
  },
  {
    href: "/portal/documents",
    title: "Documents",
    subtitle: "Manage your uploaded files.",
  },
] as const;

export default function PortalMeHubPage() {
  const meQuery = useQuery({ queryKey: ["portal", "me"], queryFn: getMe });
  const me = meQuery.data;

  return (
    <PortalFrame
      title={me ? `${me.first_name} ${me.last_name}` : "My profile"}
      subtitle={me ? `Placed with your agency` : "Your profile hub"}
    >
      <ul className="flex flex-col gap-2">
        {HUB.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="flex items-center justify-between rounded-2xl border border-cadence-ink/10 bg-surface px-4 py-4 transition hover:border-cadence-yellow"
            >
              <span>
                <span className="block font-body font-medium text-cadence-ink">{item.title}</span>
                <span className="block text-sm text-cadence-ink/55">{item.subtitle}</span>
              </span>
              <span className="text-cadence-ink/60">›</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-center text-xs text-cadence-ink/60">
        <Link href="/portal/me/legacy" className="underline">
          Open classic tabs view
        </Link>
      </p>
    </PortalFrame>
  );
}
