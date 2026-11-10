import type { Metadata } from "next";
import { Archivo, Source_Sans_3 } from "next/font/google";
import { Footer, TopBar } from "@/components/TopBar";
import "./globals.css";

const body = Source_Sans_3({ variable: "--font-body", subsets: ["latin"] });
const display = Archivo({ variable: "--font-display", subsets: ["latin"], axes: ["wdth"] });

export const metadata: Metadata = {
  title: "Daliapply",
  description: "Swipe for jobs. Apply once, never fill a form again.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${body.variable} ${display.variable} min-h-screen antialiased`}>
        <TopBar />
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
