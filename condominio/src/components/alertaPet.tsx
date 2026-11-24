import { router } from 'expo-router';
import { View } from 'react-native';

import { nomeUnidade, quando } from '@/lib/formato';
import { espaco } from '@/lib/tema';
import { ESPECIES, Pet } from '@/lib/tipos';
import { FotoPrivada } from './fotoPrivada';
import { Botao, Cartao, Texto } from './ui';

/** Alerta na tela inicial: um pet do condomínio fugiu. */
export function AlertaPet({ pet, meu }: { pet: Pet; meu: boolean }) {
  return (
    <Cartao destaque="perigo">
      <Texto negrito>🚨 {meu ? 'SEU PET ESTÁ MARCADO COMO PERDIDO' : 'PROCURA-SE'}</Texto>
      <View style={{ flexDirection: 'row', gap: espaco.m, alignItems: 'center' }}>
        <FotoPrivada caminho={pet.foto_path} emoji={ESPECIES[pet.especie].emoji} tamanho={80} rotulo={`Foto de ${pet.nome}`} />
        <View style={{ flex: 1 }}>
          <Texto tamanho="subtitulo" negrito>{pet.nome}</Texto>
          <Texto>{ESPECIES[pet.especie].nome}{pet.descricao ? ` · ${pet.descricao}` : ''}</Texto>
          <Texto tamanho="pequeno" suave>{nomeUnidade(pet.unidades)}{pet.perdido_desde ? ` · sumiu ${quando(pet.perdido_desde)}` : ''}</Texto>
        </View>
      </View>
      <Botao icone="paw-outline" titulo={meu ? 'Já voltou? Avise aqui' : 'Vi esse pet'} aoTocar={() => router.push(`/pets/${pet.id}`)} />
    </Cartao>
  );
}
