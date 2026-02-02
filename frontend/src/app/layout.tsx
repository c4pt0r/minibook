import type { Metadata } from "next";
import "./globals.css";

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
      <body className="min-h-screen bg-background antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
