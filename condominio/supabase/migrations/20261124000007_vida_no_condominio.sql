-- =====================================================================
-- Vizinhar — vida no condomínio: unidades por quadra/lote, eventos com
-- presença, falta de serviços essenciais, manual do morador, comissões,
-- assembleias e novos indicadores do plano de gestão
-- =====================================================================

-- ---------------------------------------------------------------------
-- Formato das unidades (condomínios de chácaras usam quadra e lote)
-- ---------------------------------------------------------------------
alter table public.condominios add column if not exists formato_unidade text not null default 'bloco_numero';
alter table public.condominios drop constraint if exists condominios_formato_unidade_check;
alter table public.condominios add constraint condominios_formato_unidade_check check (formato_unidade in ('bloco_numero', 'quadra_lote', 'casa'));

-- ---------------------------------------------------------------------
-- EVENTOS (festas, encontros de moradores, reuniões de comissão)
-- Qualquer morador pode organizar; a gestão modera.
-- Crianças: só a QUANTIDADE (sem nomes nem idades — LGPD art. 14).
-- ---------------------------------------------------------------------
create table if not exists public.comissoes (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios (id) on delete cascade,
  nome text not null,
  descricao text,
  ativa boolean not null default true,
  criado_em timestamptz not null default now()
);

create table if not exists public.comissoes_membros (
  comissao_id uuid not null references public.comissoes (id) on delete cascade,
  perfil_id uuid not null references public.perfis (id) on delete cascade default auth.uid(),
  coordenador boolean not null default false,
  entrou_em timestamptz not null default now(),
  primary key (comissao_id, perfil_id)
);

create table if not exists public.eventos (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios (id) on delete cascade,
  organizador_id uuid references public.perfis (id) on delete set null default auth.uid(),
  comissao_id uuid references public.comissoes (id) on delete set null,
  tipo text not null default 'festa' check (tipo in ('festa', 'encontro', 'reuniao', 'atividade', 'outro')),
  titulo text not null,
  descricao text,
  inicio timestamptz not null,
  local text,
  contribuicao text,            -- "R$ 35 por adulto; crianças até 12 não pagam"
  pede_prato boolean not null default false,
  cancelado boolean not null default false,
  criado_em timestamptz not null default now()
);
create index if not exists eventos_condo_inicio_idx on public.eventos (condominio_id, inicio);

create table if not exists public.eventos_presencas (
  evento_id uuid not null references public.eventos (id) on delete cascade,
  unidade_id uuid not null references public.unidades (id) on delete cascade,
  perfil_id uuid references public.perfis (id) on delete set null default auth.uid(),
  adultos int not null default 1 check (adultos between 0 and 30),
  criancas int not null default 0 check (criancas between 0 and 30),
  rateio boolean not null default false,
  prato text,
  criado_em timestamptz not null default now(),
  primary key (evento_id, unidade_id)
);

create table if not exists public.eventos_tarefas (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos (id) on delete cascade,
  descricao text not null,
  responsavel_id uuid references public.perfis (id) on delete set null,
  criado_em timestamptz not null default now()
);

alter table public.comissoes enable row level security;
alter table public.comissoes_membros enable row level security;
alter table public.eventos enable row level security;
alter table public.eventos_presencas enable row level security;
alter table public.eventos_tarefas enable row level security;

drop policy if exists "membros veem" on public.comissoes;
drop policy if exists "gestao gerencia" on public.comissoes;
create policy "membros veem" on public.comissoes for select using (e_membro(condominio_id));
create policy "gestao gerencia" on public.comissoes for all using (e_gestor(condominio_id)) with check (e_gestor(condominio_id));

drop policy if exists "membros veem" on public.comissoes_membros;
drop policy if exists "eu participo" on public.comissoes_membros;
drop policy if exists "saio ou gestao remove" on public.comissoes_membros;
drop policy if exists "gestao define coordenador" on public.comissoes_membros;
create policy "membros veem" on public.comissoes_membros for select using (exists (select 1 from comissoes c where c.id = comissao_id));
create policy "eu participo" on public.comissoes_membros for insert with check (
  perfil_id = auth.uid() and not coordenador and e_membro((select condominio_id from comissoes where id = comissao_id))
);
create policy "saio ou gestao remove" on public.comissoes_membros for delete using (
  perfil_id = auth.uid() or e_gestor((select condominio_id from comissoes where id = comissao_id))
);
create policy "gestao define coordenador" on public.comissoes_membros for update using (
  e_gestor((select condominio_id from comissoes where id = comissao_id))
);

