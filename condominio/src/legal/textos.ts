// Textos legais exibidos dentro do app. Ao alterar o conteúdo, suba a versão:
// todos precisarão aceitar de novo e o novo aceite fica registrado (LGPD art. 8º, §6º).
// IMPORTANTE: revisar com advogado(a) antes da publicação nas lojas.

import { APP_NOME, CONTATO_SUPORTE, TITULAR } from '@/lib/marca';

export const VERSAO_TERMOS = '1.0';
export const VERSAO_PRIVACIDADE = '1.0';
export const VERSAO_NOTIFICACOES = '1.0';
export const DATA_VIGENCIA = '24/11/2026';

export type Secao = { titulo: string; texto: string };

/** Resumo em linguagem simples mostrado no primeiro acesso. */
export const RESUMO_PRIVACIDADE: string[] = [
  'Pedimos só o necessário: seu nome, seu e-mail e a sua unidade. Telefone é opcional.',
  'Não pedimos CPF, RG nem data de nascimento.',
  'Quem cuida dos seus dados é o seu condomínio, representado pelo(a) síndico(a).',
  'Os vizinhos não veem seu e-mail, seu telefone, seus boletos nem seus chamados.',
  'A prestação de contas do condomínio é aberta a todos os moradores, como manda a lei.',
  'Você pode ver, baixar ou apagar seus dados quando quiser, pelo menu Mais → Privacidade.',
  'Nunca vendemos seus dados nem mostramos propaganda.',
];

export const POLITICA_PRIVACIDADE: Secao[] = [
  {
    titulo: '1. Quem somos',
    texto:
      `O ${APP_NOME} é um aplicativo de comunicação e gestão de condomínios. ` +
      `Cada condomínio que usa o app é o CONTROLADOR dos dados dos seus moradores (LGPD, art. 5º, VI), ` +
      `representado pelo(a) síndico(a). ${TITULAR} é o OPERADOR (art. 5º, VII): fornece e mantém o aplicativo ` +
      `e trata os dados apenas conforme as instruções do condomínio e esta política.`,
  },
  {
    titulo: '2. Quais dados coletamos',
    texto:
      '• Conta: e-mail (para enviar o código de acesso) e nome.\n' +
      '• Vínculo: unidade, tipo de vínculo (proprietário, inquilino, familiar) e função no condomínio.\n' +
      '• Opcional: telefone, visível apenas para a gestão, para contato em emergências.\n' +
      '• Uso: chamados, reservas, leituras de avisos, votos em enquetes, sugestões e anúncios que você criar.\n' +
      '• Fotos que você decidir enviar (ex.: foto de um vazamento). Removemos a localização (GPS) das fotos.\n' +
      '• Aparelho: identificador para notificações, somente se você ativar.\n' +
      'Não coletamos CPF, RG, data de nascimento, localização, contatos da agenda nem dados de saúde.',
  },
  {
    titulo: '3. Para que usamos e com qual base legal',
    texto:
      '• Identificar você como morador e permitir o uso do app — execução de contrato e procedimentos relacionados (art. 7º, V) e legítimo interesse do condomínio (art. 7º, IX).\n' +
      '• Prestação de contas, cobranças e cumprimento da convenção — cumprimento de obrigação legal (art. 7º, II; Código Civil, arts. 1.336 e 1.348).\n' +
      '• Comunicação de avisos, manutenção e segurança — legítimo interesse (art. 7º, IX).\n' +
      '• Notificações no celular — consentimento (art. 7º, I), que você pode retirar a qualquer momento.',
  },
  {
    titulo: '4. Quem vê o quê',
    texto:
      '• Vizinhos: apenas o seu nome quando você publica algo (sugestão, anúncio). Não veem unidade, e-mail nem telefone.\n' +
      '• Gestão (síndico, subsíndico, administração): cadastro dos moradores, chamados, reservas e cobranças, para administrar o condomínio.\n' +
      '• Conselho: prestação de contas e documentos restritos, para fiscalizar.\n' +
      '• Portaria: apenas o registro de encomendas.\n' +
      '• Enquetes: o voto é secreto — os resultados aparecem só como totais.\n' +
      '• Inadimplência: os moradores veem apenas o total, nunca quais unidades devem.',
  },
  {
    titulo: '5. Onde os dados ficam',
    texto:
      'Os dados ficam no Supabase (infraestrutura em nuvem), na região de São Paulo (Brasil), com criptografia em trânsito e em ' +
      'repouso, controle de acesso por regras no próprio banco de dados e registro (auditoria) das alterações financeiras e de ' +
      'cadastro. As notificações no celular passam pelos serviços da Expo, Apple e Google, que podem estar fora do Brasil; ' +
      'nelas enviamos apenas o título do aviso, sem dados pessoais, com as garantias do art. 33 da LGPD.',
  },
  {
    titulo: '6. Por quanto tempo guardamos',
    texto:
      '• Enquanto você for morador e tiver conta.\n' +
      '• Encomendas retiradas: 6 meses. Registros de leitura de avisos: 2 anos.\n' +
      '• Prestação de contas e auditoria financeira: 5 anos (prazo legal de cobrança e prestação de contas).\n' +
      '• Ao excluir sua conta, apagamos seu perfil, vínculos, fotos e aparelhos. O que você escreveu em chamados e avisos ' +
      'permanece sem o seu nome, para manter o histórico do condomínio.',
  },
  {
    titulo: '7. Seus direitos (art. 18)',
    texto:
      'Você pode, a qualquer momento: confirmar e acessar seus dados; corrigir dados; baixar uma cópia (portabilidade); ' +
      'pedir a exclusão; retirar consentimentos; saber com quem os dados são compartilhados. ' +
      'Quase tudo é feito direto no app, em Mais → Privacidade. Para outros pedidos, use o mesmo menu ou fale com o ' +
      'contato de privacidade do seu condomínio. Você também pode reclamar à ANPD (gov.br/anpd).',
  },
  {
    titulo: '8. Crianças e adolescentes',
    texto: 'O app é destinado a maiores de 18 anos. Não cadastre menores de idade como usuários.',
  },
  {
    titulo: '9. Incidentes de segurança',
    texto:
      'Se ocorrer um incidente que possa trazer risco ou dano relevante, o condomínio e os titulares afetados serão comunicados, ' +
      'e a ANPD será informada no prazo da regulamentação vigente.',
  },
  {
    titulo: '10. Contato',
    texto: `Privacidade: contato informado pelo seu condomínio (Mais → Privacidade). Suporte do aplicativo: ${CONTATO_SUPORTE}.`,
  },
];

