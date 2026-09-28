'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-black text-slate-900 flex flex-col items-center justify-center p-4">
      <h2 className="text-xl font-bold font-sans text-red-700">Application Error</h2>
      <p className="text-slate-500 font-sans text-xs mt-2">{error.message || 'An unexpected error occurred.'}</p>
      <button
        onClick={() => reset()}
        className="mt-4 px-4 py-2 bg-slate-100 hover:bg-zinc-700 text-slate-800 rounded font-sans text-xs transition-colors cursor-pointer"
      >
        Try Again
      </button>
    </div>
  );
}
