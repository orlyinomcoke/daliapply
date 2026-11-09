import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { TopBar } from "@/components/TopBar";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Daliapply",
  description: "Swipe for jobs. Apply once, never fill a form again.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} min-h-screen antialiased`}>
        <TopBar />
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