drop policy if exists "membros veem" on public.eventos;
drop policy if exists "membro organiza" on public.eventos;
drop policy if exists "organizador ou gestao altera" on public.eventos;
drop policy if exists "organizador ou gestao remove" on public.eventos;
create policy "membros veem" on public.eventos for select using (e_membro(condominio_id));
create policy "membro organiza" on public.eventos for insert with check (e_membro(condominio_id) and organizador_id = auth.uid());
create policy "organizador ou gestao altera" on public.eventos for update using (organizador_id = auth.uid() or e_gestor(condominio_id));
create policy "organizador ou gestao remove" on public.eventos for delete using (organizador_id = auth.uid() or e_gestor(condominio_id));

drop policy if exists "membros veem" on public.eventos_presencas;
drop policy if exists "confirmo minha unidade" on public.eventos_presencas;
drop policy if exists "altero minha unidade" on public.eventos_presencas;
drop policy if exists "retiro minha unidade" on public.eventos_presencas;
create policy "membros veem" on public.eventos_presencas for select using (exists (select 1 from eventos e where e.id = evento_id));
create policy "confirmo minha unidade" on public.eventos_presencas for insert with check (
  unidade_id in (select minhas_unidades()) and exists (select 1 from eventos e where e.id = evento_id)
);
create policy "altero minha unidade" on public.eventos_presencas for update using (unidade_id in (select minhas_unidades()));
create policy "retiro minha unidade" on public.eventos_presencas for delete using (unidade_id in (select minhas_unidades()));

drop policy if exists "membros veem" on public.eventos_tarefas;
drop policy if exists "organizador cria" on public.eventos_tarefas;
drop policy if exists "membro assume" on public.eventos_tarefas;
drop policy if exists "organizador remove" on public.eventos_tarefas;
create policy "membros veem" on public.eventos_tarefas for select using (exists (select 1 from eventos e where e.id = evento_id));
create policy "organizador cria" on public.eventos_tarefas for insert with check (
  exists (select 1 from eventos e where e.id = evento_id and (e.organizador_id = auth.uid() or e_gestor(e.condominio_id)))
);
-- Qualquer morador assume uma tarefa livre; só quem assumiu (ou o organizador) a libera.
create policy "membro assume" on public.eventos_tarefas for update using (
  exists (select 1 from eventos e where e.id = evento_id)
  and (responsavel_id is null or responsavel_id = auth.uid()
       or exists (select 1 from eventos e where e.id = evento_id and (e.organizador_id = auth.uid() or e_gestor(e.condominio_id))))
) with check (responsavel_id is null or responsavel_id = auth.uid()
       or exists (select 1 from eventos e where e.id = evento_id and (e.organizador_id = auth.uid() or e_gestor(e.condominio_id))));
create policy "organizador remove" on public.eventos_tarefas for delete using (
  exists (select 1 from eventos e where e.id = evento_id and (e.organizador_id = auth.uid() or e_gestor(e.condominio_id)))
);

-- ---------------------------------------------------------------------
-- SERVIÇOS ESSENCIAIS: "Está faltando luz/água/internet?"
-- Moradores relatam (função); a portaria/gestão registra protocolo e previsão.
-- ---------------------------------------------------------------------
create table if not exists public.incidentes (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios (id) on delete cascade,
  servico text not null check (servico in ('energia', 'agua', 'internet', 'interfone', 'portao', 'outro')),
  status text not null default 'aberto' check (status in ('aberto', 'resolvido')),
  origem text not null default 'desconhecida' check (origem in ('concessionaria', 'interna', 'desconhecida')),
  protocolo text,
  previsao text,
  observacao text,
  inicio timestamptz not null default now(),
  fim timestamptz,
  atualizado_por uuid references public.perfis (id) on delete set null
);
create index if not exists incidentes_condo_idx on public.incidentes (condominio_id, inicio desc);

create table if not exists public.incidentes_relatos (
  incidente_id uuid not null references public.incidentes (id) on delete cascade,
  perfil_id uuid not null references public.perfis (id) on delete cascade default auth.uid(),
  detalhe text,
  criado_em timestamptz not null default now(),
  primary key (incidente_id, perfil_id)
);

