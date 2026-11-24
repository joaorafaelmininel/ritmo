import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { TIPOS_COLETA, type Coleta } from './tipos';

const CHAVE = 'vizinhar:lembrete-coleta';
const PREFIXO = 'coleta-';

export async function lembreteColetaAtivo() {
  return (await AsyncStorage.getItem(CHAVE)) === 'sim';
}

/** Lembrete local (no próprio celular, sem servidor) às 18h da véspera de cada coleta. */
export async function agendarLembretesColeta(coletas: Coleta[]): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return false;
  await cancelarLembretesColeta();
  // Agrupa os tipos por dia da véspera
  const porDia: Record<number, string[]> = {};
  for (const c of coletas) for (const d of c.dias) {
    const vespera = (d + 6) % 7;
    (porDia[vespera] ??= []).push(`${TIPOS_COLETA[c.tipo]?.nome ?? c.tipo}${c.horario ? ` (${c.horario.toLowerCase()})` : ''}`);
  }
  for (const [dia, tipos] of Object.entries(porDia)) {
    await Notifications.scheduleNotificationAsync({
      identifier: `${PREFIXO}${dia}`,
      content: { title: 'Amanhã tem coleta de lixo', body: tipos.join(' · '), data: { rota: '/coleta' } },
      // weekday: 1 = domingo … 7 = sábado
      trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: Number(dia) + 1, hour: 18, minute: 0 },
    });
  }
  await AsyncStorage.setItem(CHAVE, 'sim');
  return true;
}

export async function cancelarLembretesColeta() {
  if (Platform.OS !== 'web') {
    const agendadas = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(agendadas.filter((n) => n.identifier.startsWith(PREFIXO)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
  }
  await AsyncStorage.removeItem(CHAVE);
}
