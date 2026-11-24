// Envia notificações push (Expo) para:
//  - todos os moradores, quando a gestão publica um aviso;
//  - os moradores da unidade, quando a portaria registra uma encomenda;
//  - quem reservou, quando a gestão confirma/recusa uma reserva;
//  - quem abriu o chamado, quando a gestão responde;
//  - a unidade, quando alguém chega na portaria; a portaria, quando o morador responde.
// A função confere, com o login de quem chamou, se ela tem permissão para isso.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Pedido = { tipo: 'aviso' | 'encomenda' | 'reserva' | 'chamado' | 'portaria' | 'pet_perdido' | 'pet_visto' | 'ajuda' | 'ajuda_aceita' | 'falta'; id: string };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const url = Deno.env.get('SUPABASE_URL')!;
  const auth = req.headers.get('Authorization') ?? '';
  // Cliente "como o usuário": a RLS decide o que ele pode ver.
  const usuario = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { tipo, id } = (await req.json()) as Pedido;
  let condominio: string | null = null;
  let destinatarios: string[] = [];
  let titulo = '';
  let corpo = '';
  let rota = '/';

  if (tipo === 'aviso') {
    const { data: a } = await usuario.from('avisos').select('condominio_id, titulo, importante').eq('id', id).single();
    if (!a) return json({ erro: 'Aviso não encontrado.' }, 404);
    condominio = a.condominio_id;
    if (!(await pode(usuario, 'e_gestor', condominio!))) return json({ erro: 'Sem permissão.' }, 403);
    const { data } = await admin.from('membros').select('perfil_id').eq('condominio_id', condominio).eq('ativo', true);
    destinatarios = (data ?? []).map((m) => m.perfil_id);
    titulo = a.importante ? 'Aviso importante' : 'Novo aviso';
    corpo = a.titulo;
    rota = `/aviso/${id}`;
  } else if (tipo === 'encomenda') {
    const { data: e } = await usuario.from('encomendas').select('condominio_id, unidade_id, descricao').eq('id', id).single();
    if (!e) return json({ erro: 'Encomenda não encontrada.' }, 404);
    condominio = e.condominio_id;
    if (!(await pode(usuario, 'e_portaria', condominio!))) return json({ erro: 'Sem permissão.' }, 403);
    const { data } = await admin.from('membros').select('perfil_id').eq('unidade_id', e.unidade_id).eq('ativo', true);
    destinatarios = (data ?? []).map((m) => m.perfil_id);
    titulo = 'Chegou uma encomenda';
    corpo = `${e.descricao} — retire na portaria.`;
    rota = '/encomendas';
  } else if (tipo === 'reserva') {
    const { data: r } = await usuario.from('reservas').select('condominio_id, perfil_id, status, data, areas_comuns(nome)').eq('id', id).single();
    if (!r) return json({ erro: 'Reserva não encontrada.' }, 404);
    condominio = r.condominio_id;
    if (!(await pode(usuario, 'e_gestor', condominio!))) return json({ erro: 'Sem permissão.' }, 403);
    destinatarios = r.perfil_id ? [r.perfil_id] : [];
    const area = (r.areas_comuns as unknown as { nome: string } | null)?.nome ?? 'Área comum';
    titulo = r.status === 'confirmada' ? 'Reserva confirmada' : 'Reserva não aprovada';
    corpo = `${area} — ${r.data.split('-').reverse().join('/')}`;
    rota = '/reservas';
  } else if (tipo === 'chamado') {
    const { data: c } = await usuario.from('chamados').select('condominio_id, autor_id, titulo').eq('id', id).single();
    if (!c) return json({ erro: 'Chamado não encontrado.' }, 404);
    condominio = c.condominio_id;
    if (!(await pode(usuario, 'e_gestor', condominio!))) return json({ erro: 'Sem permissão.' }, 403);
    destinatarios = c.autor_id ? [c.autor_id] : [];
    titulo = 'Seu chamado foi atualizado';
    corpo = c.titulo;
    rota = `/chamados/${id}`;
  } else if (tipo === 'portaria') {
    const { data: p } = await usuario.from('portaria').select('condominio_id, unidade_id, nome, status, tipo').eq('id', id).single();
    if (!p) return json({ erro: 'Registro não encontrado.' }, 404);
    condominio = p.condominio_id;
    if (await pode(usuario, 'e_portaria', condominio!)) {
      // Portaria → moradores da unidade
      const { data } = await admin.from('membros').select('perfil_id').eq('unidade_id', p.unidade_id).eq('ativo', true);
      destinatarios = (data ?? []).map((m) => m.perfil_id);
      titulo = p.status === 'na_portaria' ? 'Alguém na portaria para você' : 'Sua visita chegou';
      corpo = p.status === 'na_portaria' ? `${p.nome} — toque para autorizar ou não` : `${p.nome} entrou no condomínio`;
      rota = '/portaria';
    } else {
      // Morador respondeu → equipe da portaria
      const { data } = await admin.from('membros').select('perfil_id').eq('condominio_id', condominio).eq('ativo', true).eq('papel', 'portaria');
      destinatarios = (data ?? []).map((m) => m.perfil_id);
      titulo = p.status === 'autorizado' ? 'Entrada autorizada' : p.status === 'negado' ? 'Entrada NÃO autorizada' : 'Aviso cancelado';
      corpo = p.nome;
      rota = '/portaria';
    }
  } else if (tipo === 'pet_perdido') {
    // Só a unidade dona do pet consegue marcar "perdido" (RLS); aqui confirmamos que está marcado.
    const { data: pet } = await usuario.from('pets').select('condominio_id, nome, perdido, unidade_id').eq('id', id).single();
    if (!pet || !pet.perdido) return json({ erro: 'Pet não está marcado como perdido.' }, 400);
    const { data: minhas } = await usuario.rpc('minhas_unidades');
    if (!(minhas ?? []).includes(pet.unidade_id)) return json({ erro: 'Sem permissão.' }, 403);
    condominio = pet.condominio_id;
    const { data } = await admin.from('membros').select('perfil_id').eq('condominio_id', condominio).eq('ativo', true);
    destinatarios = (data ?? []).map((m) => m.perfil_id);
    titulo = `Pet perdido: ${pet.nome}`;
    corpo = 'Viu por aí? Toque para ver a foto e avisar o dono.';
    rota = `/pets/${id}`;
  } else if (tipo === 'pet_visto') {
    // id = avistamento criado por quem chamou
    const { data: av } = await usuario.from('pets_avistamentos').select('local, autor_id, pets(id, nome, unidade_id, condominio_id)').eq('id', id).single();
    const pet = av?.pets as unknown as { id: string; nome: string; unidade_id: string; condominio_id: string } | null;
    if (!av || !pet) return json({ erro: 'Aviso não encontrado.' }, 404);
    const { data: { user } } = await usuario.auth.getUser();
    if (av.autor_id !== user?.id) return json({ erro: 'Sem permissão.' }, 403);
    condominio = pet.condominio_id;
    const { data } = await admin.from('membros').select('perfil_id').eq('unidade_id', pet.unidade_id).eq('ativo', true);
    destinatarios = (data ?? []).map((m) => m.perfil_id);
    titulo = `Encontraram ${pet.nome}!`;
    corpo = av.local ? `Visto em: ${av.local}` : 'Um vizinho viu seu pet. Toque para ver.';
    rota = `/pets/${pet.id}`;
  } else if (tipo === 'ajuda' || tipo === 'ajuda_aceita') {
    const { data: aj } = await usuario.from('ajuda_pedidos').select('condominio_id, autor_id, voluntario_id, tipo, status').eq('id', id).single();
    if (!aj) return json({ erro: 'Pedido não encontrado.' }, 404);
    const { data: { user } } = await usuario.auth.getUser();
    condominio = aj.condominio_id;
    if (tipo === 'ajuda') {
      if (aj.autor_id !== user?.id) return json({ erro: 'Sem permissão.' }, 403);
      const { data } = await admin.from('voluntarios').select('perfil_id').eq('condominio_id', condominio).eq('ativo', true);
      destinatarios = (data ?? []).map((v) => v.perfil_id).filter((p) => p !== user?.id);
      titulo = 'Um vizinho precisa de ajuda';
      corpo = 'Toque para ver o pedido. Pode ser rapidinho!';
    } else {
      if (aj.voluntario_id !== user?.id || aj.status !== 'combinado') return json({ erro: 'Sem permissão.' }, 403);
      destinatarios = aj.autor_id ? [aj.autor_id] : [];
      titulo = 'Um vizinho vai te ajudar!';
      corpo = 'Toque para ver quem é.';
    }
    rota = '/solidario';
  } else if (tipo === 'falta') {
    // Primeiro relato de falta de serviço → avisa portaria e gestão
    const { data: inc } = await usuario.from('incidentes').select('condominio_id, servico').eq('id', id).single();
    if (!inc) return json({ erro: 'Não encontrado.' }, 404);
    condominio = inc.condominio_id;
    const { data } = await admin.from('membros').select('perfil_id').eq('condominio_id', condominio).eq('ativo', true)
      .in('papel', ['portaria', 'sindico', 'subsindico', 'administracao']);
    destinatarios = (data ?? []).map((m) => m.perfil_id);
    const nomes: Record<string, string> = { energia: 'energia', agua: 'água', internet: 'internet', interfone: 'interfone', portao: 'portão' };
    titulo = `Morador relatou falta de ${nomes[inc.servico] ?? inc.servico}`;
    corpo = 'Toque para registrar protocolo e previsão.';
    rota = '/servicos';
  } else {
    return json({ erro: 'Tipo inválido.' }, 400);
  }

  if (!destinatarios.length) return json({ enviados: 0 });
  const { data: aparelhos } = await admin.from('dispositivos').select('token').in('perfil_id', destinatarios);
  const mensagens = (aparelhos ?? []).map((d) => ({
    to: d.token, title: titulo, body: corpo, sound: 'default', priority: 'high', data: { rota },
  }));

  // A API da Expo aceita até 100 mensagens por chamada.
  for (let i = 0; i < mensagens.length; i += 100) {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(mensagens.slice(i, i + 100)),
    });
  }
  return json({ enviados: mensagens.length });
});

// deno-lint-ignore no-explicit-any
async function pode(cliente: any, funcao: string, condominio: string) {
  const { data } = await cliente.rpc(funcao, { c: condominio });
  return data === true;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}
