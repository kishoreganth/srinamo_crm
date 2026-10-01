import { Clock, ChefHat } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useKitchenOrders, useUpdateOrderStatus } from '@/hooks/useRestaurant';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { FoodOrderStatus } from '@/types';

export default function KitchenPage() {
  const { data: orders, isLoading } = useKitchenOrders();
  const updateStatus = useUpdateOrderStatus();

  const handleStatusUpdate = async (id: string, status: FoodOrderStatus) => {
    try {
      await updateStatus.mutateAsync({ id, status });
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
    PLACED: 'border-yellow-400',
    PREPARING: 'border-blue-400',
    READY: 'border-emerald-400',
  };

  if (isLoading) {
    return (
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-48" />)}
      </div>
    );
  }

  if (!orders?.length) {
    return (
      <div className="p-6 flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <ChefHat className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">No active orders</p>
          <p className="text-gray-400 text-sm">Orders will appear here automatically</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {orders.map((order) => (
          <Card key={order.id} className={cn('p-5 border-2', borderColor[order.status] || 'border-gray-200')}>
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono font-bold text-sm">#{order.orderNumber}</span>
              <Badge variant="secondary">{order.type.replace('_', ' ')}</Badge>
            </div>

            <div className="flex items-center gap-1 text-xs text-gray-500 mb-3">
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

            {order.room && (
              <p className="text-xs text-gray-500 mb-3">Room {order.room.roomNumber}</p>
            )}

            <div className="flex gap-2">
              {order.status === 'PLACED' && (
                <Button
                  size="sm"
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  onClick={() => handleStatusUpdate(order.id, 'PREPARING')}
                >
                  Start Preparing
                </Button>
              )}
              {order.status === 'PREPARING' && (
                <Button
                  size="sm"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => handleStatusUpdate(order.id, 'READY')}
                >
                  Mark Ready
                </Button>
              )}
              {order.status === 'READY' && (
                <Button
                  size="sm"
                  className="flex-1 bg-gray-600 hover:bg-gray-700"
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
