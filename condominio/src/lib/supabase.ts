import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const chave = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const configurado = Boolean(url && chave);

export const supabase = createClient(url || 'https://exemplo.supabase.co', chave || 'chave-ausente', {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    // Sessão longa: a pessoa não precisa entrar de novo a cada uso.
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Renova o login só com o app aberto (recomendação do Supabase para apps móveis).
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (estado) => {
    if (estado === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

/** Mensagem de erro em português simples. */
export function mensagemErro(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? String(e ?? '');
  if (/network|fetch/i.test(msg)) return 'Sem conexão com a internet. Verifique o Wi‑Fi ou os dados móveis e tente de novo.';
  if (/token.*(expired|invalid)|otp/i.test(msg)) return 'Código inválido ou vencido. Peça um novo código.';
  if (/rate limit|too many/i.test(msg)) return 'Muitas tentativas seguidas. Aguarde alguns minutos.';
  if (/row-level security|permission denied/i.test(msg)) return 'Você não tem permissão para fazer isso.';
  if (/reservas_sem_conflito|duplicate key/i.test(msg)) return 'Esse horário acabou de ser reservado por outra unidade. Escolha outro.';
  return msg || 'Algo deu errado. Tente de novo.';
}
