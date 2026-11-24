-- =====================================================================
-- Vizinhar — melhorias: vizinho solidário, achados e perdidos, histórico
-- de fugas de pets, equipamentos, coleta de lixo, metas e indicadores,
-- prioridades dos moradores e fotos de antes/depois
-- =====================================================================

-- ---------------------------------------------------------------------
-- COMUNIDADE: vizinho solidário
--   A unidade de quem pede ajuda NÃO fica visível a todos (proteção de
--   idosos que moram sozinhos). Só o voluntário que aceitou e a gestão a veem.
-- ---------------------------------------------------------------------
create table if not exists public.voluntarios (
  condominio_id uuid not null references public.condominios (id) on delete cascade,
  perfil_id uuid not null references public.perfis (id) on delete cascade default auth.uid(),
  habilidades text[] not null default '{}',
  disponibilidade text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  primary key (condominio_id, perfil_id)
);

create table if not exists public.ajuda_pedidos (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios (id) on delete cascade,
  unidade_id uuid not null references public.unidades (id) on delete cascade,
  autor_id uuid references public.perfis (id) on delete set null default auth.uid(),
  tipo text not null default 'outro' check (tipo in ('farmacia', 'mercado', 'reparo', 'tecnologia', 'companhia', 'transporte', 'outro')),
  descricao text,
  quando text,
  status text not null default 'aberto' check (status in ('aberto', 'combinado', 'concluido', 'cancelado')),
  voluntario_id uuid references public.perfis (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table public.voluntarios enable row level security;
alter table public.ajuda_pedidos enable row level security;

drop policy if exists "membros veem" on public.voluntarios;
drop policy if exists "eu me cadastro" on public.voluntarios;
drop policy if exists "eu altero" on public.voluntarios;
drop policy if exists "eu saio" on public.voluntarios;
create policy "membros veem" on public.voluntarios for select using (e_membro(condominio_id));
create policy "eu me cadastro" on public.voluntarios for insert with check (perfil_id = auth.uid() and e_membro(condominio_id));
create policy "eu altero" on public.voluntarios for update using (perfil_id = auth.uid());
create policy "eu saio" on public.voluntarios for delete using (perfil_id = auth.uid());

drop policy if exists "membros veem" on public.ajuda_pedidos;
drop policy if exists "peço para minha unidade" on public.ajuda_pedidos;
drop policy if exists "envolvidos alteram" on public.ajuda_pedidos;
create policy "membros veem" on public.ajuda_pedidos for select using (e_membro(condominio_id));
create policy "peço para minha unidade" on public.ajuda_pedidos for insert with check (
  autor_id = auth.uid() and unidade_id in (select minhas_unidades())
);
-- Autor, voluntário (para aceitar/concluir) ou gestão
create policy "envolvidos alteram" on public.ajuda_pedidos for update using (
  autor_id = auth.uid() or voluntario_id = auth.uid() or e_gestor(condominio_id)
  or (status = 'aberto' and exists (select 1 from voluntarios v where v.condominio_id = ajuda_pedidos.condominio_id and v.perfil_id = auth.uid() and v.ativo))
);

-- Esconde a unidade na leitura direta (permissão por coluna)
revoke select on public.ajuda_pedidos from anon, authenticated;
grant select (id, condominio_id, autor_id, tipo, descricao, quando, status, voluntario_id, criado_em, atualizado_em)
  on public.ajuda_pedidos to authenticated;

create or replace function public.ajuda_regras()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.condominio_id := old.condominio_id; new.unidade_id := old.unidade_id; new.autor_id := old.autor_id;
  new.atualizado_em := now();
  if new.status = 'combinado' and old.status = 'aberto' then
    if old.autor_id = auth.uid() or not exists (
      select 1 from voluntarios v where v.condominio_id = old.condominio_id and v.perfil_id = auth.uid() and v.ativo
    ) then
      raise exception 'Somente vizinhos voluntários podem aceitar um pedido.';
    end if;
    new.voluntario_id := auth.uid();        -- quem aceita é o voluntário
  elsif old.autor_id is distinct from auth.uid() and not e_gestor(old.condominio_id) then
    -- o voluntário só pode concluir ou desistir (volta para aberto)
    if old.voluntario_id is distinct from auth.uid() or new.status not in ('concluido', 'aberto') then
      raise exception 'Somente quem pediu ajuda pode alterar este pedido.';
    end if;
    if new.status = 'aberto' then new.voluntario_id := null; end if;
  end if;
  return new;
end $$;
drop trigger if exists ajuda_regras on public.ajuda_pedidos;
create trigger ajuda_regras before update on public.ajuda_pedidos
  for each row execute function public.ajuda_regras();

-- Contato entre as duas pontas, só depois do aceite
create or replace function public.contato_ajuda(p_pedido uuid)
returns table (unidade_pedido text, nome_pedido text, unidade_voluntario text, nome_voluntario text)
language plpgsql stable security definer set search_path = public as $$
declare
  p ajuda_pedidos;
begin
  select * into p from ajuda_pedidos where id = p_pedido;
  if p.id is null then return; end if;
  if not (p.autor_id = auth.uid() or p.voluntario_id = auth.uid() or e_gestor(p.condominio_id)) then return; end if;
  return query
    select nullif(concat_ws('-', nullif(u.bloco, ''), u.numero), ''), pa.nome,
           (select nullif(concat_ws('-', nullif(uv.bloco, ''), uv.numero), '') from membros mv join unidades uv on uv.id = mv.unidade_id
             where mv.perfil_id = p.voluntario_id and mv.condominio_id = p.condominio_id limit 1),
           (select nome from perfis where id = p.voluntario_id)
      from unidades u, perfis pa
     where u.id = p.unidade_id and pa.id = p.autor_id;
end $$;

-- ---------------------------------------------------------------------
-- COMUNIDADE: achados e perdidos
-- ---------------------------------------------------------------------
create table if not exists public.achados (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios (id) on delete cascade,
  autor_id uuid references public.perfis (id) on delete set null default auth.uid(),
  tipo text not null default 'achado' check (tipo in ('achado', 'perdido')),
  titulo text not null,
  descricao text,
  local text,
  onde_retirar text,
  foto_path text,
  status text not null default 'aberto' check (status in ('aberto', 'resolvido')),
  criado_em timestamptz not null default now()
);
alter table public.achados enable row level security;
drop policy if exists "membros veem" on public.achados;
drop policy if exists "membro publica" on public.achados;
drop policy if exists "autor ou gestao altera" on public.achados;
drop policy if exists "autor ou gestao remove" on public.achados;
create policy "membros veem" on public.achados for select using (e_membro(condominio_id));
create policy "membro publica" on public.achados for insert with check (e_membro(condominio_id) and autor_id = auth.uid());
create policy "autor ou gestao altera" on public.achados for update using (autor_id = auth.uid() or e_portaria(condominio_id));
create policy "autor ou gestao remove" on public.achados for delete using (autor_id = auth.uid() or e_portaria(condominio_id));

-- ---------------------------------------------------------------------
-- COMUNIDADE: histórico de fugas dos pets
-- ---------------------------------------------------------------------
create table if not exists public.pets_fugas (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets (id) on delete cascade,
  inicio timestamptz not null default now(),
  fim timestamptz,
  onde_encontrado text
);
alter table public.pets_fugas enable row level security;
drop policy if exists "membros veem" on public.pets_fugas;
drop policy if exists "dono registra local" on public.pets_fugas;
create policy "membros veem" on public.pets_fugas for select using (exists (select 1 from pets p where p.id = pet_id));
create policy "dono registra local" on public.pets_fugas for update using (
  exists (select 1 from pets p where p.id = pet_id and (p.unidade_id in (select minhas_unidades()) or e_gestor(p.condominio_id)))
);

create or replace function public.pets_perdido()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.perdido and not coalesce(old.perdido, false) then
    new.perdido_desde := now();
    if tg_op = 'UPDATE' then insert into pets_fugas (pet_id) values (new.id); end if;
  end if;
  if not new.perdido then
    new.perdido_desde := null;
    if tg_op = 'UPDATE' and old.perdido then
      update pets_fugas set fim = now() where pet_id = new.id and fim is null;
    end if;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- DIA A DIA: situação dos equipamentos
-- ---------------------------------------------------------------------
create table if not exists public.equipamentos (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios (id) on delete cascade,
  nome text not null,
  local text,
  status text not null default 'ok' check (status in ('ok', 'atencao', 'parado', 'manutencao')),
  observacao text,
  previsao text,                 -- "volta na sexta", "aguardando peça"
  ordem int not null default 0,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references public.perfis (id) on delete set null
);
alter table public.equipamentos enable row level security;
drop policy if exists "membros veem" on public.equipamentos;
drop policy if exists "portaria atualiza" on public.equipamentos;
drop policy if exists "gestao gerencia" on public.equipamentos;
drop policy if exists "gestao remove" on public.equipamentos;
create policy "membros veem" on public.equipamentos for select using (e_membro(condominio_id));
create policy "gestao gerencia" on public.equipamentos for insert with check (e_gestor(condominio_id));
create policy "portaria atualiza" on public.equipamentos for update using (e_portaria(condominio_id));
create policy "gestao remove" on public.equipamentos for delete using (e_gestor(condominio_id));

create or replace function public.equipamentos_carimbo()
returns trigger language plpgsql as $$
begin
  new.atualizado_em := now(); new.atualizado_por := auth.uid();
  if new.status = 'ok' then new.previsao := null; end if;
  return new;
end $$;
drop trigger if exists equipamentos_carimbo on public.equipamentos;
create trigger equipamentos_carimbo before update on public.equipamentos
  for each row execute function public.equipamentos_carimbo();

-- ---------------------------------------------------------------------
-- DIA A DIA: coleta de lixo
-- ---------------------------------------------------------------------
create table if not exists public.coletas (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios (id) on delete cascade,
  tipo text not null default 'comum' check (tipo in ('comum', 'reciclavel', 'organico', 'volumoso', 'eletronico', 'oleo', 'vidro')),
  dias int[] not null default '{1,3,5}',      -- 0 = domingo … 6 = sábado
  horario text,                                -- "colocar até as 19h"
  local text,                                  -- "contêineres da entrada"
  orientacao text,
  criado_em timestamptz not null default now()
);
alter table public.coletas enable row level security;
drop policy if exists "membros veem" on public.coletas;
drop policy if exists "gestao gerencia" on public.coletas;
create policy "membros veem" on public.coletas for select using (e_membro(condominio_id));
create policy "gestao gerencia" on public.coletas for all using (e_gestor(condominio_id)) with check (e_gestor(condominio_id));

-- ---------------------------------------------------------------------
-- DESENVOLVIMENTO: metas e indicadores
-- ---------------------------------------------------------------------
create table if not exists public.metas (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios (id) on delete cascade,
  dimensao dimensao_plano not null,
  titulo text not null,
  -- Indicador calculado automaticamente pelo app (ou nulo = medido à mão)
  indicador text check (indicador in ('inadimplencia', 'resposta_ocorrencias', 'manutencoes_em_dia', 'adesao')),
  unidade_medida text not null default '%',
  valor_meta numeric(14, 2) not null,
  sentido text not null default 'menor' check (sentido in ('menor', 'maior')),   -- menor é melhor?
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create table if not exists public.metas_medicoes (
  meta_id uuid not null references public.metas (id) on delete cascade,
  competencia date not null,
  valor numeric(14, 2) not null,
  primary key (meta_id, competencia)
);
alter table public.metas enable row level security;
alter table public.metas_medicoes enable row level security;
drop policy if exists "membros veem" on public.metas;
drop policy if exists "gestao gerencia" on public.metas;
create policy "membros veem" on public.metas for select using (e_membro(condominio_id));
create policy "gestao gerencia" on public.metas for all using (e_gestor(condominio_id)) with check (e_gestor(condominio_id));
drop policy if exists "membros veem" on public.metas_medicoes;
drop policy if exists "gestao gerencia" on public.metas_medicoes;
create policy "membros veem" on public.metas_medicoes for select using (e_membro((select condominio_id from metas where id = meta_id)));
create policy "gestao gerencia" on public.metas_medicoes for all using (e_gestor((select condominio_id from metas where id = meta_id)))
  with check (e_gestor((select condominio_id from metas where id = meta_id)));

-- Indicadores agregados (sem dados pessoais), para todos os moradores
create or replace function public.indicadores(p_condominio uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  total_unid int;
begin
  if not e_membro(p_condominio) then raise exception 'Sem acesso.'; end if;
  select count(*) into total_unid from unidades where condominio_id = p_condominio;
  return jsonb_build_object(
    'inadimplencia', case when total_unid = 0 then 0 else round(100.0 * (
        select count(distinct unidade_id) from cobrancas
         where condominio_id = p_condominio and status = 'aberta' and vencimento < current_date) / total_unid, 1) end,
    'resposta_ocorrencias', (
        select round(avg(extract(epoch from (resolvido_em - criado_em)) / 86400)::numeric, 1) from chamados
         where condominio_id = p_condominio and resolvido_em is not null and resolvido_em > now() - interval '90 days'),
    'manutencoes_em_dia', (
        select case when count(*) = 0 then null else round(100.0 * count(*) filter (where proxima is null or proxima >= current_date) / count(*), 1) end
          from manutencoes where condominio_id = p_condominio),
    'adesao', case when total_unid = 0 then 0 else round(100.0 * (
        select count(distinct unidade_id) from membros where condominio_id = p_condominio and ativo and unidade_id is not null) / total_unid, 1) end,
    'ocorrencias_abertas', (select count(*) from chamados where condominio_id = p_condominio and status in ('aberto', 'em_andamento')),
    'ocorrencias_resolvidas_90d', (select count(*) from chamados where condominio_id = p_condominio and resolvido_em > now() - interval '90 days')
  );
end $$;

-- ---------------------------------------------------------------------
-- DESENVOLVIMENTO: moradores priorizam projetos (até 3 por unidade)
-- ---------------------------------------------------------------------
create table if not exists public.projetos_prioridades (
  projeto_id uuid not null references public.projetos (id) on delete cascade,
  unidade_id uuid not null references public.unidades (id) on delete cascade,
  perfil_id uuid references public.perfis (id) on delete set null default auth.uid(),
  criado_em timestamptz not null default now(),
  primary key (projeto_id, unidade_id)
);
alter table public.projetos_prioridades enable row level security;
-- Leitura direta só da própria unidade; os totais saem pela função abaixo
drop policy if exists "minha unidade" on public.projetos_prioridades;
drop policy if exists "priorizo pela minha unidade" on public.projetos_prioridades;
drop policy if exists "retiro" on public.projetos_prioridades;
create policy "minha unidade" on public.projetos_prioridades for select using (unidade_id in (select minhas_unidades()));
create policy "priorizo pela minha unidade" on public.projetos_prioridades for insert with check (
  unidade_id in (select minhas_unidades()) and exists (select 1 from projetos p where p.id = projeto_id)
);
create policy "retiro" on public.projetos_prioridades for delete using (unidade_id in (select minhas_unidades()));

create or replace function public.prioridades_limite()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from projetos_prioridades pp join projetos p on p.id = pp.projeto_id
       where pp.unidade_id = new.unidade_id
         and p.condominio_id = (select condominio_id from projetos where id = new.projeto_id)) >= 3 then
    raise exception 'Cada unidade pode escolher até 3 prioridades. Retire uma para escolher outra.';
  end if;
  return new;
end $$;
drop trigger if exists prioridades_limite on public.projetos_prioridades;
create trigger prioridades_limite before insert on public.projetos_prioridades
  for each row execute function public.prioridades_limite();

create or replace function public.ranking_prioridades(p_condominio uuid)
returns table (projeto_id uuid, votos bigint, minha boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not e_membro(p_condominio) then raise exception 'Sem acesso.'; end if;
  return query
    select p.id, count(pp.unidade_id), bool_or(pp.unidade_id in (select minhas_unidades()))
      from projetos p left join projetos_prioridades pp on pp.projeto_id = p.id
     where p.condominio_id = p_condominio and (p.publico or e_conselho(p_condominio))
     group by p.id;
end $$;

-- ---------------------------------------------------------------------
-- DESENVOLVIMENTO: antes e depois
-- ---------------------------------------------------------------------
alter table public.projetos add column if not exists foto_antes text;
alter table public.projetos add column if not exists foto_depois text;
alter table public.projetos add column if not exists concluido_em date;

create or replace function public.projetos_atualizado()
returns trigger language plpgsql as $$
begin
  new.atualizado_em := now();
  if new.status = 'concluido' then
    new.progresso := 100;
    if old.status is distinct from 'concluido' and new.concluido_em is null then new.concluido_em := current_date; end if;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Modelos iniciais (equipamentos, coleta, metas)
-- ---------------------------------------------------------------------
create or replace function public.aplicar_melhorias_padrao(p_condominio uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not e_gestor(p_condominio) then raise exception 'Somente a gestão.'; end if;
  if not exists (select 1 from equipamentos where condominio_id = p_condominio) then
    insert into equipamentos (condominio_id, nome, local, ordem) values
      (p_condominio, 'Portão de veículos', 'Entrada', 1),
      (p_condominio, 'Portão de pedestres', 'Entrada', 2),
      (p_condominio, 'Interfone', 'Portaria', 3),
      (p_condominio, 'Bomba d''água', 'Casa de máquinas', 4),
      (p_condominio, 'Iluminação das áreas comuns', null, 5),
      (p_condominio, 'Câmeras', null, 6),
      (p_condominio, 'Piscina', 'Área de lazer', 7),
      (p_condominio, 'Salão de festas', 'Área de lazer', 8);
  end if;
  if not exists (select 1 from coletas where condominio_id = p_condominio) then
    insert into coletas (condominio_id, tipo, dias, horario, local, orientacao) values
      (p_condominio, 'comum', '{1,3,5}', 'Colocar até as 19h', 'Contêineres da entrada', 'Sacos bem fechados.'),
      (p_condominio, 'reciclavel', '{4}', 'Colocar até as 19h', 'Contêineres azuis', 'Papel, plástico, metal e vidro limpos e secos.');
  end if;
  if not exists (select 1 from metas where condominio_id = p_condominio) then
    insert into metas (condominio_id, dimensao, titulo, indicador, unidade_medida, valor_meta, sentido) values
      (p_condominio, 'financeira', 'Inadimplência abaixo de 5%', 'inadimplencia', '%', 5, 'menor'),
      (p_condominio, 'operacional', 'Resolver ocorrências em até 5 dias', 'resposta_ocorrencias', 'dias', 5, 'menor'),
      (p_condominio, 'operacional', 'Manutenções preventivas em dia', 'manutencoes_em_dia', '%', 100, 'maior'),
      (p_condominio, 'comunidade', 'Unidades usando o app', 'adesao', '%', 80, 'maior');
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
  perform aplicar_acoes_padrao(c);
  perform aplicar_melhorias_padrao(c);
  return c;
end $$;

-- ---------------------------------------------------------------------
-- Arquivos: moradores enviam fotos de achados; gestão envia "melhorias"
-- ---------------------------------------------------------------------
drop policy if exists "arquivos: enviar" on storage.objects;
create policy "arquivos: enviar" on storage.objects for insert to authenticated with check (
  bucket_id = 'arquivos' and e_membro(condominio_do_caminho(name)) and (
    split_part(name, '/', 2) in ('chamados', 'classificados', 'pets', 'achados') or e_gestor(condominio_do_caminho(name))
  )
);

-- Retenção: achados resolvidos e pedidos de ajuda concluídos saem após 6 meses
create or replace function public.limpar_dados_antigos()
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from encomendas where retirada_em < now() - interval '6 months';
  delete from portaria where criado_em < now() - interval '30 days';
  delete from ajuda_pedidos where status in ('concluido', 'cancelado') and atualizado_em < now() - interval '6 months';
  delete from achados where status = 'resolvido' and criado_em < now() - interval '6 months';
  delete from avisos_leituras where lido_em < now() - interval '2 years';
  delete from dispositivos where atualizado_em < now() - interval '6 months';
  delete from tentativas_codigo where em < now() - interval '1 day';
  delete from classificados where not ativo and criado_em < now() - interval '1 year';
  delete from auditoria where criado_em < now() - interval '5 years';
end $$;
revoke execute on function public.limpar_dados_antigos() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Relatório de gestão: totais de um período (sem dados pessoais)
-- ---------------------------------------------------------------------
create or replace function public.resumo_periodo(p_condominio uuid, p_de date, p_ate date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not e_membro(p_condominio) then raise exception 'Sem acesso.'; end if;
  return jsonb_build_object(
    'ocorrencias_registradas', (select count(*) from chamados where condominio_id = p_condominio and criado_em::date between p_de and p_ate),
    'ocorrencias_resolvidas', (select count(*) from chamados where condominio_id = p_condominio and resolvido_em::date between p_de and p_ate),
    'tempo_medio_dias', (select round(avg(extract(epoch from (resolvido_em - criado_em)) / 86400)::numeric, 1) from chamados
                          where condominio_id = p_condominio and resolvido_em::date between p_de and p_ate),
    'ocorrencias_por_tipo', (select coalesce(jsonb_object_agg(categoria, n), '{}') from (
                          select categoria, count(*) n from chamados where condominio_id = p_condominio and criado_em::date between p_de and p_ate group by categoria) x),
    'manutencoes', (select coalesce(jsonb_agg(jsonb_build_object('item', m.item, 'data', r.realizada_em, 'custo', r.custo) order by r.realizada_em), '[]')
                      from manutencoes_registros r join manutencoes m on m.id = r.manutencao_id
                     where m.condominio_id = p_condominio and r.realizada_em between p_de and p_ate),
    'acoes_concluidas', (select coalesce(jsonb_agg(a.titulo), '[]') from acoes_execucoes e join acoes_planejadas a on a.id = e.acao_id
                          where a.condominio_id = p_condominio and e.status = 'concluida' and e.data between p_de and p_ate),
    'avisos', (select count(*) from avisos where condominio_id = p_condominio and publicado_em::date between p_de and p_ate),
    'reservas', (select count(*) from reservas where condominio_id = p_condominio and data between p_de and p_ate and status = 'confirmada'),
    'encomendas', (select count(*) from encomendas where condominio_id = p_condominio and recebida_em::date between p_de and p_ate),
    'enquetes', (select count(*) from enquetes where condominio_id = p_condominio and criado_em::date between p_de and p_ate),
    'sugestoes', (select count(*) from sugestoes where condominio_id = p_condominio and criado_em::date between p_de and p_ate),
    'ajudas_concluidas', (select count(*) from ajuda_pedidos where condominio_id = p_condominio and status = 'concluido' and atualizado_em::date between p_de and p_ate)
  );
end $$;
