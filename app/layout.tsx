import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Tafel Auto Detector',
  description: 'Browser-based automatic Tafel region detection for electrochemical i-V data.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
