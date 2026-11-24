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
  condominios: { id: string; nome: string; cidade: string | null; uf: string | null; contato_privacidade: string | null; formato_unidade: string };
  unidades: Unidade | null;
  criado_em?: string;
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
export const DIMENSOES: Record<Dimensao, { nome: string; botao: string; apelido: string; descricao: string; icone: string; cor: string }> = {
  financeira: { nome: 'Financeira', botao: 'Finanças', apelido: 'Dinheiro do condomínio', descricao: 'Saúde financeira, notas, balancetes e extratos', icone: 'wallet-outline', cor: '#1B6B38' },
  comunidade: { nome: 'Comunidade', botao: 'Comunidade', apelido: 'Convivência', descricao: 'Avisos, pets, prestadores e vizinhos', icone: 'people-outline', cor: '#8A3B8F' },
  operacional: { nome: 'Operacional', botao: 'Dia a dia', apelido: 'Dia a dia e manutenção', descricao: 'Portaria, visitas, entregas e ocorrências', icone: 'construct-outline', cor: '#0B4F8A' },
  desenvolvimento: { nome: 'Desenvolvimento', botao: 'Desenvolvimento', apelido: 'Melhorias e futuro', descricao: 'Calendário do ano, plano de gestão e ideias', icone: 'trending-up-outline', cor: '#7A4300' },
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
  operacional: 'Dia a dia', geral: 'Geral', manutencao: 'Manutenção', seguranca: 'Segurança', financeiro: 'Financeiro', evento: 'Evento', assembleia: 'Assembleia',
};

