import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-black text-slate-900 flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold font-sans text-slate-800">404</h1>
      <p className="text-slate-500 font-sans text-sm mt-2">Page Not Found</p>
      <Link 
        href="/" 
        className="mt-4 px-4 py-2 bg-slate-100 hover:bg-zinc-700 text-slate-700 rounded font-sans text-xs transition-colors"
      >
        Return to Floor Command
      </Link>
    </div>
  );
}
