-- =====================================================================
-- Vizinhar — transparência financeira e "Dia a dia" (portaria)
-- =====================================================================

-- ---------------------------------------------------------------------
-- FINANÇAS: documentos financeiros por classificação
-- ---------------------------------------------------------------------
alter table public.documentos drop constraint if exists documentos_categoria_check;
alter table public.documentos add constraint documentos_categoria_check check (categoria in (
  'convencao', 'regimento', 'ata', 'outro',
  -- financeiros
  'balancete', 'prestacao_contas', 'parecer_conselho', 'orcamento', 'contrato', 'apolice', 'laudo'
));
-- Mês a que o documento se refere (ex.: balancete de outubro)
alter table public.documentos add column if not exists competencia date;

alter table public.lancamentos add column if not exists nota_fiscal text;      -- nº da nota/recibo
alter table public.lancamentos add column if not exists forma_pagamento text;  -- boleto, pix, transferência…

-- Contas do condomínio (conta corrente, fundo de reserva, aplicação, fundo de obras)
create table if not exists public.contas_bancarias (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios (id) on delete cascade,
  nome text not null,
  banco text,
  tipo text not null default 'corrente' check (tipo in ('corrente', 'reserva', 'aplicacao', 'obras')),
  ativa boolean not null default true,
  ordem int not null default 0,
  criado_em timestamptz not null default now()
);

-- Saldo de fim de mês de cada conta + extrato (PDF)
create table if not exists public.saldos (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios (id) on delete cascade,
  conta_id uuid not null references public.contas_bancarias (id) on delete cascade,
  competencia date not null,                 -- primeiro dia do mês
  saldo_final numeric(14, 2) not null,
  extrato_path text,
  -- Extratos mostram nomes de quem pagou. Só ficam abertos a todos se a gestão
  -- confirmar que ocultou dados de moradores; senão, apenas gestão e conselho veem o arquivo.
  extrato_publico boolean not null default false,
  criado_em timestamptz not null default now(),
  unique (conta_id, competencia)
);

alter table public.contas_bancarias enable row level security;
alter table public.saldos enable row level security;

drop policy if exists "membros veem" on public.contas_bancarias;
drop policy if exists "gestao gerencia" on public.contas_bancarias;
create policy "membros veem" on public.contas_bancarias for select using (e_membro(condominio_id));
create policy "gestao gerencia" on public.contas_bancarias for all using (e_gestor(condominio_id)) with check (e_gestor(condominio_id));

drop policy if exists "membros veem" on public.saldos;
drop policy if exists "gestao gerencia" on public.saldos;
create policy "membros veem" on public.saldos for select using (e_membro(condominio_id));
create policy "gestao gerencia" on public.saldos for all using (e_gestor(condominio_id)) with check (e_gestor(condominio_id));

