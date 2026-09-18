import type {Metadata} from 'next';
import './globals.css'; // Global styles
import Providers from '@/components/Providers';

export const metadata: Metadata = {
  title: 'Sing Sing Restaurant OS - Phase 4 Delivery Gateway & Dispatch',
  description: 'Phase 4 Delivery Aggregation Gateway & Dispatch Dashboard with Kitchen Pacing Engine and AI Voice Concierge for Sing Sing Beer & Pizza.',
  openGraph: {
    title: 'Sing Sing Restaurant OS - Phase 4 Delivery Gateway & Dispatch',
    description: 'Phase 4 Delivery Aggregation Gateway & Dispatch Dashboard with Kitchen Pacing Engine and AI Voice Concierge for Sing Sing Beer & Pizza.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sing Sing Restaurant OS - Phase 4 Delivery Gateway & Dispatch',
    description: 'Phase 4 Delivery Aggregation Gateway & Dispatch Dashboard with Kitchen Pacing Engine and AI Voice Concierge for Sing Sing Beer & Pizza.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
