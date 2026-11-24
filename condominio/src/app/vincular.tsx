import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { avisar, Botao, Campo, Cartao, Opcoes, Tela, Texto, Titulo } from '@/components/ui';
import { useSessao } from '@/lib/sessao';
import { mensagemErro, supabase } from '@/lib/supabase';
import { useTema } from '@/lib/tema';

// A síndica entrega um papel com o código de cada unidade. A pessoa digita e pronto.
export default function Vincular() {
  const { c } = useTema();
  const { recarregar, sair, escolherCondominio } = useSessao();
  const [modo, setModo] = useState<'codigo' | 'novo'>('codigo');
  const [codigo, setCodigo] = useState('');
  const [vinculo, setVinculo] = useState<'proprietario' | 'inquilino' | 'familiar'>('proprietario');
  const [nome, setNome] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('');
  const [contato, setContato] = useState('');
  const [formato, setFormato] = useState('quadra_lote');

  async function entrar() {
    if (codigo.replace(/\W/g, '').length < 6) return avisar('Código incompleto', 'Digite o código que está no papel entregue pela síndica.');
    const { data, error } = await supabase.rpc('entrar_com_codigo', { p_codigo: codigo, p_vinculo: vinculo });
    if (error) return avisar('Não deu certo', mensagemErro(error));
    escolherCondominio(data as string);
    await recarregar();
  }

  async function criar() {
    if (nome.trim().length < 3) return avisar('Falta o nome', 'Digite o nome do condomínio.');
    const { data, error } = await supabase.rpc('criar_condominio', {
      p_nome: nome, p_cidade: cidade, p_uf: uf, p_contato_privacidade: contato || null, p_formato: formato,
    });
    if (error) return avisar('Não foi possível criar', mensagemErro(error));
    escolherCondominio(data as string);
    await recarregar();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.fundo }}>
      <Tela>
        {modo === 'codigo' ? (
          <>
            <Titulo>Qual é a sua unidade?</Titulo>
            <Texto>Digite o código de acesso que você recebeu da síndica. Ele tem 8 letras e números.</Texto>
            <Campo
              rotulo="Código de acesso"
              valor={codigo}
              aoMudar={(t) => setCodigo(t.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="ABCD2345"
              maxLength={12}
              style={{ fontSize: 28, letterSpacing: 4, textAlign: 'center' }}
            />
            <Opcoes
              rotulo="Você é:"
              valor={vinculo}
              aoMudar={setVinculo}
              opcoes={[
                { valor: 'proprietario', nome: 'Proprietário(a)' },
                { valor: 'inquilino', nome: 'Inquilino(a)' },
                { valor: 'familiar', nome: 'Familiar' },
              ]}
            />
            <Botao titulo="Entrar no condomínio" icone="home-outline" aoTocar={entrar} />
            <Cartao>
              <Texto negrito>Não recebeu o código?</Texto>
              <Texto suave>Peça à síndica ou à portaria. Cada unidade tem o seu código.</Texto>
            </Cartao>
            <Botao tipo="texto" titulo="Sou síndico(a) e quero cadastrar meu condomínio" aoTocar={() => setModo('novo')} />
          </>
        ) : (
          <>
            <Titulo>Cadastrar condomínio</Titulo>
            <Texto>Você será a pessoa síndica. Depois, em “Gestão”, cadastre as unidades e imprima os códigos.</Texto>
            <Campo rotulo="Nome do condomínio" valor={nome} aoMudar={setNome} autoCapitalize="words" />
            <Campo rotulo="Cidade" valor={cidade} aoMudar={setCidade} autoCapitalize="words" placeholder="Jardinópolis" />
            <Campo rotulo="Estado (sigla)" valor={uf} aoMudar={(t) => setUf(t.toUpperCase().slice(0, 2))} autoCapitalize="characters" placeholder="SP" maxLength={2} />
            <Opcoes
              rotulo="Como as unidades são identificadas?"
              valor={formato}
              aoMudar={setFormato}
              opcoes={[{ valor: 'quadra_lote', nome: 'Quadra e lote' }, { valor: 'bloco_numero', nome: 'Bloco e número' }, { valor: 'casa', nome: 'Número da casa' }]}
            />
            <Campo
              rotulo="Contato para assuntos de privacidade"
              ajuda="E-mail ou telefone que os moradores podem usar para pedidos sobre seus dados (LGPD)."
              valor={contato}
              aoMudar={setContato}
              autoCapitalize="none"
            />
            <Botao titulo="Criar condomínio" icone="business-outline" aoTocar={criar} />
            <Botao tipo="texto" titulo="Voltar e usar um código" aoTocar={() => setModo('codigo')} />
          </>
        )}
        <Botao tipo="texto" titulo="Sair" aoTocar={sair} />
      </Tela>
    </SafeAreaView>
  );
}
