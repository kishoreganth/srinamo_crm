import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { navigate } from '@/lib/navigate';
import type { AuthResponse, LoginRequest } from '@/types';

export function useLogin() {
  const { setAuth } = useAuthStore();
  return useMutation({
    mutationFn: async (data: LoginRequest) => {
      const res = await api.post<AuthResponse>('/auth/login', data);
      return res.data;
    },
    onSuccess: (data) => {
      setAuth(data.user, data.accessToken, data.refreshToken);
      navigate('/dashboard');
    },
  });
}

export function useCurrentUser() {
  const { isAuthenticated, setUser } = useAuthStore();
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const res = await api.get('/auth/me');
      setUser(res.data);
      return res.data;
    },
    enabled: isAuthenticated,
  });
}

export function useLogout() {
  const { logout } = useAuthStore();
  return () => {
    logout();
    navigate('/login');
  };
}
