import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTema } from '@/lib/tema';

// Só 4 abas, sempre com ícone + texto, e uma barra alta para o dedo acertar fácil.
export default function Abas() {
  const { c, f } = useTema();
  const insets = useSafeAreaInsets();
  const icone = (nome: React.ComponentProps<typeof Ionicons>['name']) =>
    function IconeAba({ color, focused }: { color: unknown; focused: boolean }) {
      return <Ionicons name={focused ? nome : (`${nome}-outline` as typeof nome)} size={30} color={color as string} />;
    };
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.primaria,
        tabBarInactiveTintColor: c.textoSuave,
        tabBarStyle: { height: 78 + insets.bottom, paddingTop: 8, paddingBottom: insets.bottom + 8, backgroundColor: c.superficie, borderTopColor: c.borda, borderTopWidth: 1 },
        tabBarLabelStyle: { fontSize: Math.min(f('pequeno'), 19), fontWeight: '700' },
        tabBarAllowFontScaling: false,
        headerStyle: { backgroundColor: c.superficie },
        headerTitleStyle: { fontSize: f('subtitulo'), fontWeight: '700', color: c.texto },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Início', headerShown: false, tabBarIcon: icone('home') }} />
      <Tabs.Screen name="avisos" options={{ title: 'Avisos', tabBarIcon: icone('megaphone') }} />
      <Tabs.Screen name="financas" options={{ title: 'Finanças', tabBarIcon: icone('wallet') }} />
      <Tabs.Screen name="mais" options={{ title: 'Mais', tabBarIcon: icone('menu') }} />
    </Tabs>
  );
}
