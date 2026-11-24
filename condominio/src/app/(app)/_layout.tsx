import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import { useEffect } from 'react';

import { useTema } from '@/lib/tema';

export default function AppLayout() {
  const { c, f } = useTema();

  // Tocar numa notificação leva direto ao assunto (aviso, encomenda, chamado…)
  useEffect(() => {
    const abrir = (r: Notifications.NotificationResponse | null) => {
      const rota = r?.notification.request.content.data?.rota;
      if (typeof rota === 'string') router.push(rota as never);
    };
    Notifications.getLastNotificationResponseAsync().then(abrir).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(abrir);
    return () => sub.remove();
  }, []);

  return (
    <Stack
      screenOptions={{
        headerBackTitle: 'Voltar',
        headerTintColor: c.primaria,
        headerStyle: { backgroundColor: c.superficie },
        headerTitleStyle: { fontSize: f('subtitulo'), fontWeight: '700', color: c.texto },
        contentStyle: { backgroundColor: c.fundo },
      }}>
      <Stack.Screen name="(abas)" options={{ headerShown: false }} />
    </Stack>
  );
}