alter table public.incidentes enable row level security;
alter table public.incidentes_relatos enable row level security;
drop policy if exists "membros veem" on public.incidentes;
drop policy if exists "portaria atualiza" on public.incidentes;
drop policy if exists "portaria registra" on public.incidentes;
create policy "membros veem" on public.incidentes for select using (e_membro(condominio_id));
create policy "portaria registra" on public.incidentes for insert with check (e_portaria(condominio_id));
create policy "portaria atualiza" on public.incidentes for update using (e_portaria(condominio_id));
drop policy if exists "membros veem" on public.incidentes_relatos;
create policy "membros veem" on public.incidentes_relatos for select using (exists (select 1 from incidentes i where i.id = incidente_id));

create or replace function public.incidentes_carimbo()
returns trigger language plpgsql as $$
begin
  new.atualizado_por := auth.uid();
  if new.status = 'resolvido' and old.status <> 'resolvido' then new.fim := coalesce(new.fim, now()); end if;
  if new.status = 'aberto' then new.fim := null; end if;
  return new;
end $$;
drop trigger if exists incidentes_carimbo on public.incidentes;
create trigger incidentes_carimbo before update on public.incidentes
  for each row execute function public.incidentes_carimbo();

-- Relato do morador: junta-se ao incidente aberto do mesmo serviço (ou abre um)
create or replace function public.relatar_falta(p_condominio uuid, p_servico text, p_detalhe text default null)
returns table (incidente_id uuid, relatos bigint, novo boolean)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  i uuid;
  criado boolean := false;
begin
  if not e_membro(p_condominio) then raise exception 'Sem acesso.'; end if;
  select id into i from incidentes
   where condominio_id = p_condominio and servico = p_servico and status = 'aberto' and inicio > now() - interval '24 hours'
   order by inicio desc limit 1;
  if i is null then
    insert into incidentes (condominio_id, servico) values (p_condominio, p_servico) returning id into i;
    criado := true;
  end if;
  insert into incidentes_relatos (incidente_id, perfil_id, detalhe) values (i, auth.uid(), nullif(trim(p_detalhe), ''))
  on conflict (incidente_id, perfil_id) do update set detalhe = excluded.detalhe, criado_em = now();
  return query select i, (select count(*) from incidentes_relatos r where r.incidente_id = i), criado;
end $$;

-- ---------------------------------------------------------------------
-- MANUAL DO MORADOR (seções editáveis pela gestão)
-- ---------------------------------------------------------------------
create table if not exists public.manual_secoes (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios (id) on delete cascade,
  categoria text not null default 'outro' check (categoria in ('boas_vindas', 'regras', 'animais', 'obras', 'lixo', 'areas_comuns', 'servicos', 'seguranca', 'emergencia', 'outro')),
  titulo text not null,
  conteudo text not null,
  ordem int not null default 0,
  atualizado_em timestamptz not null default now()
);
alter table public.manual_secoes enable row level security;
drop policy if exists "membros veem" on public.manual_secoes;
drop policy if exists "gestao gerencia" on public.manual_secoes;
create policy "membros veem" on public.manual_secoes for select using (e_membro(condominio_id));
create policy "gestao gerencia" on public.manual_secoes for all using (e_gestor(condominio_id)) with check (e_gestor(condominio_id));

