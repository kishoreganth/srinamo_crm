import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { MenuItem, FoodOrder, CreateFoodOrderRequest } from '@/types';

export function useMenuItems(category?: string) {
  return useQuery({
    queryKey: ['restaurant', 'menu', category],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (category) params.category = category;
      const res = await api.get<MenuItem[]>('/restaurant/menu', { params });
      return res.data;
    },
  });
}

export function useMenuCategories() {
  return useQuery({
    queryKey: ['restaurant', 'menu', 'categories'],
    queryFn: async () => {
      const res = await api.get<string[]>('/restaurant/menu/categories');
      return res.data;
    },
  });
}

export function useCreateMenuItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<MenuItem>) => {
      const res = await api.post('/restaurant/menu', data);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['restaurant', 'menu'] });
    },
  });
}

export function useUpdateMenuItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<MenuItem> & { id: string }) => {
      const res = await api.patch(`/restaurant/menu/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['restaurant', 'menu'] });
    },
  });
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateFoodOrderRequest) => {
      const res = await api.post<FoodOrder>('/restaurant/orders', data);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['restaurant', 'orders'] });
      qc.invalidateQueries({ queryKey: ['restaurant', 'kitchen'] });
    },
  });
}

export function useOrders() {
  return useQuery({
    queryKey: ['restaurant', 'orders'],
    queryFn: async () => {
      const res = await api.get<FoodOrder[]>('/restaurant/orders');
      return res.data;
    },
  });
}

export function useKitchenOrders() {
  return useQuery({
    queryKey: ['restaurant', 'kitchen'],
    queryFn: async () => {
      const res = await api.get<FoodOrder[]>('/restaurant/kitchen');
      return res.data;
    },
    refetchInterval: 10000,
  });
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await api.patch(`/restaurant/orders/${id}/status`, { status });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['restaurant', 'orders'] });
      qc.invalidateQueries({ queryKey: ['restaurant', 'kitchen'] });
    },
  });
}
