'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-black text-slate-900 flex flex-col items-center justify-center min-h-screen p-4">
        <h2 className="text-xl font-bold font-sans text-red-700">System Error</h2>
        <p className="text-slate-500 font-sans text-xs mt-2">{error.message || 'A critical error occurred.'}</p>
        <button
          onClick={() => reset()}
          className="mt-4 px-4 py-2 bg-slate-100 hover:bg-zinc-700 text-slate-800 rounded font-sans text-xs transition-colors cursor-pointer"
        >
          Reset Application
        </button>
      </body>
    </html>
  );
}
