-- =====================================================================
-- Vizinhar — modelo inicial para um condomínio novo
-- Cria um ponto de partida (tudo editável no app): áreas comuns,
-- manutenções preventivas usuais e um esqueleto do plano de gestão
-- nas quatro dimensões.
-- =====================================================================

create or replace function public.aplicar_modelo_inicial(p_condominio uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not e_gestor(p_condominio) then raise exception 'Somente a gestão.'; end if;

  insert into areas_comuns (condominio_id, nome, descricao, capacidade, exige_aprovacao) values
    (p_condominio, 'Salão de festas', 'Reserva por período. Devolver limpo e com as luzes apagadas.', 60, true),
    (p_condominio, 'Churrasqueira', 'Levar o próprio carvão. Silêncio após as 22h.', 20, true);

  -- Manutenções preventivas comuns (ajuste à realidade do condomínio)
  insert into manutencoes (condominio_id, item, descricao, periodicidade_meses, obrigacao_legal) values
    (p_condominio, 'Limpeza das caixas d''água', 'Limpeza e desinfecção com laudo de potabilidade.', 6, true),
    (p_condominio, 'Recarga dos extintores', 'Verificar validade, lacre e manômetro.', 12, true),
    (p_condominio, 'AVCB (Corpo de Bombeiros)', 'Renovação do Auto de Vistoria do Corpo de Bombeiros.', 36, true),
    (p_condominio, 'SPDA (para-raios)', 'Inspeção e laudo de aterramento.', 12, true),
    (p_condominio, 'Dedetização e desratização', 'Áreas comuns, garagens e caixas de esgoto.', 6, false),
    (p_condominio, 'Jardinagem e poda', 'Poda de árvores e manutenção de canteiros.', 3, false),
    (p_condominio, 'Bombas d''água', 'Revisão preventiva e troca de selos.', 6, false),
    (p_condominio, 'Portões e interfones', 'Lubrificação, motores e teste dos interfones.', 3, false);

  -- Esqueleto do plano de gestão (exemplos para substituir pelos projetos reais)
  insert into projetos (condominio_id, dimensao, tipo, titulo, descricao, ordem) values
    (p_condominio, 'financeira', 'processo', 'Prestação de contas mensal', 'Lançar receitas e despesas no app e publicar o balancete até o dia 10 de cada mês.', 1),
    (p_condominio, 'financeira', 'projeto', 'Reduzir a inadimplência', 'Contato cordial, acordos e acompanhamento mensal do índice.', 2),
    (p_condominio, 'financeira', 'projeto', 'Revisão de contratos', 'Cotar novamente os principais contratos (limpeza, jardinagem, manutenção).', 3),
    (p_condominio, 'operacional', 'processo', 'Manutenção preventiva', 'Seguir o calendário de manutenções e registrar cada serviço feito.', 1),
    (p_condominio, 'operacional', 'processo', 'Atendimento de chamados', 'Responder todo chamado em até 2 dias úteis.', 2),
    (p_condominio, 'comunidade', 'processo', 'Comunicação com os moradores', 'Avisos pelo app, com cópia impressa no mural para quem preferir.', 1),
    (p_condominio, 'comunidade', 'projeto', 'Boas-vindas a novos moradores', 'Apresentar regras, contatos e o app a quem chega.', 2),
    (p_condominio, 'desenvolvimento', 'projeto', 'Implantação do aplicativo', 'Cadastrar unidades, entregar os códigos e ajudar quem tiver dificuldade.', 1),
    (p_condominio, 'desenvolvimento', 'projeto', 'Acessibilidade nas áreas comuns', 'Corrimãos, rampas, iluminação e piso antiderrapante.', 2);
end $$;

-- criar_condominio passa a aplicar o modelo automaticamente
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
  return c;
end $$;
