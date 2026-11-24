import { notificar } from './notificacoes';
import { mensagemErro, supabase } from './supabase';
import type { RegistroPortaria } from './tipos';

/** Morador responde à portaria (autoriza ou não a entrada). Devolve mensagem de erro, se houver. */
export async function responderPortaria(id: string, status: RegistroPortaria['status']) {
  const { error } = await supabase.from('portaria').update({ status }).eq('id', id);
  if (error) return mensagemErro(error);
  notificar('portaria', id);
  return null;
}
