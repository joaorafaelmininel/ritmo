import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PreferenciasProvider } from '@/lib/preferencias';
import { SessaoProvider, useSessao } from '@/lib/sessao';

SplashScreen.preventAutoHideAsync();

function Rotas() {
  const { carregando, sessao, consentiu, membro } = useSessao();

  useEffect(() => {
    if (!carregando) SplashScreen.hideAsync();
  }, [carregando]);

  if (carregando) return null;

  // Cada etapa só aparece quando a anterior está resolvida.
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!sessao}>
        <Stack.Screen name="entrar" />
      </Stack.Protected>
      <Stack.Protected guard={!!sessao && !consentiu}>
        <Stack.Screen name="consentimento" />
      </Stack.Protected>
      <Stack.Protected guard={!!sessao && consentiu && !membro}>
        <Stack.Screen name="vincular" />
      </Stack.Protected>
      <Stack.Protected guard={!!sessao && consentiu && !!membro}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      {/* Textos legais podem ser lidos em qualquer etapa */}
      <Stack.Screen name="legal/[doc]" options={{ headerShown: true, title: 'Documento', headerBackTitle: 'Voltar' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PreferenciasProvider>
        <SessaoProvider>
          <StatusBar style="dark" />
          <Rotas />
        </SessaoProvider>
      </PreferenciasProvider>
    </SafeAreaProvider>
  );
}
