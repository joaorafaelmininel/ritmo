import { usePreferencias } from './preferencias';

// Paleta pensada para leitura fácil: contraste mínimo 7:1 (WCAG AAA) para texto.
const normal = {
  fundo: '#F5F3EE',
  superficie: '#FFFFFF',
  texto: '#1A1A1A',
  textoSuave: '#454545',
  borda: '#CFCAC0',
  primaria: '#0B4F8A',
  primariaSuave: '#E2EDF8',
  sobrePrimaria: '#FFFFFF',
  sucesso: '#1B6B38',
  sucessoSuave: '#E3F3E8',
  alerta: '#7A4300',
  alertaSuave: '#FCEFD9',
  perigo: '#A82018',
  perigoSuave: '#FBE5E3',
  foco: '#F2B705',
};

const altoContraste: typeof normal = {
  fundo: '#FFFFFF',
  superficie: '#FFFFFF',
  texto: '#000000',
  textoSuave: '#000000',
  borda: '#000000',
  primaria: '#002F5F',
  primariaSuave: '#D6E6F7',
  sobrePrimaria: '#FFFFFF',
  sucesso: '#0B4A22',
  sucessoSuave: '#D4EEDC',
  alerta: '#5C3200',
  alertaSuave: '#FBE6C2',
  perigo: '#7F0F09',
  perigoSuave: '#F9D6D3',
  foco: '#F2B705',
};

export type Cores = typeof normal;

export const tamanhos = {
  pequeno: 17,
  texto: 19,
  subtitulo: 21,
  titulo: 25,
  grande: 30,
};

export const espaco = { xs: 6, s: 10, m: 16, l: 22, xl: 32 };

/** Altura mínima de qualquer área de toque (maior que os 44–48 pt das diretrizes). */
export const ALVO_TOQUE = 56;

export function useTema() {
  const { escala, contraste } = usePreferencias();
  const c = contraste ? altoContraste : normal;
  const f = (t: keyof typeof tamanhos) => Math.round(tamanhos[t] * escala);
  return { c, f, escala, contraste, borda: contraste ? 2 : 1 };
}
