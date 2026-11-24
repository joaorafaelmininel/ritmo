// Exclusão de conta (LGPD art. 18, VI; exigência da App Store e do Google Play).
// Apaga o usuário do Auth; o banco remove perfil, vínculos e consentimentos em cascata
// e desvincula a autoria de avisos/chamados/comentários (ficam sem nome).
// Registros que o condomínio precisa manter por obrigação legal (ex.: lançamentos
// financeiros) não contêm dados pessoais do morador.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const url = Deno.env.get('SUPABASE_URL')!;
  const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: { user }, error } = await admin.auth.getUser(jwt);
  if (error || !user) return json({ erro: 'Sessão inválida.' }, 401);

  // Impede deixar o condomínio sem síndico(a) por engano.
  const { data: sindicos } = await admin
    .from('membros').select('condominio_id').eq('perfil_id', user.id).eq('papel', 'sindico');
  for (const s of sindicos ?? []) {
    const { count } = await admin.from('membros').select('id', { count: 'exact', head: true })
      .eq('condominio_id', s.condominio_id).eq('papel', 'sindico').neq('perfil_id', user.id);
    if (!count) {
      return json({ erro: 'Você é a única pessoa síndica. Passe a função para outra pessoa antes de excluir a conta.' }, 409);
    }
  }

  // Remove fotos enviadas pela pessoa (chamados e classificados).
  const { data: arquivos } = await admin.schema('storage').from('objects')
    .select('name').eq('bucket_id', 'arquivos').eq('owner_id', user.id);
  const nomes = (arquivos ?? []).map((a: { name: string }) => a.name);
  if (nomes.length) await admin.storage.from('arquivos').remove(nomes);

  const { error: erroExclusao } = await admin.auth.admin.deleteUser(user.id);
  if (erroExclusao) return json({ erro: 'Não foi possível excluir agora. Tente mais tarde.' }, 500);

  return json({ ok: true });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}
