import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "InterVu — AI Interview Preparation",
  description:
    "AI-powered interview preparation platform. Research companies, build knowledge bases, and ace your next interview with personalized AI coaching.",
  keywords: ["interview preparation", "AI interview", "coding interview", "mock interview"],
  openGraph: {
    title: "InterVu — AI Interview Preparation",
    description: "Ace your next interview with personalized AI coaching.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased bg-background text-foreground`}>
        {children}
      </body>
    </html>
  );
}
