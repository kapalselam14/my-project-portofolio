// NotFoundPage (pages).
import { useNavigate } from 'react-router-dom';

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-ink-100 dark:bg-ink-700">
        <span className="text-4xl font-black text-ink-300 dark:text-ink-500">?</span>
      </div>
      <div>
        <p className="text-5xl font-black text-ink-200 dark:text-ink-700">404</p>
        <p className="mt-2 text-base font-semibold text-ink-700 dark:text-ink-300">
          Page not found
        </p>
        <p className="mt-1 text-sm text-ink-400">
          The page you're looking for doesn't exist or has been moved.
        </p>
      </div>
      <div className="flex gap-2">
        <button onClick={() => navigate(-1)} className="btn-outline rounded-xl px-4 py-2 text-sm">
          Go back
        </button>
        <button onClick={() => navigate('/')} className="btn-primary rounded-xl px-4 py-2 text-sm">
          Dashboard
        </button>
      </div>
    </div>
  );
}
