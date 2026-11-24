-- =====================================================================
-- Vizinhar — regras de acesso (RLS), funções e gatilhos
-- Princípio: cada pessoa vê só o necessário (LGPD art. 6º, III — necessidade).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Funções auxiliares (SECURITY DEFINER evita recursão nas políticas)
-- ---------------------------------------------------------------------
create or replace function public.e_membro(c uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from membros where condominio_id = c and perfil_id = auth.uid() and ativo);
$$;

create or replace function public.e_gestor(c uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from membros
    where condominio_id = c and perfil_id = auth.uid() and ativo
      and papel in ('sindico', 'subsindico', 'administracao')
  );
$$;

-- Gestão + conselho fiscal/consultivo
create or replace function public.e_conselho(c uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from membros
    where condominio_id = c and perfil_id = auth.uid() and ativo
      and papel in ('sindico', 'subsindico', 'administracao', 'conselheiro')
  );
$$;

-- Gestão + portaria (registro de encomendas)
create or replace function public.e_portaria(c uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from membros
    where condominio_id = c and perfil_id = auth.uid() and ativo
      and papel in ('sindico', 'subsindico', 'administracao', 'portaria')
  );
$$;

create or replace function public.minhas_unidades()
returns setof uuid language sql stable security definer set search_path = public as $$
  select unidade_id from membros where perfil_id = auth.uid() and ativo and unidade_id is not null;
$$;

create or replace function public.compartilha_condominio(p uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from membros a join membros b on a.condominio_id = b.condominio_id
    where a.perfil_id = auth.uid() and a.ativo and b.perfil_id = p
  );
$$;

-- Extrai o condomínio do caminho de um arquivo: "<condominio_id>/<pasta>/<arquivo>"
create or replace function public.condominio_do_caminho(caminho text)
returns uuid language plpgsql immutable as $$
begin
  return split_part(caminho, '/', 1)::uuid;
exception when others then
  return null;
end $$;

-- ---------------------------------------------------------------------
-- Cadastro automático do perfil
-- ---------------------------------------------------------------------
create or replace function public.ao_criar_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into perfis (id, nome)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome'), ''), ''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario after insert on auth.users
  for each row execute function public.ao_criar_usuario();

