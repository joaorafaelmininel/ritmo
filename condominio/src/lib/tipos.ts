export type Papel = 'morador' | 'sindico' | 'subsindico' | 'conselheiro' | 'administracao' | 'portaria';
export type Dimensao = 'financeira' | 'operacional' | 'comunidade' | 'desenvolvimento';

export type Unidade = { id: string; bloco: string; numero: string };

export type Membro = {
  id: string;
  condominio_id: string;
  unidade_id: string | null;
  papel: Papel;
  vinculo: string | null;
  telefone: string | null;
  condominios: { id: string; nome: string; cidade: string | null; uf: string | null; contato_privacidade: string | null };
  unidades: Unidade | null;
};

export type Aviso = {
  id: string; titulo: string; corpo: string; categoria: string; importante: boolean; fixado: boolean;
  publicado_em: string; perfis?: { nome: string } | null;
};

export type Chamado = {
  id: string; titulo: string; descricao: string | null; categoria: string; local: string | null;
  status: 'aberto' | 'em_andamento' | 'resolvido' | 'cancelado'; fotos: string[]; criado_em: string;
  autor_id: string | null; unidades?: Unidade | null; perfis?: { nome: string } | null;
};

export type Area = {
  id: string; nome: string; descricao: string | null; regras: string | null; capacidade: number | null;
  taxa: number; exige_aprovacao: boolean; ativa: boolean;
};

export type Reserva = {
  id: string; area_id: string; data: string; periodo: string; status: string; observacao: string | null;
  areas_comuns?: { nome: string } | null; unidades?: Unidade | null;
};

export type Lancamento = {
  id: string; tipo: 'receita' | 'despesa'; categoria: string; descricao: string; valor: number;
  data: string; fornecedor: string | null; comprovante_path: string | null;
};

export type Cobranca = {
  id: string; competencia: string; valor: number; vencimento: string; status: 'aberta' | 'paga' | 'acordo';
  pago_em: string | null; pix_copia_cola: string | null; link_boleto: string | null; unidades?: Unidade | null;
};

export type Projeto = {
  id: string; dimensao: Dimensao; tipo: 'projeto' | 'processo'; titulo: string; descricao: string | null;
  status: 'planejado' | 'em_andamento' | 'concluido' | 'pausado'; progresso: number; responsavel: string | null;
  prazo: string | null; orcamento: number | null; publico: boolean; ordem: number;
};

export type Sugestao = {
  id: string; titulo: string; descricao: string | null; dimensao: Dimensao | null; status: string;
  resposta: string | null; criado_em: string; autor_id: string | null; perfis?: { nome: string } | null;
  sugestoes_apoios?: { perfil_id: string }[];
};

export type Manutencao = {
  id: string; item: string; descricao: string | null; periodicidade_meses: number; ultima_realizacao: string | null;
  proxima: string | null; fornecedor: string | null; obrigacao_legal: boolean;
};

export type Enquete = { id: string; titulo: string; descricao: string | null; encerra_em: string | null; criado_em: string };

export const NOME_PAPEL: Record<Papel, string> = {
  morador: 'Morador(a)',
  sindico: 'Síndico(a)',
  subsindico: 'Subsíndico(a)',
  conselheiro: 'Conselheiro(a)',
  administracao: 'Administração',
  portaria: 'Portaria',
};

// As quatro dimensões do plano de gestão, com nomes simples para o morador.
export const DIMENSOES: Record<Dimensao, { nome: string; apelido: string; icone: string; cor: string }> = {
  financeira: { nome: 'Financeira', apelido: 'Dinheiro do condomínio', icone: 'wallet-outline', cor: '#1B6B38' },
  operacional: { nome: 'Operacional', apelido: 'Dia a dia e manutenção', icone: 'construct-outline', cor: '#0B4F8A' },
  comunidade: { nome: 'Comunidade', apelido: 'Convivência', icone: 'people-outline', cor: '#8A3B8F' },
  desenvolvimento: { nome: 'Desenvolvimento', apelido: 'Melhorias e futuro', icone: 'trending-up-outline', cor: '#7A4300' },
};

export const STATUS_PROJETO: Record<Projeto['status'], string> = {
  planejado: 'Planejado', em_andamento: 'Em andamento', concluido: 'Concluído', pausado: 'Pausado',
};

export const STATUS_CHAMADO: Record<Chamado['status'], string> = {
  aberto: 'Recebido', em_andamento: 'Em andamento', resolvido: 'Resolvido', cancelado: 'Cancelado',
};

export const corStatus = (s: Chamado['status']) =>
  ({ aberto: 'alerta', em_andamento: 'primaria', resolvido: 'sucesso', cancelado: 'neutro' } as const)[s];

export const CATEGORIAS_CHAMADO: Record<string, string> = {
  manutencao: 'Conserto / manutenção', limpeza: 'Limpeza', seguranca: 'Segurança', barulho: 'Barulho / convivência',
  sugestao: 'Ideia ou elogio', outro: 'Outro assunto',
};

export const CATEGORIAS_AVISO: Record<string, string> = {
  geral: 'Geral', manutencao: 'Manutenção', seguranca: 'Segurança', financeiro: 'Financeiro', evento: 'Evento', assembleia: 'Assembleia',
};

export const PERIODOS: Record<string, string> = { dia: 'Dia inteiro', manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' };

export const CATEGORIAS_DESPESA = ['Água', 'Energia', 'Folha / portaria', 'Limpeza', 'Manutenção', 'Jardinagem', 'Administração', 'Seguro', 'Obras', 'Fundo de reserva', 'Outras'];
export const CATEGORIAS_RECEITA = ['Taxa condominial', 'Fundo de reserva', 'Multas e juros', 'Aluguel de espaço', 'Outras'];
