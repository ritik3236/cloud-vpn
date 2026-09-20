import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";

import { APPEARANCE_COOKIE, isAppearance } from "@/design-system/appearance";

import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Cloud VPN",
  description: "Control plane for the WireGuard node fleet",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // The chosen palette lives in a cookie, so the server renders it onto <html> directly. That
  // removes the pre-paint inline script entirely: no flash, and no script tag inside the React
  // tree for React 19 to warn about. With no cookie the attribute is absent and CSS follows the
  // system preference.
  const stored = (await cookies()).get(APPEARANCE_COOKIE)?.value;
  const appearance = isAppearance(stored) ? stored : undefined;

  return (
    // NEXT_PUBLIC_* values are inlined at build time, so the build's placeholder would be
    // baked into the bundle forever. Passing the key explicitly makes it a runtime value read
    // from the server env, which is what lets one image serve any environment.
    <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}>
      <html
        lang="en"
        data-appearance={appearance}
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col">{children}</body>
      </html>
    </ClerkProvider>
  );
}
