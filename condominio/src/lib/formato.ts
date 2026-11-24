const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

export const nomeMes = (m: number) => MESES[m];

export function moeda(v: number | string | null | undefined) {
  const n = Number(v ?? 0);
  return 'R$ ' + n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** "2026-11-24" → Date local (sem fuso deslocando o dia) */
export function dataLocal(iso: string) {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(a, m - 1, d);
}

/** Date → "2026-11-24" */
export function isoData(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** "24/11/2026" */
export function dataCurta(v: string | Date | null | undefined) {
  if (!v) return '—';
  const d = typeof v === 'string' ? (v.length <= 10 ? dataLocal(v) : new Date(v)) : v;
  return d.toLocaleDateString('pt-BR');
}

/** "terça-feira, 24 de novembro" */
export function dataPorExtenso(v: string | Date) {
  const d = typeof v === 'string' ? (v.length <= 10 ? dataLocal(v) : new Date(v)) : v;
  return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

/** "hoje às 14:30", "ontem", "12/11/2026" */
export function quando(v: string) {
  const d = new Date(v);
  const hoje = new Date();
  const dias = Math.floor((new Date(isoData(hoje)).getTime() - new Date(isoData(d)).getTime()) / 86400000);
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (dias === 0) return `hoje às ${hora}`;
  if (dias === 1) return `ontem às ${hora}`;
  if (dias < 7) return `${DIAS[d.getDay()]} às ${hora}`;
  return d.toLocaleDateString('pt-BR');
}

export function saudacao() {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

export function nomeUnidade(u?: { bloco?: string | null; numero?: string | null } | null) {
  if (!u?.numero) return '';
  return u.bloco ? `Bloco ${u.bloco} · ${u.numero}` : `Unidade ${u.numero}`;
}

/** "1.234,56" → 1234.56 */
export function lerValor(t: string) {
  const n = Number(t.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

/** "24/11/2026" → "2026-11-24" (ou null se inválida) */
export function lerData(t: string) {
  const m = t.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  if (d.getMonth() !== Number(m[2]) - 1) return null;
  return isoData(d);
}
