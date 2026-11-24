-- =====================================================================
-- Vizinhar — convivência (pets, prestadores, negócios de moradores)
-- e calendário anual de ações planejadas
-- =====================================================================

-- ---------------------------------------------------------------------
-- PETS
-- ---------------------------------------------------------------------
create table if not exists public.pets (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios (id) on delete cascade,
  unidade_id uuid not null references public.unidades (id) on delete cascade,
  dono_id uuid references public.perfis (id) on delete set null default auth.uid(),
  nome text not null,
  especie text not null default 'cachorro' check (especie in ('cachorro', 'gato', 'ave', 'outro')),
  raca text,
  descricao text,          -- cor, porte, coleira, sinais
  cuidados text,           -- "tem medo de barulho", "não pegar no colo"
  foto_path text,
  -- A unidade aparece para os vizinhos (é o objetivo: saber onde devolver o pet).
  -- O app informa isso no cadastro; cadastrar é opcional.
  perdido boolean not null default false,
  perdido_desde timestamptz,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table if not exists public.pets_avistamentos (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets (id) on delete cascade,
  autor_id uuid references public.perfis (id) on delete set null default auth.uid(),
  local text,
  criado_em timestamptz not null default now()
);

alter table public.pets enable row level security;
alter table public.pets_avistamentos enable row level security;

drop policy if exists "membros veem" on public.pets;
drop policy if exists "cadastro o meu" on public.pets;
drop policy if exists "dono ou gestao altera" on public.pets;
drop policy if exists "dono ou gestao remove" on public.pets;
create policy "membros veem" on public.pets for select using (e_membro(condominio_id) and (ativo or unidade_id in (select minhas_unidades())));
create policy "cadastro o meu" on public.pets for insert with check (e_membro(condominio_id) and unidade_id in (select minhas_unidades()));
create policy "dono ou gestao altera" on public.pets for update using (unidade_id in (select minhas_unidades()) or e_gestor(condominio_id));
create policy "dono ou gestao remove" on public.pets for delete using (unidade_id in (select minhas_unidades()) or e_gestor(condominio_id));

drop policy if exists "membros veem" on public.pets_avistamentos;
drop policy if exists "membro avisa" on public.pets_avistamentos;
create policy "membros veem" on public.pets_avistamentos for select using (
  exists (select 1 from pets p where p.id = pet_id)  -- herda a RLS de pets
);
create policy "membro avisa" on public.pets_avistamentos for insert with check (
  autor_id = auth.uid() and exists (select 1 from pets p where p.id = pet_id)
);

-- Marca/desmarca "perdido" com a data
create or replace function public.pets_perdido()
returns trigger language plpgsql as $$
begin
  if new.perdido and not coalesce(old.perdido, false) then new.perdido_desde := now(); end if;
  if not new.perdido then new.perdido_desde := null; end if;
  return new;
end $$;
drop trigger if exists pets_perdido on public.pets;
create trigger pets_perdido before insert or update on public.pets
  for each row execute function public.pets_perdido();

-- ---------------------------------------------------------------------
-- PRESTADORES RECOMENDADOS e NEGÓCIOS DE MORADORES
-- ---------------------------------------------------------------------
create table if not exists public.prestadores (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios (id) on delete cascade,
  autor_id uuid references public.perfis (id) on delete set null default auth.uid(),
  -- 'indicado' = vizinho indica alguém de fora; 'morador' = o próprio morador divulga o seu negócio
  origem text not null default 'indicado' check (origem in ('indicado', 'morador')),
  tipo text not null,
  nome text not null,
  telefone text,
  descricao text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table if not exists public.prestadores_recomendacoes (
  prestador_id uuid not null references public.prestadores (id) on delete cascade,
  perfil_id uuid not null references public.perfis (id) on delete cascade default auth.uid(),
  comentario text,
  criado_em timestamptz not null default now(),
  primary key (prestador_id, perfil_id)
);

alter table public.prestadores enable row level security;
alter table public.prestadores_recomendacoes enable row level security;

drop policy if exists "membros veem" on public.prestadores;
drop policy if exists "membro cadastra" on public.prestadores;
drop policy if exists "autor ou gestao altera" on public.prestadores;
drop policy if exists "autor ou gestao remove" on public.prestadores;
create policy "membros veem" on public.prestadores for select using (e_membro(condominio_id) and (ativo or autor_id = auth.uid() or e_gestor(condominio_id)));
create policy "membro cadastra" on public.prestadores for insert with check (e_membro(condominio_id) and autor_id = auth.uid());
create policy "autor ou gestao altera" on public.prestadores for update using (autor_id = auth.uid() or e_gestor(condominio_id));
create policy "autor ou gestao remove" on public.prestadores for delete using (autor_id = auth.uid() or e_gestor(condominio_id));

drop policy if exists "membros veem" on public.prestadores_recomendacoes;
drop policy if exists "recomendo" on public.prestadores_recomendacoes;
drop policy if exists "retiro" on public.prestadores_recomendacoes;
create policy "membros veem" on public.prestadores_recomendacoes for select using (
  exists (select 1 from prestadores p where p.id = prestador_id)
);
create policy "recomendo" on public.prestadores_recomendacoes for insert with check (
  perfil_id = auth.uid() and exists (select 1 from prestadores p where p.id = prestador_id)
);
create policy "retiro" on public.prestadores_recomendacoes for delete using (perfil_id = auth.uid());

-- ---------------------------------------------------------------------
-- CALENDÁRIO ANUAL: ações planejadas (podas, limpezas sazonais, obras…)
-- ---------------------------------------------------------------------
create table if not exists public.acoes_planejadas (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios (id) on delete cascade,
  titulo text not null,
  descricao text,
  categoria text not null default 'manutencao' check (categoria in ('poda', 'manutencao', 'limpeza', 'obra', 'seguranca', 'administrativo', 'evento', 'outro')),
  mes int not null check (mes between 1 and 12),
  ano int,                       -- nulo quando se repete todo ano
  repete_anualmente boolean not null default true,
  responsavel text,
  custo_estimado numeric(12, 2),
  criado_em timestamptz not null default now()
);

-- Registro de execução por ano (uma ação anual é concluída a cada ano)
create table if not exists public.acoes_execucoes (
  acao_id uuid not null references public.acoes_planejadas (id) on delete cascade,
  ano int not null,
  status text not null default 'concluida' check (status in ('agendada', 'concluida', 'adiada', 'cancelada')),
  data date,
  observacao text,
  custo numeric(12, 2),
  autor_id uuid references public.perfis (id) on delete set null default auth.uid(),
  criado_em timestamptz not null default now(),
  primary key (acao_id, ano)
);

alter table public.acoes_planejadas enable row level security;
alter table public.acoes_execucoes enable row level security;

drop policy if exists "membros veem" on public.acoes_planejadas;
drop policy if exists "gestao gerencia" on public.acoes_planejadas;
create policy "membros veem" on public.acoes_planejadas for select using (e_membro(condominio_id));
create policy "gestao gerencia" on public.acoes_planejadas for all using (e_gestor(condominio_id)) with check (e_gestor(condominio_id));

drop policy if exists "membros veem" on public.acoes_execucoes;
drop policy if exists "gestao gerencia" on public.acoes_execucoes;
create policy "membros veem" on public.acoes_execucoes for select using (
  e_membro((select condominio_id from acoes_planejadas where id = acao_id))
);
create policy "gestao gerencia" on public.acoes_execucoes for all using (
  e_gestor((select condominio_id from acoes_planejadas where id = acao_id))
) with check (e_gestor((select condominio_id from acoes_planejadas where id = acao_id)));

-- Sugestões iniciais (tudo editável)
create or replace function public.aplicar_acoes_padrao(p_condominio uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not e_gestor(p_condominio) then raise exception 'Somente a gestão.'; end if;
  if exists (select 1 from acoes_planejadas where condominio_id = p_condominio) then return; end if;
  insert into acoes_planejadas (condominio_id, titulo, descricao, categoria, mes) values
    (p_condominio, 'Previsão orçamentária do ano', 'Montar o orçamento e a proposta de taxa para a assembleia.', 'administrativo', 1),
    (p_condominio, 'Assembleia geral ordinária', 'Prestação de contas do ano anterior e aprovação do orçamento.', 'administrativo', 3),
    (p_condominio, 'Poda anual das árvores', 'Fazer na época seca. Árvores maiores podem exigir autorização da prefeitura.', 'poda', 6),
    (p_condominio, 'Limpeza de calhas e revisão do telhado', 'Antes da temporada de chuvas.', 'limpeza', 9),
    (p_condominio, 'Revisão da iluminação e do quadro elétrico', 'Lâmpadas das áreas comuns, disjuntores e iluminação de emergência.', 'manutencao', 10),
    (p_condominio, 'Renovação do seguro do condomínio', 'Cotar ao menos três seguradoras antes do vencimento.', 'administrativo', 11),
    (p_condominio, 'Decoração e festa de fim de ano', 'Confraternização dos moradores.', 'evento', 12);
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
  return c;
end $$;

-- ---------------------------------------------------------------------
-- Arquivos: moradores também podem enviar fotos de pets
-- ---------------------------------------------------------------------
drop policy if exists "arquivos: enviar" on storage.objects;
create policy "arquivos: enviar" on storage.objects for insert to authenticated with check (
  bucket_id = 'arquivos' and e_membro(condominio_do_caminho(name)) and (
    split_part(name, '/', 2) in ('chamados', 'classificados', 'pets') or e_gestor(condominio_do_caminho(name))
  )
);

-- ---------------------------------------------------------------------
-- LGPD: exportação inclui pets e indicações
-- ---------------------------------------------------------------------
create or replace function public.meus_dados_extra()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'pets', (select coalesce(jsonb_agg(jsonb_build_object('nome', nome, 'especie', especie, 'raca', raca, 'descricao', descricao)), '[]')
               from pets where dono_id = auth.uid()),
    'prestadores_cadastrados', (select coalesce(jsonb_agg(jsonb_build_object('nome', nome, 'tipo', tipo, 'origem', origem, 'telefone', telefone)), '[]')
               from prestadores where autor_id = auth.uid()),
    'recomendacoes', (select coalesce(jsonb_agg(jsonb_build_object('comentario', comentario, 'criado_em', criado_em)), '[]')
               from prestadores_recomendacoes where perfil_id = auth.uid())
  );
$$;
