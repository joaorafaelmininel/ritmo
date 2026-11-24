-- =====================================================================
-- Vizinhar — estrutura do banco (Supabase / Postgres)
-- Multi-condomínio desde o início: toda informação pertence a um
-- condomínio e só é visível para quem é membro dele (Row Level Security).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
do $$ begin
  create type papel_membro as enum ('morador', 'sindico', 'subsindico', 'conselheiro', 'administracao', 'portaria');
exception when duplicate_object then null; end $$;

do $$ begin
  create type vinculo_unidade as enum ('proprietario', 'inquilino', 'familiar', 'outro');
exception when duplicate_object then null; end $$;

do $$ begin
  create type dimensao_plano as enum ('financeira', 'operacional', 'comunidade', 'desenvolvimento');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Condomínios, unidades, pessoas
-- ---------------------------------------------------------------------
create table if not exists public.condominios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cidade text,
  uf char(2),
  cnpj text,
  -- Canal do titular de dados (LGPD art. 41) — e-mail ou telefone do encarregado/síndico
  contato_privacidade text,
  criado_em timestamptz not null default now()
);

-- Código curto, sem caracteres ambíguos (0/O, 1/I/L), fácil de ditar por telefone.
create or replace function public.gerar_codigo(tamanho int default 8)
returns text language plpgsql volatile as $$
declare
  alfabeto constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  resultado text := '';
begin
  for i in 1..tamanho loop
    resultado := resultado || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
  end loop;
  return resultado;
end $$;

create table if not exists public.unidades (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios (id) on delete cascade,
  bloco text not null default '',
  numero text not null,
  -- Código de acesso entregue em papel para cada unidade. Quem digita entra como morador dela.
  codigo_acesso text not null unique default public.gerar_codigo(8),
  criado_em timestamptz not null default now(),
  unique (condominio_id, bloco, numero)
);

-- Dados mínimos da pessoa (LGPD: minimização). Nada de CPF, RG ou data de nascimento.
create table if not exists public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null default '',
  criado_em timestamptz not null default now()
);

create table if not exists public.membros (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios (id) on delete cascade,
  perfil_id uuid not null references public.perfis (id) on delete cascade,
  unidade_id uuid references public.unidades (id) on delete set null,
  papel papel_membro not null default 'morador',
  vinculo vinculo_unidade,
  -- Telefone é opcional e só a gestão enxerga (para contato em emergências).
  telefone text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (condominio_id, perfil_id)
);
create index if not exists membros_perfil_idx on public.membros (perfil_id);
create index if not exists membros_unidade_idx on public.membros (unidade_id);

-- ---------------------------------------------------------------------
-- LGPD: consentimentos, pedidos do titular e trilha de auditoria
-- ---------------------------------------------------------------------
create table if not exists public.consentimentos (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.perfis (id) on delete cascade,
  documento text not null check (documento in ('termos', 'privacidade', 'notificacoes')),
  versao text not null,
  aceito boolean not null default true,
  registrado_em timestamptz not null default now(),
  plataforma text
);
create index if not exists consentimentos_perfil_idx on public.consentimentos (perfil_id, documento);

create table if not exists public.solicitacoes_titular (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid references public.perfis (id) on delete set null,
  tipo text not null check (tipo in ('acesso', 'correcao', 'exclusao', 'revogacao', 'outro')),
  detalhes text,
  status text not null default 'recebida' check (status in ('recebida', 'em_andamento', 'concluida')),
  criado_em timestamptz not null default now(),
  concluido_em timestamptz
);

create table if not exists public.auditoria (
  id bigint generated always as identity primary key,
  condominio_id uuid references public.condominios (id) on delete cascade,
  ator_id uuid references public.perfis (id) on delete set null,
  acao text not null,
  tabela text not null,
  registro_id text,
  detalhes jsonb,
  criado_em timestamptz not null default now()
);
create index if not exists auditoria_condo_idx on public.auditoria (condominio_id, criado_em desc);

-- ---------------------------------------------------------------------
-- COMUNIDADE: avisos, enquetes, classificados, contatos úteis
-- ---------------------------------------------------------------------
create table if not exists public.avisos (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios (id) on delete cascade,
  autor_id uuid references public.perfis (id) on delete set null,
  titulo text not null,
  corpo text not null,
  categoria text not null default 'geral' check (categoria in ('geral', 'manutencao', 'seguranca', 'financeiro', 'evento', 'assembleia')),
  importante boolean not null default false,
  fixado boolean not null default false,
  publicado_em timestamptz not null default now()
);
create index if not exists avisos_condo_idx on public.avisos (condominio_id, publicado_em desc);

