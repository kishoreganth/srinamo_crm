import { useState, useEffect, lazy, Suspense } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useCurrentUser } from '@/hooks/useAuth';
import { navigate } from '@/lib/navigate';

const LoginPage = lazy(() => import('@/pages/login'));
const AppLayout = lazy(() => import('@/components/layout/app-layout'));

function LoadingScreen() {
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-background/50">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-line border-t-accent" />
        <p className="text-sm text-muted">Loading...</p>
      </div>
    </div>
  );
}

export default function App() {
  const { isAuthenticated } = useAuthStore();
  useCurrentUser();
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (!isAuthenticated && currentPath !== '/login') {
      navigate('/login');
    }
    if (isAuthenticated && currentPath === '/login') {
      navigate('/dashboard');
    }
  }, [isAuthenticated, currentPath]);

  return (
    <Suspense fallback={<LoadingScreen />}>
      {!isAuthenticated ? <LoginPage /> : <AppLayout />}
    </Suspense>
  );
}
