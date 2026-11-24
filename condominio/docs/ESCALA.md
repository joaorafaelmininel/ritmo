# Escalar para outros condomínios

## O que já está pronto

- **Multi-condomínio desde o primeiro dia**: toda tabela tem `condominio_id` e as regras de acesso isolam um condomínio do outro.
- Qualquer síndico(a) cadastra o próprio condomínio no app (*“Sou síndico(a) e quero cadastrar meu condomínio”*). O cadastro já cria áreas comuns, manutenções preventivas usuais e o esqueleto do plano de gestão nas quatro dimensões.
- Uma mesma pessoa pode estar em vários condomínios (ex.: dono de dois imóveis, ou síndico profissional) e alternar em *Meu perfil*.
- Papéis: morador, síndico, subsíndico, conselheiro, administração (administradora) e portaria.

## Custos de infraestrutura (referência — confira os preços atuais)

| Item | Início | Quando crescer |
|---|---|---|
| Supabase | Plano gratuito (pausa após inatividade) | Plano Pro mensal — recomendado já ao entrar em produção |
| Envio de e-mails (códigos de login) | Provedor SMTP com plano gratuito | Plano pago conforme volume |
| Apple Developer | Anuidade | — |
| Google Play | Taxa única | — |
| EAS (builds na nuvem) | Plano gratuito | Pago se precisar de mais builds |

## Próximas funcionalidades sugeridas (por prioridade)

1. **Integração bancária**: emitir boletos/Pix e baixar pagamentos automaticamente (APIs de bancos digitais ou intermediadores de pagamento). Hoje a cobrança é registrada manualmente.
2. **Painel web para a síndica** (o mesmo código já exporta para web com `npx expo export --platform web`): lançar finanças e imprimir relatórios no computador.
3. **Assembleia virtual**: pauta, presença e votação com quórum, conforme o art. 1.354-A do Código Civil (incluído pela Lei 14.309/2022), quando a convenção não proibir.
4. **Orçamento previsto × realizado** (a tabela `orcamento` já existe).
5. **Fornecedores e contratos** com alerta de vencimento (a tabela `fornecedores` já existe).
6. **Visitantes e prestadores**: autorização prévia pelo morador para a portaria.
7. **Relatório mensal em PDF** (balancete + chamados + manutenções) para assembleia.

## Modelo de negócio (para discutir)

- Gratuito para o condomínio de vocês (vitrine e laboratório).
- Assinatura mensal por unidade ou por faixa de unidades para outros condomínios.
- Plano para administradoras e síndicos profissionais (vários condomínios).

Antes de cobrar de outros condomínios: empresa aberta, marca depositada, contrato revisado e acordo de tratamento de dados (ver `PROPRIEDADE-INTELECTUAL.md` e `LGPD.md`).