create or replace function public.aplicar_manual_padrao(p_condominio uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not e_gestor(p_condominio) then raise exception 'Somente a gestão.'; end if;
  if exists (select 1 from manual_secoes where condominio_id = p_condominio) then return; end if;
  -- Modelos para a gestão revisar conforme a convenção e o regimento interno
  insert into manual_secoes (condominio_id, categoria, titulo, conteudo, ordem) values
    (p_condominio, 'boas_vindas', 'Seja bem-vindo(a)!', 'Que bom ter você aqui! Neste manual estão as principais regras e informações do condomínio. Em caso de dúvida, fale com a portaria ou com a gestão pelo app (Dia a dia → Registrar ocorrência).', 1),
    (p_condominio, 'regras', 'Horário de silêncio', '[Revise conforme o regimento] Das 22h às 8h, evite barulho, som alto e obras. Festas nas casas devem respeitar os vizinhos.', 2),
    (p_condominio, 'animais', 'Animais', '[Revise conforme o regimento] Mantenha seu animal dentro do seu lote e com identificação. Cadastre-o no app (Comunidade → Pets) para que os vizinhos saibam onde devolvê-lo. Recolha as fezes nas áreas comuns. Alimente animais apenas dentro do seu lote, para não atrair ratos e outras pragas.', 3),
    (p_condominio, 'obras', 'Obras e reformas', '[Revise conforme o regimento] Avise a gestão antes de começar (norma ABNT NBR 16.280). Horário permitido: dias úteis das 8h às 17h e sábados das 8h às 12h. Entulho deve ser retirado por caçamba, sem ocupar a via.', 4),
    (p_condominio, 'lixo', 'Lixo e recicláveis', 'Os dias e horários de coleta estão em Dia a dia → Coleta de lixo. Lá você pode ativar um lembrete na véspera.', 5),
    (p_condominio, 'areas_comuns', 'Áreas comuns', 'Reservas do salão e da churrasqueira pelo app (Dia a dia → Reservar espaço). Convidados devem ser anunciados na portaria.', 6),
    (p_condominio, 'servicos', 'Internet e serviços que atendem aqui', '[Preencha] Operadoras de internet que atendem o condomínio, entrega de gás, água mineral etc.', 7),
    (p_condominio, 'emergencia', 'Em caso de emergência', 'Ligue 192 (SAMU), 193 (Bombeiros) ou 190 (Polícia) e avise a portaria.\n[Preencha] Onde fica o desfibrilador (DEA) e o kit de primeiros socorros.\nFalta de energia: verifique em Dia a dia → “Está faltando…?” se outros vizinhos também estão sem luz.\nIncêndio no canavial/mato: afaste-se, feche janelas e avise a portaria.', 8);
end $$;

-- ---------------------------------------------------------------------
-- ASSEMBLEIAS: pauta com documentos, dúvidas antes da votação, presença e ata
-- (Votação oficial continua na assembleia; on-line só se a convenção permitir —
--  Código Civil, art. 1.354-A.)
-- ---------------------------------------------------------------------
create table if not exists public.assembleias (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios (id) on delete cascade,
  titulo text not null,
  tipo text not null default 'ordinaria' check (tipo in ('ordinaria', 'extraordinaria')),
  data timestamptz not null,
  local text,
  link_online text,
  status text not null default 'convocada' check (status in ('convocada', 'realizada', 'cancelada')),
  edital_path text,
  ata_path text,
  criado_em timestamptz not null default now()
);
create table if not exists public.assembleia_pauta (
  id uuid primary key default gen_random_uuid(),
  assembleia_id uuid not null references public.assembleias (id) on delete cascade,
  ordem int not null default 0,
  titulo text not null,
  descricao text,
  documento_path text,
  resultado text
);
create table if not exists public.assembleia_presencas (
  assembleia_id uuid not null references public.assembleias (id) on delete cascade,
  unidade_id uuid not null references public.unidades (id) on delete cascade,
  perfil_id uuid references public.perfis (id) on delete set null default auth.uid(),
  modo text not null default 'presencial' check (modo in ('presencial', 'online')),
  criado_em timestamptz not null default now(),
  primary key (assembleia_id, unidade_id)
);
create table if not exists public.assembleia_perguntas (
  id uuid primary key default gen_random_uuid(),
  pauta_id uuid not null references public.assembleia_pauta (id) on delete cascade,
  autor_id uuid references public.perfis (id) on delete set null default auth.uid(),
  texto text not null,
  resposta text,
  respondido_em timestamptz,
  criado_em timestamptz not null default now()
);

alter table public.assembleias enable row level security;
alter table public.assembleia_pauta enable row level security;
alter table public.assembleia_presencas enable row level security;
alter table public.assembleia_perguntas enable row level security;

drop policy if exists "membros veem" on public.assembleias;
drop policy if exists "gestao gerencia" on public.assembleias;
create policy "membros veem" on public.assembleias for select using (e_membro(condominio_id));
create policy "gestao gerencia" on public.assembleias for all using (e_gestor(condominio_id)) with check (e_gestor(condominio_id));
drop policy if exists "membros veem" on public.assembleia_pauta;
drop policy if exists "gestao gerencia" on public.assembleia_pauta;
create policy "membros veem" on public.assembleia_pauta for select using (exists (select 1 from assembleias a where a.id = assembleia_id));
create policy "gestao gerencia" on public.assembleia_pauta for all using (e_gestor((select condominio_id from assembleias where id = assembleia_id)))
  with check (e_gestor((select condominio_id from assembleias where id = assembleia_id)));
drop policy if exists "membros veem" on public.assembleia_presencas;
drop policy if exists "confirmo minha unidade" on public.assembleia_presencas;
drop policy if exists "altero minha unidade" on public.assembleia_presencas;
drop policy if exists "retiro minha unidade" on public.assembleia_presencas;
create policy "membros veem" on public.assembleia_presencas for select using (exists (select 1 from assembleias a where a.id = assembleia_id));
create policy "confirmo minha unidade" on public.assembleia_presencas for insert with check (unidade_id in (select minhas_unidades()) and exists (select 1 from assembleias a where a.id = assembleia_id));
create policy "altero minha unidade" on public.assembleia_presencas for update using (unidade_id in (select minhas_unidades()));
create policy "retiro minha unidade" on public.assembleia_presencas for delete using (unidade_id in (select minhas_unidades()));
drop policy if exists "membros veem" on public.assembleia_perguntas;
drop policy if exists "membro pergunta" on public.assembleia_perguntas;
drop policy if exists "gestao responde" on public.assembleia_perguntas;
create policy "membros veem" on public.assembleia_perguntas for select using (exists (select 1 from assembleia_pauta p where p.id = pauta_id));
create policy "membro pergunta" on public.assembleia_perguntas for insert with check (autor_id = auth.uid() and exists (select 1 from assembleia_pauta p where p.id = pauta_id));
create policy "gestao responde" on public.assembleia_perguntas for update using (
  e_gestor((select a.condominio_id from assembleia_pauta p join assembleias a on a.id = p.assembleia_id where p.id = pauta_id))
);

create or replace function public.perguntas_resposta()
returns trigger language plpgsql as $$
begin
  new.pauta_id := old.pauta_id; new.autor_id := old.autor_id; new.texto := old.texto;
  if new.resposta is distinct from old.resposta then new.respondido_em := now(); end if;
  return new;
end $$;
drop trigger if exists perguntas_resposta on public.assembleia_perguntas;
create trigger perguntas_resposta before update on public.assembleia_perguntas
  for each row execute function public.perguntas_resposta();

-- ---------------------------------------------------------------------
-- Ocorrências: hora da primeira resposta (plano: até 30 min, em média)
-- ---------------------------------------------------------------------
alter table public.chamados add column if not exists primeira_resposta_em timestamptz;

create or replace function public.chamados_atualizacao_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  c uuid;
begin
  select condominio_id into c from chamados where id = new.chamado_id;
  if e_gestor(c) then
    update chamados set primeira_resposta_em = coalesce(primeira_resposta_em, now()) where id = new.chamado_id;
  end if;
  if new.status_novo is not null then
    if not e_gestor(c) then
      new.status_novo := null;
    else
      update chamados set status = new.status_novo where id = new.chamado_id;
    end if;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Negócios de moradores: "Hoje tem…" (cardápio do dia, promoção)
-- ---------------------------------------------------------------------
alter table public.prestadores add column if not exists novidade text;
alter table public.prestadores add column if not exists novidade_em timestamptz;

-- ---------------------------------------------------------------------
-- Indicadores ampliados (todos agregados, sem dados pessoais)
-- ---------------------------------------------------------------------
alter table public.metas drop constraint if exists metas_indicador_check;
alter table public.metas add constraint metas_indicador_check check (indicador in (
  'inadimplencia', 'resposta_ocorrencias', 'manutencoes_em_dia', 'adesao',
  'primeira_resposta_min', 'disponibilidade_servicos', 'eventos_ano', 'participacao_assembleia', 'comissoes_ativas'
));

create or replace function public.indicadores(p_condominio uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  total_unid int;
  ultima uuid;
begin
  if not e_membro(p_condominio) then raise exception 'Sem acesso.'; end if;
  select count(*) into total_unid from unidades where condominio_id = p_condominio;
  select id into ultima from assembleias where condominio_id = p_condominio and status <> 'cancelada' and data <= now() + interval '60 days'
   order by data desc limit 1;
  return jsonb_build_object(
    'inadimplencia', case when total_unid = 0 then 0 else round(100.0 * (
        select count(distinct unidade_id) from cobrancas
         where condominio_id = p_condominio and status = 'aberta' and vencimento < current_date) / total_unid, 1) end,
    'resposta_ocorrencias', (
        select round(avg(extract(epoch from (resolvido_em - criado_em)) / 86400)::numeric, 1) from chamados
         where condominio_id = p_condominio and resolvido_em is not null and resolvido_em > now() - interval '90 days'),
    'primeira_resposta_min', (
        select round(avg(extract(epoch from (primeira_resposta_em - criado_em)) / 60)::numeric, 0) from chamados
         where condominio_id = p_condominio and primeira_resposta_em is not null and criado_em > now() - interval '90 days'),
    'manutencoes_em_dia', (
        select case when count(*) = 0 then null else round(100.0 * count(*) filter (where proxima is null or proxima >= current_date) / count(*), 1) end
          from manutencoes where condominio_id = p_condominio),
    'adesao', case when total_unid = 0 then 0 else round(100.0 * (
        select count(distinct unidade_id) from membros where condominio_id = p_condominio and ativo and unidade_id is not null) / total_unid, 1) end,
    -- Plano: % do tempo com serviços funcionando nos últimos 30 dias, sem contar falhas das concessionárias
    'disponibilidade_servicos', round(100 - 100.0 * coalesce((
        select sum(extract(epoch from (least(coalesce(fim, now()), now()) - greatest(inicio, now() - interval '30 days'))))
          from incidentes where condominio_id = p_condominio and origem = 'interna'
           and coalesce(fim, now()) > now() - interval '30 days'), 0) / (30 * 86400), 2),
    'eventos_ano', (select count(*) from eventos where condominio_id = p_condominio and not cancelado and tipo in ('festa', 'encontro', 'atividade')
                     and extract(year from inicio) = extract(year from now()) and inicio <= now()),
    'participacao_assembleia', case when total_unid = 0 or ultima is null then null else round(100.0 * (
        select count(*) from assembleia_presencas where assembleia_id = ultima) / total_unid, 1) end,
    'comissoes_ativas', (select count(*) from comissoes c where c.condominio_id = p_condominio and c.ativa
                          and exists (select 1 from comissoes_membros m where m.comissao_id = c.id)),
    'ocorrencias_abertas', (select count(*) from chamados where condominio_id = p_condominio and status in ('aberto', 'em_andamento')),
    'ocorrencias_resolvidas_90d', (select count(*) from chamados where condominio_id = p_condominio and resolvido_em > now() - interval '90 days')
  );
end $$;

-- ---------------------------------------------------------------------
-- Arquivos: gestão envia documentos de assembleia (pasta "assembleias")
-- (já coberto: gestão pode enviar em qualquer pasta do seu condomínio)
-- Retenção: relatos de falta de serviço saem após 1 ano
-- ---------------------------------------------------------------------
create or replace function public.limpar_dados_antigos()
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from encomendas where retirada_em < now() - interval '6 months';
  delete from portaria where criado_em < now() - interval '30 days';
  delete from ajuda_pedidos where status in ('concluido', 'cancelado') and atualizado_em < now() - interval '6 months';
  delete from achados where status = 'resolvido' and criado_em < now() - interval '6 months';
  delete from incidentes_relatos where criado_em < now() - interval '1 year';
  delete from avisos_leituras where lido_em < now() - interval '2 years';
  delete from dispositivos where atualizado_em < now() - interval '6 months';
  delete from tentativas_codigo where em < now() - interval '1 day';
  delete from classificados where not ativo and criado_em < now() - interval '1 year';
  delete from auditoria where criado_em < now() - interval '5 years';
end $$;
revoke execute on function public.limpar_dados_antigos() from public, anon, authenticated;

-- criar_condominio aceita o formato e já cria o manual
drop function if exists public.criar_condominio(text, text, text, text);
create or replace function public.criar_condominio(p_nome text, p_cidade text, p_uf text, p_contato_privacidade text default null, p_formato text default 'bloco_numero')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  c uuid;
begin
  if auth.uid() is null then raise exception 'Faça login primeiro.'; end if;
  if coalesce(trim(p_nome), '') = '' then raise exception 'Informe o nome do condomínio.'; end if;
  insert into condominios (nome, cidade, uf, contato_privacidade, formato_unidade)
  values (trim(p_nome), nullif(trim(p_cidade), ''), upper(nullif(trim(p_uf), '')), p_contato_privacidade, coalesce(p_formato, 'bloco_numero'))
  returning id into c;
  insert into membros (condominio_id, perfil_id, papel) values (c, auth.uid(), 'sindico');
  insert into contatos_uteis (condominio_id, nome, telefone, categoria, ordem) values
    (c, 'SAMU', '192', 'emergencia', 1),
    (c, 'Bombeiros', '193', 'emergencia', 2),
    (c, 'Polícia Militar', '190', 'emergencia', 3);
  perform aplicar_modelo_inicial(c);
  perform aplicar_contas_padrao(c);
  perform aplicar_acoes_padrao(c);
  perform aplicar_melhorias_padrao(c);
  perform aplicar_manual_padrao(c);
  return c;
end $$;
