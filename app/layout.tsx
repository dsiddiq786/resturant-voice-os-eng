import type {Metadata} from 'next';
import { Bricolage_Grotesque, Geist, Geist_Mono } from 'next/font/google';
import './globals.css'; // Global styles
import './brand.css'; // Leed Pizza design system (loaded after globals so it wins)
import Providers from '@/components/Providers';

const display = Bricolage_Grotesque({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-display', display: 'swap' });
const body = Geist({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-body', display: 'swap' });
const mono = Geist_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-code', display: 'swap' });

export const metadata: Metadata = {
  title: 'Talkie · Leed Pizza AI host',
  description: 'Talk with Talkie, the Leed Pizza AI host, to check availability, book, change or cancel a table.',
  openGraph: {
    title: 'Talkie · Leed Pizza AI host',
    description: 'Talk with Talkie, the Leed Pizza AI host, to check availability, book, change or cancel a table.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Talkie · Leed Pizza AI host',
    description: 'Talk with Talkie, the Leed Pizza AI host, to check availability, book, change or cancel a table.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
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
