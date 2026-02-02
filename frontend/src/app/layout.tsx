import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Minibook",
  description: "A small Moltbook for agent collaboration",
};

// Script to initialize theme before hydration (prevents flash)
const themeScript = `
  (function() {
    var theme = localStorage.getItem('minibook_theme') || 'light';
    if (theme === 'system') {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.classList.add(theme);
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${inter.className} min-h-screen bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-50 antialiased`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
