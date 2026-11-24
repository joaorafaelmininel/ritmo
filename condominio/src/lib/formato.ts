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

export type FormatoUnidade = 'bloco_numero' | 'quadra_lote' | 'casa';
let FORMATO: FormatoUnidade = 'bloco_numero';
/** Definido pela sessão conforme o condomínio ativo. */
export function definirFormatoUnidade(f?: string | null) {
  FORMATO = f === 'quadra_lote' || f === 'casa' ? f : 'bloco_numero';
}
export const formatoUnidade = () => FORMATO;

/** "Quadra 8 · Lote 1", "Bloco A · 101", "Casa 12" */
export function nomeUnidade(u?: { bloco?: string | null; numero?: string | null } | null) {
  if (!u?.numero) return '';
  if (FORMATO === 'quadra_lote') return u.bloco ? `Quadra ${u.bloco} · Lote ${u.numero}` : `Lote ${u.numero}`;
  if (FORMATO === 'casa') return `Casa ${u.bloco ? `${u.bloco}-` : ''}${u.numero}`;
  return u.bloco ? `Bloco ${u.bloco} · ${u.numero}` : `Unidade ${u.numero}`;
}

/** Forma curta usada nos botões e buscas: "Q8L1", "A-101", "101" */
export function codigoUnidade(u?: { bloco?: string | null; numero?: string | null } | null) {
  if (!u?.numero) return '';
  if (FORMATO === 'quadra_lote') return u.bloco ? `Q${u.bloco}L${u.numero}` : `L${u.numero}`;
  return u.bloco ? `${u.bloco}-${u.numero}` : u.numero;
}

/** A unidade combina com o que foi digitado na busca? Aceita "Q8L1", "8 1", "q8 l1", "101". */
export function unidadeCombina(u: { bloco?: string | null; numero?: string | null }, busca: string) {
  const b = busca.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!b) return false;
  const opcoes = [codigoUnidade(u), `${u.bloco ?? ''}${u.numero ?? ''}`, nomeUnidade(u)].map((x) => x.toLowerCase().replace(/[^a-z0-9]/g, ''));
  return opcoes.some((o) => o.includes(b));
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

/** "19:30" */
export const horaDe = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
