import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

import { supabase } from './supabase';

const BUCKET = 'arquivos';

/** Abre câmera ou galeria e devolve a imagem (comprimida para economizar dados). */
export async function escolherFoto(origem: 'camera' | 'galeria'): Promise<ImagePicker.ImagePickerAsset | null> {
  const permissao = origem === 'camera'
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permissao.granted) {
    Alert.alert('Permissão necessária', 'Para enviar fotos, permita o acesso nas configurações do celular.');
    return null;
  }
  const opcoes: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6, exif: false };
  const r = origem === 'camera' ? await ImagePicker.launchCameraAsync(opcoes) : await ImagePicker.launchImageLibraryAsync(opcoes);
  return r.canceled ? null : r.assets[0];
}

/** Envia um arquivo local para "<condominio>/<pasta>/<aleatorio>.<ext>". Fotos vão sem metadados de localização (exif: false). */
export async function enviarArquivo(condominioId: string, pasta: string, uri: string, tipo = 'image/jpeg') {
  const ext = tipo === 'application/pdf' ? 'pdf' : tipo.split('/')[1] ?? 'jpg';
  const caminho = `${condominioId}/${pasta}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const corpo = await (await fetch(uri)).arrayBuffer();
  const { error } = await supabase.storage.from(BUCKET).upload(caminho, corpo, { contentType: tipo });
  if (error) throw error;
  return caminho;
}

/** Link temporário (1 hora) para ver um arquivo privado. */
export async function linkArquivo(caminho: string) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(caminho, 3600);
  if (error) throw error;
  return data.signedUrl;
}

/** Abre um arquivo privado (PDF ou imagem) no navegador do celular. */
export async function abrirArquivo(caminho: string) {
  const Linking = await import('expo-linking');
  try {
    await Linking.openURL(await linkArquivo(caminho));
  } catch {
    Alert.alert('Não foi possível abrir', 'Verifique a internet e tente de novo.');
  }
}
