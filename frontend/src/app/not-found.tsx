import Link from 'next/link';

export default function NotFound() {
  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center px-6 text-center"
      style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div>
        <p className="text-6xl font-black text-blue-500/80 mb-3">404</p>
        <h1 className="text-xl font-bold text-white mb-2">הדף לא נמצא</h1>
        <p className="text-sm text-white/50 mb-6 max-w-sm mx-auto">
          הקישור שביקשת לא קיים או הועבר. אפשר לחזור לדף הבית ולהמשיך משם.
        </p>
        <Link href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors">
          חזרה לדף הבית
        </Link>
      </div>
    </div>
  );
}
