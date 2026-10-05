import type { Metadata } from "next";
import { Cormorant_Garamond, Source_Sans_3 } from "next/font/google";
import { QueryProvider } from "@/api/query-provider";
import { SessionProvider } from "@/auth/session-context";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ToastProvider } from "@/shared/ui/Toast";
import "./globals.css";

const cormorantGaramond = Cormorant_Garamond({
  variable: "--font-cormorant-garamond",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

const sourceSans3 = Source_Sans_3({
  variable: "--font-source-sans-3",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Cadence",
  description: "All-in-one staffing agency operations platform.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${cormorantGaramond.variable} ${sourceSans3.variable} h-full antialiased`}
    >
      <body className="flex min-h-dvh flex-col font-body">
        <QueryProvider>
          <SessionProvider>
            <ToastProvider>
              <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
            </ToastProvider>
          </SessionProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
