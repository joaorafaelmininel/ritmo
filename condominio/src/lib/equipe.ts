import type { Equipe } from './tipos';

const minutos = (h: string) => {
  const [hh, mm] = h.split(':').map(Number);
  return hh * 60 + (mm || 0);
};

/** A pessoa está trabalhando agora? Considera turnos que atravessam a meia-noite. */
export function emServico(e: Equipe, agora = new Date()) {
  const dia = agora.getDay();
  const m = agora.getHours() * 60 + agora.getMinutes();
  const ini = minutos(e.hora_inicio);
  const fim = minutos(e.hora_fim);
  if (ini <= fim) return e.dias.includes(dia) && m >= ini && m < fim;
  return (e.dias.includes(dia) && m >= ini) || (e.dias.includes((dia + 6) % 7) && m < fim);
}

export const hora = (h: string) => h.slice(0, 5).replace(':00', 'h').replace(':', 'h');

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export function nomeDias(dias: number[]) {
  const d = [...dias].sort();
  if (d.length === 7) return 'Todos os dias';
  if (d.join() === '1,2,3,4,5') return 'Segunda a sexta';
  if (d.join() === '1,2,3,4,5,6') return 'Segunda a sábado';
  return d.map((x) => DIAS[x]).join(', ');
}
export const DIAS_SEMANA = DIAS;