do $$
declare t text;
begin
  foreach t in array array['saldos', 'contas_bancarias'] loop
    execute format('drop trigger if exists auditar on public.%I', t);
    execute format('create trigger auditar after insert or update or delete on public.%I for each row execute function public.auditar()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- DIA A DIA: comunicados operacionais (portaria também pode publicar)
-- ---------------------------------------------------------------------
alter table public.avisos drop constraint if exists avisos_categoria_check;
alter table public.avisos add constraint avisos_categoria_check check (categoria in (
  'geral', 'manutencao', 'seguranca', 'financeiro', 'evento', 'assembleia', 'operacional'
));
-- Comunicados temporários ("portão B com defeito até sexta")
alter table public.avisos add column if not exists valido_ate timestamptz;

drop policy if exists "gestao publica" on public.avisos;
drop policy if exists "gestao remove" on public.avisos;
create policy "gestao publica" on public.avisos for insert with check (
  autor_id = auth.uid() and (
    e_gestor(condominio_id)
    or (e_portaria(condominio_id) and categoria in ('operacional', 'seguranca', 'manutencao') and not importante)
  )
);
create policy "gestao remove" on public.avisos for delete using (
  e_gestor(condominio_id) or (e_portaria(condominio_id) and autor_id = auth.uid())
);

-- ---------------------------------------------------------------------
-- DIA A DIA: equipe e horários (quem está de plantão)
-- ---------------------------------------------------------------------
create table if not exists public.equipe (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios (id) on delete cascade,
  -- Basta o primeiro nome (minimização de dados do funcionário)
  nome text not null,
  funcao text not null default 'portaria' check (funcao in ('portaria', 'zelador', 'limpeza', 'manutencao', 'jardinagem', 'seguranca', 'administracao', 'outro')),
  dias int[] not null default '{1,2,3,4,5}',      -- 0 = domingo … 6 = sábado
  hora_inicio time not null default '07:00',
  hora_fim time not null default '19:00',         -- se menor que o início, atravessa a meia-noite
  ramal text,                                     -- telefone/ramal do posto (não o celular pessoal)
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
alter table public.equipe enable row level security;
drop policy if exists "membros veem" on public.equipe;
drop policy if exists "gestao gerencia" on public.equipe;
create policy "membros veem" on public.equipe for select using (e_membro(condominio_id));
create policy "gestao gerencia" on public.equipe for all using (e_gestor(condominio_id)) with check (e_gestor(condominio_id));

-- ---------------------------------------------------------------------
-- DIA A DIA: portaria — visitas, prestadores e entregas
--   origem 'morador'  → o morador avisa antes ("vou receber o pedreiro amanhã")
--   origem 'portaria' → chegou alguém sem aviso; o morador autoriza ou não pelo app
-- ---------------------------------------------------------------------
create table if not exists public.portaria (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios (id) on delete cascade,
  unidade_id uuid not null references public.unidades (id) on delete cascade,
  criado_por uuid references public.perfis (id) on delete set null default auth.uid(),
  origem text not null check (origem in ('morador', 'portaria')),
  tipo text not null default 'visita' check (tipo in ('visita', 'prestador', 'entrega')),
  -- Só o nome. Não guardamos documento, placa nem foto do visitante.
  nome text not null,
  data date not null default current_date,
  observacao text,
  status text not null check (status in ('esperado', 'na_portaria', 'autorizado', 'negado', 'entrou', 'cancelado')),
  respondido_por uuid references public.perfis (id) on delete set null,
  respondido_em timestamptz,
  criado_em timestamptz not null default now()
);
create index if not exists portaria_condo_data_idx on public.portaria (condominio_id, data desc);
alter table public.portaria enable row level security;

drop policy if exists "unidade ou portaria ve" on public.portaria;
drop policy if exists "morador avisa ou portaria registra" on public.portaria;
drop policy if exists "unidade ou portaria atualiza" on public.portaria;
create policy "unidade ou portaria ve" on public.portaria for select using (
  e_portaria(condominio_id) or unidade_id in (select minhas_unidades())
);
create policy "morador avisa ou portaria registra" on public.portaria for insert with check (
  criado_por = auth.uid() and (
    (origem = 'morador' and status = 'esperado' and unidade_id in (select minhas_unidades()))
    or (origem = 'portaria' and status = 'na_portaria' and e_portaria(condominio_id))
  )
);
create policy "unidade ou portaria atualiza" on public.portaria for update using (
  e_portaria(condominio_id) or unidade_id in (select minhas_unidades())
);

-- O morador só responde (autorizar/negar/cancelar); a portaria só marca a entrada.
create or replace function public.portaria_regras()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.condominio_id := old.condominio_id; new.unidade_id := old.unidade_id;
  new.origem := old.origem; new.criado_por := old.criado_por; new.criado_em := old.criado_em;
  if new.status is distinct from old.status then
    if new.status in ('autorizado', 'negado', 'cancelado') then
      if old.unidade_id not in (select minhas_unidades()) and not e_gestor(old.condominio_id) then
        raise exception 'Somente a unidade pode autorizar ou negar.';
      end if;
    elsif new.status = 'entrou' or new.status = 'na_portaria' then
      if not e_portaria(old.condominio_id) then
        raise exception 'Somente a portaria registra a chegada.';
      end if;
    end if;
    new.respondido_por := auth.uid();
    new.respondido_em := now();
  end if;
  return new;
end $$;
drop trigger if exists portaria_regras on public.portaria;
create trigger portaria_regras before update on public.portaria
  for each row execute function public.portaria_regras();

-- ---------------------------------------------------------------------
-- Retenção: registros de portaria saem após 30 dias
-- ---------------------------------------------------------------------
create or replace function public.limpar_dados_antigos()
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from encomendas where retirada_em < now() - interval '6 months';
  delete from portaria where criado_em < now() - interval '30 days';
  delete from avisos_leituras where lido_em < now() - interval '2 years';
  delete from dispositivos where atualizado_em < now() - interval '6 months';
  delete from tentativas_codigo where em < now() - interval '1 day';
  delete from classificados where not ativo and criado_em < now() - interval '1 year';
  delete from auditoria where criado_em < now() - interval '5 years';
end $$;
revoke execute on function public.limpar_dados_antigos() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Arquivos: pasta "extratos" (só gestão envia; leitura segue o padrão do bucket)
-- Extratos não revisados vão para a pasta "restrito" (gestão e conselho).
-- ---------------------------------------------------------------------

-- Modelo inicial passa a incluir as contas mais comuns
create or replace function public.aplicar_contas_padrao(p_condominio uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not e_gestor(p_condominio) then raise exception 'Somente a gestão.'; end if;
  if not exists (select 1 from contas_bancarias where condominio_id = p_condominio) then
    insert into contas_bancarias (condominio_id, nome, tipo, ordem) values
      (p_condominio, 'Conta corrente', 'corrente', 1),
      (p_condominio, 'Fundo de reserva', 'reserva', 2);
  end if;
end $$;

create or replace function public.criar_condominio(p_nome text, p_cidade text, p_uf text, p_contato_privacidade text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  c uuid;
begin
  if auth.uid() is null then raise exception 'Faça login primeiro.'; end if;
  if coalesce(trim(p_nome), '') = '' then raise exception 'Informe o nome do condomínio.'; end if;
  insert into condominios (nome, cidade, uf, contato_privacidade)
  values (trim(p_nome), nullif(trim(p_cidade), ''), upper(nullif(trim(p_uf), '')), p_contato_privacidade)
  returning id into c;
  insert into membros (condominio_id, perfil_id, papel) values (c, auth.uid(), 'sindico');
  insert into contatos_uteis (condominio_id, nome, telefone, categoria, ordem) values
    (c, 'SAMU', '192', 'emergencia', 1),
    (c, 'Bombeiros', '193', 'emergencia', 2),
    (c, 'Polícia Militar', '190', 'emergencia', 3);
  perform aplicar_modelo_inicial(c);
  perform aplicar_contas_padrao(c);
  return c;
end $$;
