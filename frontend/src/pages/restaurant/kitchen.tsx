import { useState } from 'react';
import { Clock, ChefHat } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useKitchenOrders, useUpdateOrderStatus } from '@/hooks/useRestaurant';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import PageHeader from '@/components/layout/page-header';
import { EmptyState, ErrorState } from '@/components/layout/empty-state';
import type { FoodOrderStatus } from '@/types';

export default function KitchenPage() {
  const { data: orders, isLoading, isError, refetch } = useKitchenOrders();
  const updateStatus = useUpdateOrderStatus();
  const [flashId, setFlashId] = useState('');

  const handleStatusUpdate = async (id: string, status: FoodOrderStatus) => {
    try {
      await updateStatus.mutateAsync({ id, status });
      setFlashId(id);
      window.setTimeout(() => setFlashId((cur) => (cur === id ? '' : cur)), 400);
      toast.success(`Order marked as ${status.toLowerCase()}`);
    } catch {
      toast.error('Failed to update order');
    }
  };

  const getTimeSince = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
  };

  const borderColor: Record<string, string> = {
    PENDING: 'border-status-cleaning-fg',
    PREPARING: 'border-status-occupied-fg',
    READY: 'border-status-available-fg',
  };

  if (isError) {
    return <div className="p-6"><ErrorState message="Kitchen orders could not be loaded." onRetry={() => refetch()} /></div>;
  }

  if (isLoading) {
    return (
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-48" />)}
      </div>
    );
  }

  if (!orders?.length) {
    return (
      <div className="p-6">
        <EmptyState icon={ChefHat} title="No active orders" description="Orders will appear here automatically." />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <PageHeader title="Kitchen" description="Tickets in the kitchen queue." />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {orders.map((order) => (
          <Card key={order.id} className={cn('p-5 border-2', borderColor[order.status] || 'border-line', flashId === order.id && 'motion-row')}>
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono font-bold text-sm">#{order.id.slice(0, 8)}</span>
              <Badge variant="secondary" className={flashId === order.id ? 'motion-pulse' : ''}>{order.orderType.replace('_', ' ')}</Badge>
            </div>

            <div className="flex items-center gap-1 text-xs text-muted mb-3">
              <Clock className="h-3 w-3" />
              {getTimeSince(order.createdAt)}
            </div>

            <div className="space-y-1.5 mb-4">
              {order.items?.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span>{item.quantity}x {item.menuItem?.name}</span>
                </div>
              ))}
            </div>

            {order.booking?.room?.roomNumber && (
              <p className="text-xs text-muted mb-3">Room {order.booking.room.roomNumber}</p>
            )}

            <div className="flex gap-2">
              {order.status === 'PENDING' && (
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => handleStatusUpdate(order.id, 'PREPARING')}
                >
                  Start Preparing
                </Button>
              )}
              {order.status === 'PREPARING' && (
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => handleStatusUpdate(order.id, 'READY')}
                >
                  Mark Ready
                </Button>
              )}
              {order.status === 'READY' && (
                <Button
                  size="sm"
                  className="flex-1"
                  variant="secondary"
                  onClick={() => handleStatusUpdate(order.id, 'SERVED')}
                >
                  Mark Served
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
