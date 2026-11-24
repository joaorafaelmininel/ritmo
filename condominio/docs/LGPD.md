# LGPD no Vizinhar

> Como o app foi construído para cumprir a Lei 13.709/2018 e o que ainda precisa ser feito fora do código.

## Papéis

| Papel (LGPD) | Quem | Por quê |
|---|---|---|
| Controlador (art. 5º, VI) | **O condomínio**, representado pela síndica | Decide para que os dados são usados (gestão condominial) |
| Operador (art. 5º, VII) | **Titular do app** (vocês / futura empresa) | Trata os dados em nome do condomínio |
| Suboperadores | Supabase (banco/arquivos), Expo + Apple + Google (notificações) | Infraestrutura |
| Canal do titular | Contato de privacidade cadastrado em *Gestão → Dados do condomínio* | Art. 41; condomínios pequenos podem dispensar encarregado formal (Res. CD/ANPD nº 2/2022), mas precisam de um canal |

## Inventário de dados (o que, para quê, base legal, quem vê, por quanto tempo)

| Dado | Finalidade | Base legal | Quem vê | Retenção |
|---|---|---|---|---|
| E-mail | Login por código | Execução de contrato (art. 7º, V) | Só a própria pessoa (e o sistema) | Enquanto houver conta |
| Nome | Identificação | Execução de contrato / legítimo interesse | Vizinhos (só nome), gestão | Enquanto houver conta |
| Unidade e vínculo | Gestão condominial | Obrigação legal / legítimo interesse | Própria pessoa, gestão | Enquanto for morador |
| Telefone (opcional) | Contato em emergências | Consentimento (campo opcional) | Gestão | Até a pessoa apagar |
| Chamados e fotos | Manutenção e convivência | Legítimo interesse | Unidade autora, gestão | Histórico do condomínio (autor anonimizado ao excluir conta) |
| Reservas | Uso de áreas comuns | Execução de contrato / convenção | Unidade, gestão (outros veem só “ocupado”) | Histórico |
| Cobranças | Taxa condominial | Obrigação legal (CC art. 1.336) | Unidade, gestão; demais só total agregado | 5 anos |
| Lançamentos financeiros | Prestação de contas | Obrigação legal (CC art. 1.348, VIII) | Todos os condôminos | 5 anos |
| Votos | Consulta aos moradores | Legítimo interesse | **Ninguém** individualmente (só totais) | Histórico |
| Token de notificação | Envio de push | Consentimento (art. 7º, I) | Sistema | Removido ao desativar ou após 6 meses parado |
| Leituras de avisos | Saber se o recado chegou | Legítimo interesse | Gestão (só contagem) | 2 anos |
| Encomendas | Aviso de chegada | Legítimo interesse | Unidade, portaria | 6 meses após retirada |

**Não coletamos:** CPF, RG, data de nascimento, localização, contatos, dados de saúde, biometria, imagens de câmeras de segurança, dados de crianças.

## Medidas técnicas implementadas

- **Isolamento por condomínio** com Row Level Security em todas as tabelas (`supabase/migrations/20261124000002_seguranca.sql`), testado automaticamente (`npm run test:banco`, 50+ cenários: morador não vê chamado do vizinho, não lê votos, não vê código de acesso de outras unidades, não vira síndico sozinho etc.).
- **Permissão por coluna**: o código de acesso das unidades não pode ser lido por moradores.
- **Voto secreto**: a tabela de votos não é legível; resultados só por função agregadora.
- **Inadimplência agregada**: moradores veem só o total, nunca quais unidades devem.
- **Arquivos privados** (bucket sem acesso público), links temporários de 1 hora, pastas com regras próprias (fotos de chamados só para autor e gestão; documentos restritos só para gestão/conselho).
- **Fotos sem metadados** de localização (`exif: false`).
- **Auditoria** automática de alterações em finanças, cadastro de moradores e documentos.
- **Freio contra adivinhação** de código de acesso (10 tentativas/hora).
- **Sem rastreamento**: nenhum SDK de analytics ou publicidade; permissões de microfone e localização bloqueadas no Android; manifesto de privacidade iOS declarando ausência de tracking.
- **Retenção**: função `limpar_dados_antigos()` — agende com pg_cron (ver README).

## Direitos do titular (art. 18) — onde estão no app

| Direito | Onde |
|---|---|
| Confirmação e acesso | *Mais → Privacidade → Baixar uma cópia dos meus dados* |
| Correção | *Mais → Meu perfil* |
| Portabilidade | Mesma exportação (JSON) |
| Eliminação | *Mais → Privacidade → Excluir minha conta* (exigido também pela Apple e Google) |
| Revogação de consentimento | *Parar de receber* notificações; pedidos em *Fazer um pedido* |
| Informação sobre compartilhamento | Política de Privacidade (no app) |
| Reclamar | A gestão vê os pedidos em *Gestão → Registros* (prazo de resposta: 15 dias) |

Os aceites dos Termos e da Política ficam registrados com versão e data (tabela `consentimentos`). Ao mudar os textos, aumente a versão em `src/legal/textos.ts` e todos verão a tela de aceite de novo.

## O que fazer fora do código (checklist)

- [ ] Criar o projeto Supabase na **região São Paulo (sa-east-1)** — evita transferência internacional do banco.
- [ ] Assinar o acordo de tratamento de dados (DPA) do Supabase e guardar.
- [ ] Preencher o contato de privacidade do condomínio no app.
- [ ] Aprovar o uso do app em assembleia/conselho (ver `PROPRIEDADE-INTELECTUAL.md`, seção 2).
- [ ] Revisão jurídica da Política de Privacidade e dos Termos (`src/legal/textos.ts`).
- [ ] Elaborar um **RIPD** (Relatório de Impacto) simples — não é obrigatório para todos, mas é boa prática e ajuda ao escalar.
- [ ] Plano de resposta a incidentes: em caso de vazamento com risco relevante, comunicar a ANPD e os titulares no prazo da regulamentação vigente (Res. CD/ANPD nº 15/2024).
- [ ] Orientar a gestão: não exportar listas de moradores para grupos de WhatsApp; não publicar nome de inadimplentes (gera dano moral).
- [ ] Preencher os formulários de privacidade das lojas: *App Privacy* (Apple) e *Data safety* (Google) — com base no inventário acima. Declarar: e-mail, nome, telefone (opcional), fotos (opcional), conteúdo gerado pelo usuário; **sem** tracking.
- [ ] Manter canais alternativos (mural impresso) para não excluir quem não usa celular.
