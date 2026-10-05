/** Fixed 5-tab portal chrome (A18) — workers hold no catalog grants. */
export const PORTAL_DOCK = [
  { label: "Home", href: "/portal", tooltip: "Your portal home", icon: "home" as const },
  { label: "Offers", href: "/portal/offers", tooltip: "Accept or decline a placement", icon: "offers" as const },
  { label: "Pay", href: "/portal/pay-statements", tooltip: "Pay statements", icon: "pay" as const },
  { label: "Profile", href: "/portal/me", tooltip: "Your profile", icon: "profile" as const },
  { label: "Documents", href: "/portal/documents", tooltip: "Your uploads", icon: "docs" as const },
];

export const PORTAL_MORE = [
  { label: "My shifts", href: "/portal/shifts", tooltip: "Shifts on placements you confirmed" },
  { label: "Signatures", href: "/portal/signatures", tooltip: "Forms waiting for your signature" },
  { label: "Availability", href: "/portal/availability", tooltip: "When you can work" },
  { label: "Onboarding", href: "/portal/onboarding", tooltip: "Submit intake to the office" },
  { label: "Notifications", href: "/portal/notifications", tooltip: "Messages from your agency" },
];