export const TERMOS_DE_USO: Secao[] = [
  {
    titulo: '1. O que é o app',
    texto:
      `O ${APP_NOME} reúne avisos, chamados, reservas, encomendas, prestação de contas, enquetes e o plano de gestão do ` +
      'condomínio. O uso pelos moradores é gratuito.',
  },
  {
    titulo: '2. Acesso',
    texto:
      'O acesso é pessoal. Você entra com um código enviado ao seu e-mail e se vincula à sua unidade com o código entregue pela ' +
      'gestão do condomínio. Não compartilhe esses códigos.',
  },
  {
    titulo: '3. Boa convivência',
    texto:
      'É proibido publicar ofensas, discriminação, conteúdo ilegal, dados pessoais de terceiros sem autorização ou propaganda ' +
      'enganosa. A gestão pode remover conteúdos e desativar contas que descumpram estes termos ou o regimento interno.',
  },
  {
    titulo: '4. Enquetes',
    texto:
      'As enquetes do app são consultas aos moradores. Decisões que a lei ou a convenção reservam à assembleia continuam ' +
      'dependendo de assembleia regularmente convocada.',
  },
  {
    titulo: '5. Informações financeiras',
    texto:
      'Os valores exibidos são lançados pela gestão. Em caso de divergência, prevalecem os documentos oficiais (balancetes, ' +
      'boletos e atas).',
  },
  {
    titulo: '6. Propriedade intelectual',
    texto:
      `O aplicativo, seu código-fonte, marca, nome e layout pertencem a ${TITULAR} e são protegidos pelas Leis 9.609/1998 ` +
      '(software), 9.610/1998 (direitos autorais) e 9.279/1996 (propriedade industrial). O condomínio e seus moradores recebem ' +
      'uma licença de uso, pessoal, não exclusiva e intransferível. É proibido copiar, modificar, descompilar ou redistribuir o ' +
      'app. Os dados inseridos pertencem ao condomínio e aos moradores.',
  },
  {
    titulo: '7. Disponibilidade',
    texto:
      'Trabalhamos para manter o app disponível, mas podem ocorrer interrupções para manutenção ou por falhas de terceiros. ' +
      'Em emergências, ligue diretamente para os telefones de emergência (190, 192, 193).',
  },
  {
    titulo: '8. Alterações e encerramento',
    texto:
      'Estes termos podem ser atualizados; avisaremos no app e pediremos um novo aceite. Você pode excluir sua conta a qualquer ' +
      'momento em Mais → Privacidade.',
  },
  {
    titulo: '9. Lei e foro',
    texto: 'Aplicam-se as leis brasileiras. Fica eleito o foro do domicílio do usuário consumidor.',
  },
];
