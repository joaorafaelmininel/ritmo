import { router } from 'expo-router';

import { Botao, Carregando, Cartao, Erro, Linha, Selo, Tela, Texto, Vazio } from '@/components/ui';
import { useConsulta } from '@/lib/consulta';
import { quando } from '@/lib/formato';
import { useSessao } from '@/lib/sessao';
import { supabase } from '@/lib/supabase';
import { useTema } from '@/lib/tema';
import { Aviso, CATEGORIAS_AVISO } from '@/lib/tipos';

export default function Avisos() {
  const { c } = useTema();
  const { condominioId, eGestor, sessao } = useSessao();
  const { dados, erro, carregando, recarregar } = useConsulta(async () => {
    const [a, l] = await Promise.all([
      supabase.from('avisos').select('id, titulo, corpo, categoria, importante, fixado, publicado_em')
        .eq('condominio_id', condominioId).order('fixado', { ascending: false }).order('publicado_em', { ascending: false }).limit(100),
      supabase.from('avisos_leituras').select('aviso_id').eq('perfil_id', sessao!.user.id),
    ]);
    const lidos = new Set((l.data ?? []).map((x) => x.aviso_id));
    return { data: ((a.data ?? []) as Aviso[]).map((x) => ({ ...x, lido: lidos.has(x.id) })), error: a.error };
  }, [condominioId]);

  return (
    <Tela aoAtualizar={recarregar} atualizando={carregando && !!dados}>
      {eGestor ? <Botao icone="add-circle-outline" titulo="Escrever novo aviso" aoTocar={() => router.push('/aviso/novo')} /> : null}
      {erro ? <Erro texto={erro} aoTentar={recarregar} /> : null}
      {!dados && carregando ? <Carregando /> : null}
      {dados?.length === 0 ? <Vazio icone="megaphone-outline" texto="Nenhum aviso por enquanto." /> : null}
      {dados?.map((a) => (
        <Cartao
          key={a.id}
          destaque={a.importante && !a.lido ? 'alerta' : undefined}
          aoTocar={() => router.push(`/aviso/${a.id}`)}
          rotulo={`${a.lido ? '' : 'Não lido. '}${a.titulo}`}>
          <Linha>
            {!a.lido ? <Selo texto="NOVO" tipo="perigo" /> : null}
            {a.importante ? <Selo texto="Importante" tipo="alerta" /> : null}
            {a.fixado ? <Selo texto="Fixado" tipo="primaria" /> : null}
            <Selo texto={CATEGORIAS_AVISO[a.categoria] ?? a.categoria} />
          </Linha>
          <Texto tamanho="subtitulo" negrito cor={a.lido ? c.textoSuave : c.texto}>{a.titulo}</Texto>
          <Texto suave linhas={2}>{a.corpo}</Texto>
          <Texto tamanho="pequeno" suave>{quando(a.publicado_em)}</Texto>
        </Cartao>
      ))}
    </Tela>
  );
}
