import { useState } from 'react';
import { Minus, Plus, ShoppingCart, Leaf, Drumstick } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { useMenuItems, useMenuCategories, useCreateOrder, useOrders } from '@/hooks/useRestaurant';
import { useBookings } from '@/hooks/useBookings';
import { formatCurrency, formatDateTime, getStatusColor } from '@/lib/utils';
import { toast } from 'sonner';
import type { MenuItem, FoodOrderType } from '@/types';

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
}

export default function RestaurantPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<FoodOrderType>('DINE_IN');
  const [selectedBookingId, setSelectedBookingId] = useState('');

  const { data: menuItems, isLoading } = useMenuItems(selectedCategory || undefined);
  const { data: categories } = useMenuCategories();
  const { data: recentOrders } = useOrders();
  const { data: bookingsData } = useBookings({ status: 'CHECKED_IN' });
  const createOrder = useCreateOrder();

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItem.id === item.id);
      if (existing) return prev.map((c) => c.menuItem.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { menuItem: item, quantity: 1 }];
    });
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart((prev) => prev
      .map((c) => c.menuItem.id === itemId ? { ...c, quantity: c.quantity + delta } : c)
      .filter((c) => c.quantity > 0)
    );
  };

  const total = cart.reduce((sum, c) => sum + c.menuItem.price * c.quantity, 0);

  const handlePlaceOrder = async () => {
    if (cart.length === 0) { toast.error('Cart is empty'); return; }
    if (orderType === 'ROOM_SERVICE' && !selectedBookingId) { toast.error('Select a room/booking'); return; }
    try {
      await createOrder.mutateAsync({
        type: orderType,
        bookingId: orderType === 'ROOM_SERVICE' ? selectedBookingId : undefined,
        items: cart.map((c) => ({ menuItemId: c.menuItem.id, quantity: c.quantity })),
      });
      setCart([]);
      toast.success('Order placed successfully');
    } catch {
      toast.error('Failed to place order');
    }
  };

  if (isLoading) return <div className="p-6"><Skeleton className="h-96" /></div>;

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant={!selectedCategory ? 'default' : 'outline'}
              onClick={() => setSelectedCategory('')}
              className={!selectedCategory ? 'bg-emerald-600' : ''}
            >
              All
            </Button>
            {categories?.map((cat) => (
              <Button
                key={cat}
                size="sm"
                variant={selectedCategory === cat ? 'default' : 'outline'}
                onClick={() => setSelectedCategory(cat)}
                className={selectedCategory === cat ? 'bg-emerald-600' : ''}
              >
                {cat}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {menuItems?.filter((m) => m.isAvailable).map((item) => (
              <Card
                key={item.id}
                className="p-4 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => addToCart(item)}
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="text-sm font-medium leading-tight">{item.name}</h4>
                  {item.isVeg ? (
                    <Leaf className="h-4 w-4 text-green-600 shrink-0" />
                  ) : (
                    <Drumstick className="h-4 w-4 text-red-600 shrink-0" />
                  )}
                </div>
                <p className="text-sm font-semibold text-emerald-700">{formatCurrency(item.price)}</p>
              </Card>
            ))}
            {menuItems?.length === 0 && (
              <p className="col-span-3 text-center text-gray-500 py-8">No items in this category</p>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <Card className="p-5 sticky top-6">
            <div className="flex items-center gap-2 mb-4">
              <ShoppingCart className="h-5 w-5 text-gray-600" />
              <h3 className="font-semibold">Current Order</h3>
            </div>

            <div className="space-y-3 mb-4">
              <Select value={orderType} onValueChange={(v) => setOrderType(v as FoodOrderType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DINE_IN">Dine In</SelectItem>
                  <SelectItem value="ROOM_SERVICE">Room Service</SelectItem>
                  <SelectItem value="WALK_IN">Walk In</SelectItem>
                </SelectContent>
              </Select>

              {orderType === 'ROOM_SERVICE' && (
                <Select value={selectedBookingId} onValueChange={setSelectedBookingId}>
                  <SelectTrigger><SelectValue placeholder="Select Room/Booking" /></SelectTrigger>
                  <SelectContent>
                    {bookingsData?.data?.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        Room {b.room.roomNumber} - {b.guest.firstName} {b.guest.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <Separator className="my-3" />

            {cart.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">Add items to order</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {cart.map((c) => (
                  <div key={c.menuItem.id} className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.menuItem.name}</p>
                      <p className="text-xs text-gray-500">{formatCurrency(c.menuItem.price)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => updateQuantity(c.menuItem.id, -1)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="text-sm font-medium w-5 text-center">{c.quantity}</span>
                      <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => updateQuantity(c.menuItem.id, 1)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Separator className="my-3" />

            <div className="flex justify-between items-center mb-4">
              <span className="font-semibold">Total</span>
              <span className="text-lg font-bold text-emerald-700">{formatCurrency(total)}</span>
            </div>

            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              disabled={cart.length === 0 || createOrder.isPending}
              onClick={handlePlaceOrder}
            >
              {createOrder.isPending ? 'Placing...' : 'Place Order'}
            </Button>
          </Card>
        </div>
      </div>

      <Card className="p-5">
        <h3 className="font-semibold mb-4">Recent Orders</h3>
        {recentOrders?.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentOrders.slice(0, 10).map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono">{order.orderNumber}</TableCell>
                  <TableCell><Badge variant="secondary">{order.type.replace('_', ' ')}</Badge></TableCell>
                  <TableCell>{order.items?.length} items</TableCell>
                  <TableCell>{formatCurrency(order.totalAmount)}</TableCell>
                  <TableCell><Badge className={getStatusColor(order.status)}>{order.status}</Badge></TableCell>
                  <TableCell>{formatDateTime(order.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-center text-gray-500 py-6">No recent orders</p>
        )}
      </Card>
    </div>
  );
}