export const PERIODOS: Record<string, string> = { dia: 'Dia inteiro', manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' };

export const CATEGORIAS_DESPESA = ['Água', 'Energia', 'Folha / portaria', 'Limpeza', 'Manutenção', 'Jardinagem', 'Administração', 'Seguro', 'Obras', 'Fundo de reserva', 'Outras'];
export const CATEGORIAS_RECEITA = ['Taxa condominial', 'Fundo de reserva', 'Multas e juros', 'Aluguel de espaço', 'Outras'];

export type ContaBancaria = { id: string; nome: string; banco: string | null; tipo: 'corrente' | 'reserva' | 'aplicacao' | 'obras'; ordem: number };
export type Saldo = { id: string; conta_id: string; competencia: string; saldo_final: number; extrato_path: string | null; extrato_publico: boolean };
export const TIPOS_CONTA: Record<ContaBancaria['tipo'], string> = { corrente: 'Conta corrente', reserva: 'Fundo de reserva', aplicacao: 'Aplicação', obras: 'Fundo de obras' };

export type Documento = { id: string; titulo: string; categoria: string; arquivo_path: string; publico: boolean; criado_em: string; competencia: string | null };

/** Documentos financeiros, na ordem em que aparecem para o morador. */
export const DOCS_FINANCEIROS: Record<string, { nome: string; explicacao: string; icone: string }> = {
  balancete: { nome: 'Balancetes mensais', explicacao: 'Resumo oficial de receitas, despesas e saldos de cada mês', icone: 'document-text-outline' },
  prestacao_contas: { nome: 'Prestação de contas anual', explicacao: 'Contas do ano apresentadas em assembleia', icone: 'albums-outline' },
  parecer_conselho: { nome: 'Pareceres do conselho fiscal', explicacao: 'Análise das contas feita pelo conselho', icone: 'shield-checkmark-outline' },
  orcamento: { nome: 'Orçamento aprovado', explicacao: 'Previsão de gastos aprovada em assembleia', icone: 'calculator-outline' },
  contrato: { nome: 'Contratos', explicacao: 'Contratos com empresas e prestadores', icone: 'briefcase-outline' },
  apolice: { nome: 'Seguro do condomínio', explicacao: 'Apólice e coberturas', icone: 'umbrella-outline' },
  laudo: { nome: 'Laudos e certificados', explicacao: 'AVCB, para-raios, caixa d’água', icone: 'ribbon-outline' },
};
export const DOCS_GERAIS: Record<string, string> = { convencao: 'Convenção', regimento: 'Regimento interno', ata: 'Atas de assembleia', outro: 'Outros' };

export type Equipe = { id: string; nome: string; funcao: string; dias: number[]; hora_inicio: string; hora_fim: string; ramal: string | null; ativo: boolean };
export const FUNCOES_EQUIPE: Record<string, string> = {
  portaria: 'Portaria', zelador: 'Zelador(a)', limpeza: 'Limpeza', manutencao: 'Manutenção', jardinagem: 'Jardinagem',
  seguranca: 'Segurança', administracao: 'Administração', outro: 'Outro',
};

export type RegistroPortaria = {
  id: string; unidade_id: string; origem: 'morador' | 'portaria'; tipo: 'visita' | 'prestador' | 'entrega'; nome: string; data: string;
  observacao: string | null; status: 'esperado' | 'na_portaria' | 'autorizado' | 'negado' | 'entrou' | 'cancelado'; respondido_em: string | null;
  criado_em: string; unidades?: Unidade | null;
};
export const TIPOS_PORTARIA: Record<RegistroPortaria['tipo'], string> = { visita: 'Visita', prestador: 'Prestador de serviço', entrega: 'Entrega / delivery' };
export const STATUS_PORTARIA: Record<RegistroPortaria['status'], { nome: string; tipo: 'neutro' | 'sucesso' | 'alerta' | 'perigo' | 'primaria' }> = {
  esperado: { nome: 'Portaria avisada', tipo: 'primaria' },
  na_portaria: { nome: 'Aguardando resposta', tipo: 'alerta' },
  autorizado: { nome: 'Autorizado', tipo: 'sucesso' },
  negado: { nome: 'Não autorizado', tipo: 'perigo' },
  entrou: { nome: 'Entrou', tipo: 'sucesso' },
  cancelado: { nome: 'Cancelado', tipo: 'neutro' },
};

export type Pet = {
  id: string; unidade_id: string; nome: string; especie: 'cachorro' | 'gato' | 'ave' | 'outro'; raca: string | null; descricao: string | null;
  cuidados: string | null; foto_path: string | null; perdido: boolean; perdido_desde: string | null; ativo: boolean; criado_em: string;
  unidades?: Unidade | null;
};
export const ESPECIES: Record<Pet['especie'], { nome: string; emoji: string }> = {
  cachorro: { nome: 'Cachorro', emoji: '🐶' }, gato: { nome: 'Gato', emoji: '🐱' }, ave: { nome: 'Ave', emoji: '🐦' }, outro: { nome: 'Outro', emoji: '🐾' },
};

export type Prestador = {
  id: string; origem: 'indicado' | 'morador'; tipo: string; nome: string; telefone: string | null; descricao: string | null;
  autor_id: string | null; criado_em: string; perfis?: { nome: string } | null; novidade?: string | null; novidade_em?: string | null;
  prestadores_recomendacoes?: { perfil_id: string; comentario: string | null; perfis?: { nome: string } | null }[];
};
export const TIPOS_PRESTADOR = [
  'Eletricista', 'Encanador', 'Pedreiro', 'Pintor', 'Marceneiro', 'Chaveiro', 'Técnico de ar-condicionado', 'Técnico de eletrodomésticos',
  'Diarista', 'Jardineiro', 'Dedetização', 'Cuidador(a) de idosos', 'Babá', 'Passeador de cães', 'Veterinário', 'Aulas e reforço',
  'Beleza e estética', 'Alimentação', 'Costura', 'Informática', 'Transporte', 'Outros',
];

export type Acao = {
  id: string; titulo: string; descricao: string | null; categoria: string; mes: number; ano: number | null; repete_anualmente: boolean;
  responsavel: string | null; custo_estimado: number | null;
};
export type Execucao = { acao_id: string; ano: number; status: 'agendada' | 'concluida' | 'adiada' | 'cancelada'; data: string | null; observacao: string | null };
export const CATEGORIAS_ACAO: Record<string, { nome: string; icone: string }> = {
  poda: { nome: 'Poda e jardim', icone: 'leaf-outline' },
  manutencao: { nome: 'Manutenção', icone: 'construct-outline' },
  limpeza: { nome: 'Limpeza', icone: 'water-outline' },
  obra: { nome: 'Obra / reforma', icone: 'hammer-outline' },
  seguranca: { nome: 'Segurança', icone: 'shield-outline' },
  administrativo: { nome: 'Administrativo', icone: 'document-text-outline' },
  evento: { nome: 'Evento', icone: 'balloon-outline' },
  outro: { nome: 'Outro', icone: 'ellipsis-horizontal-circle-outline' },
};

export const TIPOS_AJUDA: Record<string, { nome: string; icone: string }> = {
  farmacia: { nome: 'Farmácia', icone: 'medkit-outline' },
  mercado: { nome: 'Mercado / compras', icone: 'cart-outline' },
  reparo: { nome: 'Pequeno reparo', icone: 'hammer-outline' },
  tecnologia: { nome: 'Celular / internet', icone: 'phone-portrait-outline' },
  companhia: { nome: 'Companhia / conversa', icone: 'chatbubbles-outline' },
  transporte: { nome: 'Carona / transporte', icone: 'car-outline' },
  outro: { nome: 'Outra coisa', icone: 'help-circle-outline' },
};
export type PedidoAjuda = {
  id: string; autor_id: string | null; tipo: string; descricao: string | null; quando: string | null;
  status: 'aberto' | 'combinado' | 'concluido' | 'cancelado'; voluntario_id: string | null; criado_em: string;
  autor?: { nome: string } | null;
};

export type Equipamento = { id: string; nome: string; local: string | null; status: 'ok' | 'atencao' | 'parado' | 'manutencao'; observacao: string | null; previsao: string | null; ordem: number; atualizado_em: string };
export const STATUS_EQUIP: Record<Equipamento['status'], { nome: string; tipo: 'sucesso' | 'alerta' | 'perigo' | 'primaria'; icone: string }> = {
  ok: { nome: 'Funcionando', tipo: 'sucesso', icone: 'checkmark-circle' },
  atencao: { nome: 'Com problema', tipo: 'alerta', icone: 'warning' },
  manutencao: { nome: 'Em manutenção', tipo: 'primaria', icone: 'construct' },
  parado: { nome: 'Parado', tipo: 'perigo', icone: 'close-circle' },
};

export type Coleta = { id: string; tipo: string; dias: number[]; horario: string | null; local: string | null; orientacao: string | null };
export const TIPOS_COLETA: Record<string, { nome: string; emoji: string }> = {
  comum: { nome: 'Lixo comum', emoji: '🗑️' }, reciclavel: { nome: 'Recicláveis', emoji: '♻️' }, organico: { nome: 'Orgânico', emoji: '🍂' },
  volumoso: { nome: 'Volumosos (móveis, entulho)', emoji: '🛋️' }, eletronico: { nome: 'Eletrônicos', emoji: '🔌' }, oleo: { nome: 'Óleo de cozinha', emoji: '🫙' },
  vidro: { nome: 'Vidro', emoji: '🍾' },
};

export type Meta = {
  id: string; dimensao: Dimensao; titulo: string; indicador: string | null; unidade_medida: string; valor_meta: number;
  sentido: 'menor' | 'maior'; ativo: boolean; metas_medicoes?: { competencia: string; valor: number }[];
};
export type Indicadores = {
  inadimplencia: number; resposta_ocorrencias: number | null; manutencoes_em_dia: number | null; adesao: number;
  primeira_resposta_min: number | null; disponibilidade_servicos: number | null; eventos_ano: number; participacao_assembleia: number | null;
  comissoes_ativas: number; ocorrencias_abertas: number; ocorrencias_resolvidas_90d: number;
};
/** Indicadores que o app calcula sozinho (nome e unidade de medida). */
export const INDICADORES_AUTO: Record<string, { nome: string; unidade: string }> = {
  inadimplencia: { nome: 'Inadimplência', unidade: '%' },
  primeira_resposta_min: { nome: 'Tempo até a primeira resposta a uma ocorrência', unidade: 'min' },
  resposta_ocorrencias: { nome: 'Tempo para resolver ocorrências', unidade: 'dias' },
  manutencoes_em_dia: { nome: 'Manutenções preventivas em dia', unidade: '%' },
  disponibilidade_servicos: { nome: 'Serviços essenciais funcionando (sem contar concessionárias, 30 dias)', unidade: '%' },
  adesao: { nome: 'Unidades usando o app', unidade: '%' },
  eventos_ano: { nome: 'Eventos de integração no ano', unidade: 'eventos' },
  participacao_assembleia: { nome: 'Participação na última assembleia', unidade: '%' },
  comissoes_ativas: { nome: 'Comissões de condôminos ativas', unidade: 'comissões' },
};
export const NOMES_INDICADOR: Record<string, string> = Object.fromEntries(Object.entries(INDICADORES_AUTO).map(([k, v]) => [k, v.nome]));

export type Evento = {
  id: string; organizador_id: string | null; comissao_id: string | null; tipo: 'festa' | 'encontro' | 'reuniao' | 'atividade' | 'outro';
  titulo: string; descricao: string | null; inicio: string; local: string | null; contribuicao: string | null; pede_prato: boolean;
  cancelado: boolean; organizador?: { nome: string } | null;
  eventos_presencas?: { unidade_id: string; adultos: number; criancas: number; rateio: boolean; prato: string | null; perfis?: { nome: string } | null }[];
};
export const TIPOS_EVENTO: Record<Evento['tipo'], { nome: string; emoji: string }> = {
  festa: { nome: 'Festa', emoji: '🎉' }, encontro: { nome: 'Encontro de moradores', emoji: '🤝' }, reuniao: { nome: 'Reunião', emoji: '📋' },
  atividade: { nome: 'Atividade', emoji: '⚽' }, outro: { nome: 'Outro', emoji: '📅' },
};

export type Incidente = {
  id: string; servico: string; status: 'aberto' | 'resolvido'; origem: 'concessionaria' | 'interna' | 'desconhecida';
  protocolo: string | null; previsao: string | null; observacao: string | null; inicio: string; fim: string | null;
  incidentes_relatos?: { perfil_id: string; detalhe: string | null }[];
};
export const SERVICOS: Record<string, { nome: string; emoji: string; detalhes: string[] }> = {
  energia: { nome: 'Luz / energia', emoji: '⚡', detalhes: ['Sem luz', 'Meia fase', 'Oscilando'] },
  agua: { nome: 'Água', emoji: '💧', detalhes: ['Sem água', 'Pouca pressão', 'Água suja'] },
  internet: { nome: 'Internet', emoji: '🌐', detalhes: ['Sem internet', 'Muito lenta'] },
  interfone: { nome: 'Interfone', emoji: '📞', detalhes: ['Não funciona', 'Com chiado'] },
  portao: { nome: 'Portão', emoji: '🚪', detalhes: ['Não abre', 'Não fecha'] },
};
export const ORIGENS_INCIDENTE: Record<Incidente['origem'], string> = {
  concessionaria: 'Da concessionária (CPFL, operadora…)', interna: 'Problema do condomínio', desconhecida: 'Ainda não se sabe',
};