-- ---------------------------------------------------------------------
-- Auditoria (quem mudou o quê) — finanças, cadastro e documentos
-- ---------------------------------------------------------------------
create or replace function public.auditar()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  linha jsonb;
begin
  linha := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  insert into auditoria (condominio_id, ator_id, acao, tabela, registro_id, detalhes)
  values (
    (linha ->> 'condominio_id')::uuid,
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    linha ->> 'id',
    case when tg_op = 'UPDATE' then jsonb_build_object('antes', to_jsonb(old), 'depois', to_jsonb(new)) else linha end
  );
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['lancamentos', 'cobrancas', 'membros', 'documentos', 'orcamento'] loop
    execute format('drop trigger if exists auditar on public.%I', t);
    execute format('create trigger auditar after insert or update or delete on public.%I for each row execute function public.auditar()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Gatilhos de integridade
-- ---------------------------------------------------------------------

-- Morador só pode mudar o próprio telefone/vínculo; papel e unidade são da gestão.
create or replace function public.membros_protecao()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Funções internas (ex.: entrar_com_codigo) liberam a troca de unidade.
  if current_setting('vizinhar.liberar_membro', true) = 'sim' then
    return new;
  end if;
  if not e_gestor(old.condominio_id) then
    if new.papel <> old.papel or new.condominio_id <> old.condominio_id
       or new.unidade_id is distinct from old.unidade_id or new.ativo <> old.ativo
       or new.perfil_id <> old.perfil_id then
      raise exception 'Somente a gestão pode alterar papel ou unidade.';
    end if;
  elsif new.papel = 'sindico' and old.papel <> 'sindico' and not exists (
    select 1 from membros where condominio_id = old.condominio_id and perfil_id = auth.uid() and papel = 'sindico'
  ) then
    raise exception 'Somente o(a) síndico(a) pode nomear outro(a) síndico(a).';
  end if;
  return new;
end $$;
drop trigger if exists membros_protecao on public.membros;
create trigger membros_protecao before update on public.membros
  for each row execute function public.membros_protecao();

create or replace function public.chamados_protecao()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not e_gestor(old.condominio_id) then
    if old.status <> 'aberto' or new.status not in ('aberto', 'cancelado') then
      raise exception 'Este chamado já está com a gestão e não pode mais ser alterado.';
    end if;
    new.condominio_id := old.condominio_id;
    new.autor_id := old.autor_id;
    new.unidade_id := old.unidade_id;
  end if;
  new.atualizado_em := now();
  if new.status = 'resolvido' and old.status <> 'resolvido' then
    new.resolvido_em := now();
  end if;
  return new;
end $$;
drop trigger if exists chamados_protecao on public.chamados;
create trigger chamados_protecao before update on public.chamados
  for each row execute function public.chamados_protecao();

-- Comentário com mudança de status: só a gestão muda; o chamado é atualizado junto.
create or replace function public.chamados_atualizacao_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  c uuid;
begin
  select condominio_id into c from chamados where id = new.chamado_id;
  if new.status_novo is not null then
    if not e_gestor(c) then
      new.status_novo := null;
    else
      update chamados set status = new.status_novo where id = new.chamado_id;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists chamados_atualizacao_status on public.chamados_atualizacoes;
create trigger chamados_atualizacao_status before insert on public.chamados_atualizacoes
  for each row execute function public.chamados_atualizacao_status();

create or replace function public.reservas_regras()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  a areas_comuns;
begin
  if tg_op = 'INSERT' then
    select * into a from areas_comuns where id = new.area_id;
    if a.id is null or not a.ativa or a.condominio_id <> new.condominio_id then
      raise exception 'Área indisponível.';
    end if;
    if new.data < current_date then
      raise exception 'Escolha uma data a partir de hoje.';
    end if;
    new.perfil_id := auth.uid();
    if not e_gestor(new.condominio_id) then
      new.status := case when a.exige_aprovacao then 'pendente' else 'confirmada' end;
    end if;
  elsif not e_gestor(old.condominio_id) then
    if new.status <> 'cancelada' then
      raise exception 'Você pode apenas cancelar a sua reserva.';
    end if;
    new.data := old.data; new.periodo := old.periodo; new.area_id := old.area_id; new.unidade_id := old.unidade_id;
  end if;
  return new;
end $$;
drop trigger if exists reservas_regras on public.reservas;
create trigger reservas_regras before insert or update on public.reservas
  for each row execute function public.reservas_regras();

create or replace function public.encomendas_protecao()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not e_portaria(old.condominio_id) then
    new.descricao := old.descricao; new.unidade_id := old.unidade_id;
    new.recebida_em := old.recebida_em; new.registrada_por := old.registrada_por;
  end if;
  return new;
end $$;
drop trigger if exists encomendas_protecao on public.encomendas;
create trigger encomendas_protecao before update on public.encomendas
  for each row execute function public.encomendas_protecao();

create or replace function public.sugestoes_protecao()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not e_gestor(old.condominio_id) then
    new.status := old.status; new.resposta := old.resposta;
  end if;
  return new;
end $$;
drop trigger if exists sugestoes_protecao on public.sugestoes;
create trigger sugestoes_protecao before update on public.sugestoes
  for each row execute function public.sugestoes_protecao();

create or replace function public.projetos_atualizado()
returns trigger language plpgsql as $$
begin
  new.atualizado_em := now();
  if new.status = 'concluido' then new.progresso := 100; end if;
  return new;
end $$;
drop trigger if exists projetos_atualizado on public.projetos;
create trigger projetos_atualizado before update on public.projetos
  for each row execute function public.projetos_atualizado();

-- Ao registrar uma manutenção feita, calcula a próxima data.
create or replace function public.manutencao_realizada()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update manutencoes
     set ultima_realizacao = new.realizada_em,
         proxima = (new.realizada_em + make_interval(months => periodicidade_meses))::date
   where id = new.manutencao_id
     and (ultima_realizacao is null or ultima_realizacao <= new.realizada_em);
  return new;
end $$;
drop trigger if exists manutencao_realizada on public.manutencoes_registros;
create trigger manutencao_realizada after insert on public.manutencoes_registros
  for each row execute function public.manutencao_realizada();

-- ---------------------------------------------------------------------
-- Autor = quem está logado (padrão)
-- ---------------------------------------------------------------------
alter table public.avisos alter column autor_id set default auth.uid();
alter table public.enquetes alter column autor_id set default auth.uid();
alter table public.classificados alter column autor_id set default auth.uid();
alter table public.chamados alter column autor_id set default auth.uid();
alter table public.chamados_atualizacoes alter column autor_id set default auth.uid();
alter table public.encomendas alter column registrada_por set default auth.uid();
alter table public.manutencoes_registros alter column autor_id set default auth.uid();
alter table public.documentos alter column autor_id set default auth.uid();
alter table public.lancamentos alter column autor_id set default auth.uid();
alter table public.projetos_atualizacoes alter column autor_id set default auth.uid();
alter table public.sugestoes alter column autor_id set default auth.uid();
alter table public.avisos_leituras alter column perfil_id set default auth.uid();
alter table public.sugestoes_apoios alter column perfil_id set default auth.uid();
alter table public.consentimentos alter column perfil_id set default auth.uid();
alter table public.solicitacoes_titular alter column perfil_id set default auth.uid();
alter table public.dispositivos alter column perfil_id set default auth.uid();

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'condominios', 'unidades', 'perfis', 'membros', 'consentimentos', 'solicitacoes_titular', 'auditoria',
    'avisos', 'avisos_leituras', 'enquetes', 'enquete_opcoes', 'votos', 'classificados', 'contatos_uteis',
    'chamados', 'chamados_atualizacoes', 'areas_comuns', 'reservas', 'encomendas', 'manutencoes',
    'manutencoes_registros', 'documentos', 'fornecedores', 'lancamentos', 'orcamento', 'cobrancas',
    'projetos', 'projetos_atualizacoes', 'sugestoes', 'sugestoes_apoios', 'dispositivos'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Remove políticas antigas para o arquivo poder ser rodado de novo
do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- Condomínio
create policy "membros veem" on condominios for select using (e_membro(id));
create policy "gestao edita" on condominios for update using (e_gestor(id));

-- Unidades: o código de acesso fica oculto (permissão por coluna, abaixo)
create policy "membros veem" on unidades for select using (e_membro(condominio_id));
create policy "gestao cria" on unidades for insert with check (e_gestor(condominio_id));
create policy "gestao edita" on unidades for update using (e_gestor(condominio_id));
create policy "gestao remove" on unidades for delete using (e_gestor(condominio_id));
revoke select on public.unidades from anon, authenticated;
grant select (id, condominio_id, bloco, numero, criado_em) on public.unidades to authenticated;

-- Perfis: só o nome, e só para quem divide o condomínio
create policy "eu e vizinhos" on perfis for select using (id = auth.uid() or compartilha_condominio(id));
create policy "edito o meu" on perfis for update using (id = auth.uid());

-- Membros: cada um vê o próprio vínculo; a gestão vê todos (inclui telefone)
create policy "eu ou gestao" on membros for select using (perfil_id = auth.uid() or e_gestor(condominio_id));
create policy "eu ou gestao edita" on membros for update using (perfil_id = auth.uid() or e_gestor(condominio_id));
create policy "saio ou gestao remove" on membros for delete using (perfil_id = auth.uid() or e_gestor(condominio_id));

-- LGPD
create policy "meus" on consentimentos for select using (perfil_id = auth.uid());
create policy "registro os meus" on consentimentos for insert with check (perfil_id = auth.uid());
create policy "meus ou gestao" on solicitacoes_titular for select using (
  perfil_id = auth.uid()
  or exists (select 1 from membros m where m.perfil_id = solicitacoes_titular.perfil_id and e_gestor(m.condominio_id))
);
create policy "faco os meus" on solicitacoes_titular for insert with check (perfil_id = auth.uid());
create policy "gestao atualiza" on solicitacoes_titular for update using (
  exists (select 1 from membros m where m.perfil_id = solicitacoes_titular.perfil_id and e_gestor(m.condominio_id))
);
create policy "conselho ve" on auditoria for select using (e_conselho(condominio_id));

-- Avisos
create policy "membros veem" on avisos for select using (e_membro(condominio_id));
create policy "gestao publica" on avisos for insert with check (e_gestor(condominio_id) and autor_id = auth.uid());
create policy "gestao edita" on avisos for update using (e_gestor(condominio_id));
create policy "gestao remove" on avisos for delete using (e_gestor(condominio_id));

create policy "minhas ou gestao" on avisos_leituras for select using (
  perfil_id = auth.uid() or e_gestor((select condominio_id from avisos where id = aviso_id))
);
create policy "marco a minha" on avisos_leituras for insert with check (
  perfil_id = auth.uid() and e_membro((select condominio_id from avisos where id = aviso_id))
);

-- Enquetes (votos só por função)
create policy "membros veem" on enquetes for select using (e_membro(condominio_id));
create policy "gestao cria" on enquetes for insert with check (e_gestor(condominio_id));
create policy "gestao edita" on enquetes for update using (e_gestor(condominio_id));
create policy "gestao remove" on enquetes for delete using (e_gestor(condominio_id));
create policy "membros veem" on enquete_opcoes for select using (
  e_membro((select condominio_id from enquetes where id = enquete_id))
);
create policy "gestao gerencia" on enquete_opcoes for all using (
  e_gestor((select condominio_id from enquetes where id = enquete_id))
) with check (e_gestor((select condominio_id from enquetes where id = enquete_id)));

-- Classificados
create policy "membros veem" on classificados for select using (
  e_membro(condominio_id) and (ativo or autor_id = auth.uid() or e_gestor(condominio_id))
);
create policy "membro anuncia" on classificados for insert with check (e_membro(condominio_id) and autor_id = auth.uid());
create policy "autor ou gestao edita" on classificados for update using (autor_id = auth.uid() or e_gestor(condominio_id));
create policy "autor ou gestao remove" on classificados for delete using (autor_id = auth.uid() or e_gestor(condominio_id));

-- Contatos úteis
create policy "membros veem" on contatos_uteis for select using (e_membro(condominio_id));
create policy "gestao gerencia" on contatos_uteis for all using (e_gestor(condominio_id)) with check (e_gestor(condominio_id));

-- Chamados: privados da unidade (ex.: reclamação de barulho) + gestão
create policy "minha unidade ou gestao" on chamados for select using (
  e_gestor(condominio_id) or autor_id = auth.uid() or unidade_id in (select minhas_unidades())
);
create policy "membro abre" on chamados for insert with check (
  e_membro(condominio_id) and autor_id = auth.uid()
  and (unidade_id is null or unidade_id in (select minhas_unidades()) or e_gestor(condominio_id))
);
create policy "autor ou gestao edita" on chamados for update using (autor_id = auth.uid() or e_gestor(condominio_id));

create policy "quem ve o chamado" on chamados_atualizacoes for select using (
  exists (select 1 from chamados c where c.id = chamado_id)  -- herda a RLS de chamados
);
create policy "quem ve o chamado comenta" on chamados_atualizacoes for insert with check (
  autor_id = auth.uid() and exists (select 1 from chamados c where c.id = chamado_id)
);

-- Áreas comuns e reservas (datas ocupadas saem por função, sem expor a unidade)
create policy "membros veem" on areas_comuns for select using (e_membro(condominio_id));
create policy "gestao gerencia" on areas_comuns for all using (e_gestor(condominio_id)) with check (e_gestor(condominio_id));

create policy "minha unidade ou gestao" on reservas for select using (
  e_gestor(condominio_id) or unidade_id in (select minhas_unidades())
);
create policy "reservo para minha unidade" on reservas for insert with check (
  e_membro(condominio_id) and (unidade_id in (select minhas_unidades()) or e_gestor(condominio_id))
);
create policy "minha unidade ou gestao altera" on reservas for update using (
  e_gestor(condominio_id) or unidade_id in (select minhas_unidades())
);

-- Encomendas
create policy "minha unidade ou portaria" on encomendas for select using (
  e_portaria(condominio_id) or unidade_id in (select minhas_unidades())
);
create policy "portaria registra" on encomendas for insert with check (e_portaria(condominio_id));
create policy "unidade ou portaria atualiza" on encomendas for update using (
  e_portaria(condominio_id) or unidade_id in (select minhas_unidades())
);
create policy "portaria remove" on encomendas for delete using (e_portaria(condominio_id));

-- Manutenções
create policy "membros veem" on manutencoes for select using (e_membro(condominio_id));
create policy "gestao gerencia" on manutencoes for all using (e_gestor(condominio_id)) with check (e_gestor(condominio_id));
create policy "membros veem" on manutencoes_registros for select using (
  e_membro((select condominio_id from manutencoes where id = manutencao_id))
);
create policy "gestao registra" on manutencoes_registros for all using (
  e_gestor((select condominio_id from manutencoes where id = manutencao_id))
) with check (e_gestor((select condominio_id from manutencoes where id = manutencao_id)));

-- Documentos
create policy "membros veem publicos" on documentos for select using (
  e_membro(condominio_id) and (publico or e_conselho(condominio_id))
);
create policy "gestao gerencia" on documentos for all using (e_gestor(condominio_id)) with check (e_gestor(condominio_id));

-- Fornecedores
create policy "conselho ve" on fornecedores for select using (e_conselho(condominio_id));
create policy "gestao gerencia" on fornecedores for all using (e_gestor(condominio_id)) with check (e_gestor(condominio_id));

-- Finanças: prestação de contas aberta a todos os condôminos (Código Civil, art. 1.348, VIII)
create policy "membros veem" on lancamentos for select using (e_membro(condominio_id));
create policy "gestao gerencia" on lancamentos for all using (e_gestor(condominio_id)) with check (e_gestor(condominio_id));
create policy "membros veem" on orcamento for select using (e_membro(condominio_id));
create policy "gestao gerencia" on orcamento for all using (e_gestor(condominio_id)) with check (e_gestor(condominio_id));
create policy "minha unidade ou gestao" on cobrancas for select using (
  e_gestor(condominio_id) or unidade_id in (select minhas_unidades())
);
create policy "gestao gerencia" on cobrancas for all using (e_gestor(condominio_id)) with check (e_gestor(condominio_id));

-- Plano de gestão
create policy "membros veem" on projetos for select using (
  e_membro(condominio_id) and (publico or e_conselho(condominio_id))
);
create policy "gestao gerencia" on projetos for all using (e_gestor(condominio_id)) with check (e_gestor(condominio_id));
create policy "quem ve o projeto" on projetos_atualizacoes for select using (
  exists (select 1 from projetos p where p.id = projeto_id)
);
create policy "gestao registra" on projetos_atualizacoes for insert with check (
  autor_id = auth.uid() and e_gestor((select condominio_id from projetos where id = projeto_id))
);
create policy "gestao remove" on projetos_atualizacoes for delete using (
  e_gestor((select condominio_id from projetos where id = projeto_id))
);

-- Sugestões
create policy "membros veem" on sugestoes for select using (e_membro(condominio_id));
create policy "membro sugere" on sugestoes for insert with check (e_membro(condominio_id) and autor_id = auth.uid());
create policy "autor ou gestao edita" on sugestoes for update using (autor_id = auth.uid() or e_gestor(condominio_id));
create policy "autor ou gestao remove" on sugestoes for delete using (autor_id = auth.uid() or e_gestor(condominio_id));
create policy "membros veem" on sugestoes_apoios for select using (
  e_membro((select condominio_id from sugestoes where id = sugestao_id))
);
create policy "apoio" on sugestoes_apoios for insert with check (
  perfil_id = auth.uid() and e_membro((select condominio_id from sugestoes where id = sugestao_id))
);
create policy "retiro apoio" on sugestoes_apoios for delete using (perfil_id = auth.uid());

-- Aparelhos para notificação
create policy "meus" on dispositivos for all using (perfil_id = auth.uid()) with check (perfil_id = auth.uid());

-- ---------------------------------------------------------------------
-- Funções chamadas pelo app (RPC)
-- ---------------------------------------------------------------------

-- Tentativas de código (freio contra adivinhação)
create table if not exists public.tentativas_codigo (
  perfil_id uuid not null,
  em timestamptz not null default now()
);
alter table public.tentativas_codigo enable row level security;

create or replace function public.entrar_com_codigo(p_codigo text, p_vinculo vinculo_unidade default 'proprietario')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  u unidades;
  m_id uuid;
begin
  if auth.uid() is null then raise exception 'Faça login primeiro.'; end if;
  if (select count(*) from tentativas_codigo where perfil_id = auth.uid() and em > now() - interval '1 hour') >= 10 then
    raise exception 'Muitas tentativas. Aguarde uma hora ou fale com a síndica.';
  end if;

  select * into u from unidades where codigo_acesso = upper(regexp_replace(p_codigo, '[^A-Za-z0-9]', '', 'g'));
  if u.id is null then
    insert into tentativas_codigo (perfil_id) values (auth.uid());
    raise exception 'Código não encontrado. Confira as letras e números.';
  end if;

  perform set_config('vizinhar.liberar_membro', 'sim', true);
  insert into membros (condominio_id, perfil_id, unidade_id, papel, vinculo)
  values (u.condominio_id, auth.uid(), u.id, 'morador', p_vinculo)
  on conflict (condominio_id, perfil_id)
    do update set unidade_id = excluded.unidade_id, vinculo = excluded.vinculo, ativo = true
  returning id into m_id;
  perform set_config('vizinhar.liberar_membro', '', true);
  return u.condominio_id;
end $$;

-- Novo condomínio (para escalar: qualquer síndico pode cadastrar o seu)
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
  return c;
end $$;

-- Cadastra várias unidades de uma vez. Cada item: "101" ou "A-101" (bloco-número).
create or replace function public.criar_unidades(p_condominio uuid, p_lista text[])
returns int language plpgsql security definer set search_path = public as $$
declare
  item text;
  b text;
  n text;
  total int := 0;
begin
  if not e_gestor(p_condominio) then raise exception 'Somente a gestão.'; end if;
  foreach item in array p_lista loop
    item := trim(item);
    continue when item = '';
    if position('-' in item) > 0 then
      b := trim(split_part(item, '-', 1)); n := trim(substr(item, position('-' in item) + 1));
    else
      b := ''; n := item;
    end if;
    insert into unidades (condominio_id, bloco, numero) values (p_condominio, b, n)
    on conflict (condominio_id, bloco, numero) do nothing;
    if found then total := total + 1; end if;
  end loop;
  return total;
end $$;

create or replace function public.unidades_com_codigo(p_condominio uuid)
returns table (id uuid, bloco text, numero text, codigo_acesso text, moradores bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not e_gestor(p_condominio) then raise exception 'Somente a gestão.'; end if;
  return query
    select u.id, u.bloco, u.numero, u.codigo_acesso,
           (select count(*) from membros m where m.unidade_id = u.id and m.ativo)
      from unidades u
     where u.condominio_id = p_condominio
     order by u.bloco, length(u.numero), u.numero;
end $$;

create or replace function public.novo_codigo_unidade(p_unidade uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  novo text;
begin
  if not e_gestor((select condominio_id from unidades where id = p_unidade)) then
    raise exception 'Somente a gestão.';
  end if;
  update unidades set codigo_acesso = gerar_codigo(8) where id = p_unidade returning codigo_acesso into novo;
  return novo;
end $$;

-- Votação: um voto por unidade, pode trocar enquanto a enquete estiver aberta.
create or replace function public.votar(p_enquete uuid, p_opcao uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  e enquetes;
  u uuid;
begin
  select * into e from enquetes where id = p_enquete;
  if e.id is null or not e_membro(e.condominio_id) then raise exception 'Enquete não encontrada.'; end if;
  if e.encerra_em is not null and e.encerra_em < now() then raise exception 'Esta enquete já foi encerrada.'; end if;
  if not exists (select 1 from enquete_opcoes where id = p_opcao and enquete_id = p_enquete) then
    raise exception 'Opção inválida.';
  end if;
  select unidade_id into u from membros
   where perfil_id = auth.uid() and condominio_id = e.condominio_id and ativo and unidade_id is not null;
  if u is null then raise exception 'Somente moradores com unidade cadastrada podem votar.'; end if;
  insert into votos (enquete_id, unidade_id, opcao_id, perfil_id) values (p_enquete, u, p_opcao, auth.uid())
  on conflict (enquete_id, unidade_id) do update set opcao_id = excluded.opcao_id, perfil_id = excluded.perfil_id, votado_em = now();
end $$;

create or replace function public.resultado_enquete(p_enquete uuid)
returns table (opcao_id uuid, texto text, votos bigint, minha boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not e_membro((select condominio_id from enquetes where id = p_enquete)) then
    raise exception 'Enquete não encontrada.';
  end if;
  return query
    select o.id, o.texto,
           (select count(*) from votos v where v.opcao_id = o.id),
           exists (select 1 from votos v where v.opcao_id = o.id and v.unidade_id in (select minhas_unidades()))
      from enquete_opcoes o
     where o.enquete_id = p_enquete
     order by o.ordem, o.texto;
end $$;

-- Datas ocupadas de uma área, sem revelar qual unidade reservou.
create or replace function public.datas_ocupadas(p_area uuid, p_de date, p_ate date)
returns table (data date, periodo text, status text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not e_membro((select condominio_id from areas_comuns where id = p_area)) then
    raise exception 'Área não encontrada.';
  end if;
  return query
    select r.data, r.periodo, r.status from reservas r
     where r.area_id = p_area and r.data between p_de and p_ate and r.status in ('pendente', 'confirmada');
end $$;

-- Inadimplência agregada: transparência sem expor quem deve.
create or replace function public.resumo_inadimplencia(p_condominio uuid)
returns table (unidades_total bigint, unidades_em_atraso bigint, valor_em_atraso numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not e_membro(p_condominio) then raise exception 'Sem acesso.'; end if;
  return query
    select (select count(*) from unidades where condominio_id = p_condominio),
           count(distinct c.unidade_id),
           coalesce(sum(c.valor), 0)
      from cobrancas c
     where c.condominio_id = p_condominio and c.status = 'aberta' and c.vencimento < current_date;
end $$;

-- Quantas pessoas leram um aviso (para a gestão saber se o recado chegou)
create or replace function public.leituras_aviso(p_aviso uuid)
returns bigint language plpgsql stable security definer set search_path = public as $$
begin
  if not e_gestor((select condominio_id from avisos where id = p_aviso)) then return null; end if;
  return (select count(*) from avisos_leituras where aviso_id = p_aviso);
end $$;

-- LGPD art. 18, II e V: acesso e portabilidade — tudo o que existe sobre mim.
create or replace function public.meus_dados()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'gerado_em', now(),
    'conta', (select jsonb_build_object('id', u.id, 'email', u.email, 'telefone', u.phone, 'criada_em', u.created_at, 'ultimo_login', u.last_sign_in_at)
                from auth.users u where u.id = auth.uid()),
    'perfil', (select to_jsonb(p) from perfis p where p.id = auth.uid()),
    'vinculos', (select coalesce(jsonb_agg(jsonb_build_object(
                    'condominio', c.nome, 'papel', m.papel, 'vinculo', m.vinculo, 'telefone', m.telefone,
                    'unidade', nullif(concat_ws('-', nullif(u.bloco, ''), u.numero), ''), 'desde', m.criado_em)), '[]')
                  from membros m join condominios c on c.id = m.condominio_id
                  left join unidades u on u.id = m.unidade_id where m.perfil_id = auth.uid()),
    'consentimentos', (select coalesce(jsonb_agg(to_jsonb(x) - 'perfil_id'), '[]') from consentimentos x where x.perfil_id = auth.uid()),
    'avisos_lidos', (select count(*) from avisos_leituras where perfil_id = auth.uid()),
    'chamados', (select coalesce(jsonb_agg(jsonb_build_object('titulo', titulo, 'descricao', descricao, 'status', status, 'criado_em', criado_em)), '[]')
                   from chamados where autor_id = auth.uid()),
    'comentarios_em_chamados', (select coalesce(jsonb_agg(jsonb_build_object('texto', texto, 'criado_em', criado_em)), '[]')
                   from chamados_atualizacoes where autor_id = auth.uid()),
    'reservas', (select coalesce(jsonb_agg(jsonb_build_object('area', a.nome, 'data', r.data, 'periodo', r.periodo, 'status', r.status)), '[]')
                   from reservas r join areas_comuns a on a.id = r.area_id where r.perfil_id = auth.uid()),
    'classificados', (select coalesce(jsonb_agg(jsonb_build_object('titulo', titulo, 'descricao', descricao, 'contato', contato, 'criado_em', criado_em)), '[]')
                   from classificados where autor_id = auth.uid()),
    'sugestoes', (select coalesce(jsonb_agg(jsonb_build_object('titulo', titulo, 'descricao', descricao, 'criado_em', criado_em)), '[]')
                   from sugestoes where autor_id = auth.uid()),
    'votos_registrados', (select count(*) from votos where perfil_id = auth.uid()),
    'pedidos_lgpd', (select coalesce(jsonb_agg(to_jsonb(s) - 'perfil_id'), '[]') from solicitacoes_titular s where s.perfil_id = auth.uid()),
    'aparelhos_para_notificacao', (select count(*) from dispositivos where perfil_id = auth.uid())
  );
$$;

-- ---------------------------------------------------------------------
-- Retenção (LGPD art. 15/16): apaga o que não é mais necessário.
-- Agende com pg_cron: select cron.schedule('limpeza-lgpd', '0 4 * * 0', 'select public.limpar_dados_antigos()');
-- ---------------------------------------------------------------------
create or replace function public.limpar_dados_antigos()
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from encomendas where retirada_em < now() - interval '6 months';
  delete from avisos_leituras where lido_em < now() - interval '2 years';
  delete from dispositivos where atualizado_em < now() - interval '6 months';
  delete from tentativas_codigo where em < now() - interval '1 day';
  delete from classificados where not ativo and criado_em < now() - interval '1 year';
  -- Prestação de contas e auditoria financeira: 5 anos (prazo prescricional, CC art. 206, §5º, I)
  delete from auditoria where criado_em < now() - interval '5 years';
end $$;

-- Funções que o app não deve chamar diretamente
revoke execute on function public.limpar_dados_antigos() from public, anon, authenticated;
revoke execute on function public.auditar() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Arquivos (Storage): bucket privado, caminho "<condominio>/<pasta>/<arquivo>"
-- Pastas: avisos, chamados, classificados, documentos, restrito, comprovantes
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('arquivos', 'arquivos', false, 15728640, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "arquivos: ler" on storage.objects;
drop policy if exists "arquivos: enviar" on storage.objects;
drop policy if exists "arquivos: apagar" on storage.objects;

create policy "arquivos: ler" on storage.objects for select to authenticated using (
  bucket_id = 'arquivos' and e_membro(condominio_do_caminho(name)) and (
    case split_part(name, '/', 2)
      when 'chamados' then owner_id = auth.uid()::text or e_gestor(condominio_do_caminho(name))
      when 'restrito' then e_conselho(condominio_do_caminho(name))
      else true
    end
  )
);
create policy "arquivos: enviar" on storage.objects for insert to authenticated with check (
  bucket_id = 'arquivos' and e_membro(condominio_do_caminho(name)) and (
    split_part(name, '/', 2) in ('chamados', 'classificados') or e_gestor(condominio_do_caminho(name))
  )
);
create policy "arquivos: apagar" on storage.objects for delete to authenticated using (
  bucket_id = 'arquivos' and (owner_id = auth.uid()::text or e_gestor(condominio_do_caminho(name)))
);
