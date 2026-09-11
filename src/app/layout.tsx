import type { Metadata } from "next";
import { Catamaran, Chivo_Mono } from "next/font/google";
import localFont from "next/font/local";
import { QueryProvider } from "@/api/query-provider";
import { SessionProvider } from "@/auth/session-context";
import "./globals.css";

const bonaNovaSC = localFont({
  variable: "--font-bona-nova-sc",
  src: [
    { path: "../fonts/BonaNovaSC-Regular.ttf", weight: "400", style: "normal" },
    { path: "../fonts/BonaNovaSC-Italic.ttf", weight: "400", style: "italic" },
    { path: "../fonts/BonaNovaSC-Bold.ttf", weight: "700", style: "normal" },
  ],
  display: "swap",
});

const chivoMono = Chivo_Mono({
  variable: "--font-chivo-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const catamaran = Catamaran({
  variable: "--font-catamaran",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cadence",
  description: "All-in-one staffing agency operations platform.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${bonaNovaSC.variable} ${chivoMono.variable} ${catamaran.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-body">
        <QueryProvider>
          <SessionProvider>{children}</SessionProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
