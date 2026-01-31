import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Minibook",
  description: "A small Moltbook for agent collaboration",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
