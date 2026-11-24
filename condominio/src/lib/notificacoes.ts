import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { VERSAO_NOTIFICACOES } from '@/legal/textos';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Pede permissão e registra o aparelho para receber avisos.
 * Só é chamado depois que a pessoa toca em "Quero receber" (consentimento explícito).
 */
export async function ativarNotificacoes(): Promise<'ok' | 'negado' | 'indisponivel'> {
  if (!Device.isDevice || Platform.OS === 'web') return 'indisponivel';
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('padrao', {
      name: 'Avisos do condomínio',
      // eslint-disable-next-line import/namespace
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return 'negado';

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return 'indisponivel';
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await supabase.from('dispositivos').upsert({ token, plataforma: Platform.OS, atualizado_em: new Date().toISOString() });
  await supabase.from('consentimentos').insert({ documento: 'notificacoes', versao: VERSAO_NOTIFICACOES, aceito: true, plataforma: Platform.OS });
  return 'ok';
}

export async function desativarNotificacoes() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await supabase.from('dispositivos').delete().eq('perfil_id', data.user.id);
  await supabase.from('consentimentos').insert({ documento: 'notificacoes', versao: VERSAO_NOTIFICACOES, aceito: false, plataforma: Platform.OS });
}

/** Pede ao servidor para avisar as pessoas envolvidas (não bloqueia a tela se falhar). */
export function notificar(tipo: 'aviso' | 'encomenda' | 'reserva' | 'chamado' | 'portaria' | 'pet_perdido' | 'pet_visto' | 'ajuda' | 'ajuda_aceita' | 'falta', id: string) {
  supabase.functions.invoke('notificar', { body: { tipo, id } }).catch(() => {});
}