create table if not exists public.avisos_leituras (
  aviso_id uuid not null references public.avisos (id) on delete cascade,
  perfil_id uuid not null references public.perfis (id) on delete cascade,
  lido_em timestamptz not null default now(),
  primary key (aviso_id, perfil_id)
);

create table if not exists public.enquetes (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios (id) on delete cascade,
  autor_id uuid references public.perfis (id) on delete set null,
  titulo text not null,
  descricao text,
  -- Consulta informal. Deliberações oficiais seguem a convenção (assembleia).
  encerra_em timestamptz,
  criado_em timestamptz not null default now()
);

create table if not exists public.enquete_opcoes (
  id uuid primary key default gen_random_uuid(),
  enquete_id uuid not null references public.enquetes (id) on delete cascade,
  texto text not null,
  ordem int not null default 0
);

-- Um voto por unidade. O voto é secreto: ninguém lê esta tabela diretamente,
-- os resultados saem agregados pela função resultado_enquete().
create table if not exists public.votos (
  enquete_id uuid not null references public.enquetes (id) on delete cascade,
  unidade_id uuid not null references public.unidades (id) on delete cascade,
  opcao_id uuid not null references public.enquete_opcoes (id) on delete cascade,
  perfil_id uuid references public.perfis (id) on delete set null,
  votado_em timestamptz not null default now(),
  primary key (enquete_id, unidade_id)
);

