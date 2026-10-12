import type {Metadata} from 'next';
import './globals.css'; // Global styles
import Providers from '@/components/Providers';

export const metadata: Metadata = {
  title: 'Leed Pizza · AI Concierge',
  description: 'Talk with the Leed Pizza AI concierge to check availability, book, change or cancel a table.',
  openGraph: {
    title: 'Leed Pizza · AI Concierge',
    description: 'Talk with the Leed Pizza AI concierge to check availability, book, change or cancel a table.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Leed Pizza · AI Concierge',
    description: 'Floor Command & Autonomous Voice Concierge, Kitchen Pacing, and Seating Management for leed pizza.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Auto-recover from chunk loading mismatches during app builds or redeploys
              if (typeof window !== 'undefined') {
                function checkAndRecoverChunk(msg) {
                  if (!msg) return;
                  var isChunkError = /Loading chunk .* failed/i.test(msg) || /ChunkLoadError/i.test(msg);
                  if (isChunkError) {
                    var key = 'chunk_reload_ts';
                    var last = Number(sessionStorage.getItem(key) || '0');
                    var now = Date.now();
                    if (now - last > 10000) {
                      sessionStorage.setItem(key, String(now));
                      window.location.reload();
                    }
                  }
                }
                window.addEventListener('error', function(e) {
                  checkAndRecoverChunk((e && e.message) || '');
                });
                window.addEventListener('unhandledrejection', function(e) {
                  var r = e && e.reason;
                  checkAndRecoverChunk((r && (r.message || r.toString())) || '');
                });
              }
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
