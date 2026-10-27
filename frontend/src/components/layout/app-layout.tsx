import { useState, useEffect, lazy, Suspense, Component, type ReactNode, type ErrorInfo } from 'react';
import Sidebar from './sidebar';
import Header from './header';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from './empty-state';
import { useAuthStore } from '@/stores/auth.store';

const DashboardPage = lazy(() => import('@/pages/dashboard'));
const BookingsPage = lazy(() => import('@/pages/bookings/index'));
const NewBookingPage = lazy(() => import('@/pages/bookings/new'));
const BookingDetailPage = lazy(() => import('@/pages/bookings/[id]'));
const CalendarPage = lazy(() => import('@/pages/calendar'));
const RoomsPage = lazy(() => import('@/pages/rooms'));
const GuestsPage = lazy(() => import('@/pages/guests/index'));
const GuestDetailPage = lazy(() => import('@/pages/guests/[id]'));
const RestaurantPage = lazy(() => import('@/pages/restaurant/index'));
const KitchenPage = lazy(() => import('@/pages/restaurant/kitchen'));
const HousekeepingPage = lazy(() => import('@/pages/housekeeping'));
const ActivitiesPage = lazy(() => import('@/pages/activities'));
const ReportsPage = lazy(() => import('@/pages/reports'));
const BillingPage = lazy(() => import('@/pages/billing'));
const SettingsPage = lazy(() => import('@/pages/settings'));
const LeadsPage = lazy(() => import('@/pages/leads'));
const PartnersPage = lazy(() => import('@/pages/partners'));
const EventsPage = lazy(() => import('@/pages/events'));

function PageSkeleton() {
  return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-4 gap-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

const routes: Record<string, { component: React.LazyExoticComponent<React.ComponentType<any>>; title: string }> = {
  '/dashboard': { component: DashboardPage, title: 'Dashboard' },
  '/bookings/new': { component: NewBookingPage, title: 'New Booking' },
  '/bookings': { component: BookingsPage, title: 'Bookings' },
  '/leads': { component: LeadsPage, title: 'Leads' },
  '/events': { component: EventsPage, title: 'Events' },
  '/partners': { component: PartnersPage, title: 'Partners' },
  '/calendar': { component: CalendarPage, title: 'Calendar' },
  '/rooms': { component: RoomsPage, title: 'Rooms' },
  '/guests': { component: GuestsPage, title: 'Guests' },
  '/restaurant/kitchen': { component: KitchenPage, title: 'Kitchen Display' },
  '/restaurant': { component: RestaurantPage, title: 'Restaurant' },
  '/housekeeping': { component: HousekeepingPage, title: 'Housekeeping' },
  '/activities': { component: ActivitiesPage, title: 'Activities' },
  '/billing': { component: BillingPage, title: 'Billing' },
  '/reports': { component: ReportsPage, title: 'Reports' },
  '/settings': { component: SettingsPage, title: 'Settings' },
};

function resolveRoute(path: string): { component: React.LazyExoticComponent<React.ComponentType<any>>; title: string } {
  if (routes[path]) return routes[path];
  if (path.startsWith('/bookings/new')) return routes['/bookings/new'];
  if (path.startsWith('/bookings/')) return { component: BookingDetailPage, title: 'Booking Details' };
  if (path.startsWith('/guests/') && path !== '/guests') return { component: GuestDetailPage, title: 'Guest Profile' };
  if (path.startsWith('/billing/') && path !== '/billing') return { component: BillingPage, title: 'Billing' };
  if (path.startsWith('/restaurant/kitchen')) return routes['/restaurant/kitchen'];
  if (path.startsWith('/restaurant')) return routes['/restaurant'];
  return routes['/dashboard'];
}

const adminOnlyRoutes = ['/reports', '/leads', '/events', '/partners', '/settings'];

class PageBoundary extends Component<{ children: ReactNode; resetKey: string }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Page crash:', error, info.componentStack);
  }
  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }
  render() {
    if (this.state.error) {
      return <div className="p-6"><ErrorState message={this.state.error.message} onRetry={() => this.setState({ error: null })} /></div>;
    }
    return this.props.children;
  }
}

export default function AppLayout() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const { user } = useAuthStore();

  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const effectivePath = (user?.role !== 'ADMIN' && adminOnlyRoutes.includes(currentPath))
    ? '/dashboard'
    : currentPath;

  const { component: PageComponent, title } = resolveRoute(effectivePath);

  const pageProps: Record<string, string> = {};
  if (effectivePath.startsWith('/bookings/') && effectivePath !== '/bookings/new') {
    pageProps.bookingId = effectivePath.replace('/bookings/', '');
  } else if (effectivePath.startsWith('/guests/') && effectivePath !== '/guests') {
    pageProps.guestId = effectivePath.replace('/guests/', '');
  } else if (effectivePath.startsWith('/billing/') && effectivePath !== '/billing') {
    pageProps.bookingId = effectivePath.replace('/billing/', '');
  }

  return (
    <div className="page-bg flex h-screen overflow-hidden">
      <Sidebar currentPath={effectivePath} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header title={title} />
        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
          <PageBoundary resetKey={effectivePath}>
            <Suspense fallback={<PageSkeleton />}>
              <PageComponent {...pageProps} />
            </Suspense>
          </PageBoundary>
        </main>
      </div>
    </div>
  );
}