create table if not exists public.classificados (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios (id) on delete cascade,
  autor_id uuid references public.perfis (id) on delete cascade,
  tipo text not null default 'oferta' check (tipo in ('oferta', 'procura', 'servico', 'doacao')),
  titulo text not null,
  descricao text,
  preco numeric(12, 2),
  -- O próprio anunciante decide se mostra um contato.
  contato text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table if not exists public.contatos_uteis (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios (id) on delete cascade,
  nome text not null,
  descricao text,
  telefone text not null,
  categoria text not null default 'servico' check (categoria in ('emergencia', 'condominio', 'servico')),
  ordem int not null default 0
);

-- ---------------------------------------------------------------------
-- OPERACIONAL: chamados, reservas, encomendas, manutenções, documentos
-- ---------------------------------------------------------------------
create table if not exists public.chamados (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios (id) on delete cascade,
  unidade_id uuid references public.unidades (id) on delete set null,
  autor_id uuid references public.perfis (id) on delete set null,
  titulo text not null,
  descricao text,
  categoria text not null default 'manutencao' check (categoria in ('manutencao', 'limpeza', 'seguranca', 'barulho', 'sugestao', 'outro')),
  local text,
  status text not null default 'aberto' check (status in ('aberto', 'em_andamento', 'resolvido', 'cancelado')),
  fotos text[] not null default '{}',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  resolvido_em timestamptz
);
create index if not exists chamados_condo_idx on public.chamados (condominio_id, criado_em desc);

create table if not exists public.chamados_atualizacoes (
  id uuid primary key default gen_random_uuid(),
  chamado_id uuid not null references public.chamados (id) on delete cascade,
  autor_id uuid references public.perfis (id) on delete set null,
  texto text not null,
  status_novo text,
  criado_em timestamptz not null default now()
);

create table if not exists public.areas_comuns (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios (id) on delete cascade,
  nome text not null,
  descricao text,
  regras text,
  capacidade int,
  taxa numeric(12, 2) not null default 0,
  exige_aprovacao boolean not null default true,
  ativa boolean not null default true
);

create table if not exists public.reservas (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios (id) on delete cascade,
  area_id uuid not null references public.areas_comuns (id) on delete cascade,
  unidade_id uuid not null references public.unidades (id) on delete cascade,
  perfil_id uuid references public.perfis (id) on delete set null,
  data date not null,
  periodo text not null default 'dia' check (periodo in ('dia', 'manha', 'tarde', 'noite')),
  status text not null default 'pendente' check (status in ('pendente', 'confirmada', 'recusada', 'cancelada')),
  observacao text,
  criado_em timestamptz not null default now()
);
-- Impede reserva dupla da mesma área no mesmo dia/período.
create unique index if not exists reservas_sem_conflito
  on public.reservas (area_id, data, periodo)
  where status in ('pendente', 'confirmada');

create table if not exists public.encomendas (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios (id) on delete cascade,
  unidade_id uuid not null references public.unidades (id) on delete cascade,
  descricao text not null,
  registrada_por uuid references public.perfis (id) on delete set null,
  recebida_em timestamptz not null default now(),
  retirada_em timestamptz,
  retirada_por text
);
create index if not exists encomendas_unidade_idx on public.encomendas (unidade_id, recebida_em desc);

create table if not exists public.manutencoes (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios (id) on delete cascade,
  item text not null,
  descricao text,
  periodicidade_meses int not null default 12 check (periodicidade_meses > 0),
  ultima_realizacao date,
  proxima date,
  fornecedor text,
  obrigacao_legal boolean not null default false,
  criado_em timestamptz not null default now()
);

create table if not exists public.manutencoes_registros (
  id uuid primary key default gen_random_uuid(),
  manutencao_id uuid not null references public.manutencoes (id) on delete cascade,
  realizada_em date not null default current_date,
  observacao text,
  custo numeric(12, 2),
  autor_id uuid references public.perfis (id) on delete set null,
  criado_em timestamptz not null default now()
);

create table if not exists public.documentos (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios (id) on delete cascade,
  titulo text not null,
  categoria text not null default 'outro' check (categoria in ('convencao', 'regimento', 'ata', 'balancete', 'contrato', 'outro')),
  arquivo_path text not null,
  -- false = só gestão/conselho (ex.: contratos com dados de terceiros)
  publico boolean not null default true,
  autor_id uuid references public.perfis (id) on delete set null,
  criado_em timestamptz not null default now()
);

create table if not exists public.fornecedores (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios (id) on delete cascade,
  nome text not null,
  servico text,
  telefone text,
  email text,
  contrato_fim date,
  observacoes text,
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- FINANCEIRA: lançamentos (prestação de contas), orçamento, cobranças
-- ---------------------------------------------------------------------
create table if not exists public.lancamentos (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios (id) on delete cascade,
  tipo text not null check (tipo in ('receita', 'despesa')),
  categoria text not null,
  descricao text not null,
  valor numeric(12, 2) not null check (valor > 0),
  data date not null default current_date,
  fornecedor text,
  comprovante_path text,
  autor_id uuid references public.perfis (id) on delete set null,
  criado_em timestamptz not null default now()
);
create index if not exists lancamentos_condo_data_idx on public.lancamentos (condominio_id, data desc);

create table if not exists public.orcamento (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios (id) on delete cascade,
  ano int not null,
  tipo text not null check (tipo in ('receita', 'despesa')),
  categoria text not null,
  valor_previsto numeric(12, 2) not null default 0,
  unique (condominio_id, ano, tipo, categoria)
);

-- Cobrança mensal de cada unidade. Só a própria unidade e a gestão enxergam.
-- Os demais moradores veem apenas o total agregado de inadimplência.
create table if not exists public.cobrancas (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios (id) on delete cascade,
  unidade_id uuid not null references public.unidades (id) on delete cascade,
  competencia date not null,           -- primeiro dia do mês de referência
  valor numeric(12, 2) not null,
  vencimento date not null,
  status text not null default 'aberta' check (status in ('aberta', 'paga', 'acordo')),
  pago_em date,
  pix_copia_cola text,
  link_boleto text,
  criado_em timestamptz not null default now(),
  unique (unidade_id, competencia)
);

-- ---------------------------------------------------------------------
-- DESENVOLVIMENTO: plano de gestão e sugestões
-- ---------------------------------------------------------------------
create table if not exists public.projetos (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios (id) on delete cascade,
  dimensao dimensao_plano not null,
  tipo text not null default 'projeto' check (tipo in ('projeto', 'processo')),
  titulo text not null,
  descricao text,
  status text not null default 'planejado' check (status in ('planejado', 'em_andamento', 'concluido', 'pausado')),
  progresso int not null default 0 check (progresso between 0 and 100),
  responsavel text,
  prazo date,
  orcamento numeric(12, 2),
  publico boolean not null default true,
  ordem int not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.projetos_atualizacoes (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references public.projetos (id) on delete cascade,
  autor_id uuid references public.perfis (id) on delete set null,
  texto text not null,
  criado_em timestamptz not null default now()
);

create table if not exists public.sugestoes (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios (id) on delete cascade,
  autor_id uuid references public.perfis (id) on delete set null,
  titulo text not null,
  descricao text,
  dimensao dimensao_plano,
  status text not null default 'nova' check (status in ('nova', 'em_analise', 'aceita', 'virou_projeto', 'nao_aceita')),
  resposta text,
  criado_em timestamptz not null default now()
);

create table if not exists public.sugestoes_apoios (
  sugestao_id uuid not null references public.sugestoes (id) on delete cascade,
  perfil_id uuid not null references public.perfis (id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (sugestao_id, perfil_id)
);

-- ---------------------------------------------------------------------
-- Notificações (tokens de push por aparelho)
-- ---------------------------------------------------------------------
create table if not exists public.dispositivos (
  token text primary key,
  perfil_id uuid not null references public.perfis (id) on delete cascade,
  plataforma text,
  atualizado_em timestamptz not null default now()
);
