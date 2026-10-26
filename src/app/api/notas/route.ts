import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import * as z from 'zod/v4'
import { NextResponse, type NextRequest } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { EXPENSE_CATEGORY_VALUES, PAYMENT_METHODS } from '@/lib/constants'

export const runtime = 'nodejs'
export const maxDuration = 60

const ReceiptSchema = z.object({
  is_receipt: z.boolean().describe('false se a imagem não for uma nota, cupom ou comprovante de compra'),
  merchant: z.string().nullable().describe('Nome fantasia do estabelecimento'),
  date: z.string().nullable().describe('Data da compra no formato YYYY-MM-DD'),
  total: z.number().nullable().describe('Valor total pago, em reais'),
  category: z.enum(EXPENSE_CATEGORY_VALUES as [string, ...string[]]),
  payment_method: z.enum(PAYMENT_METHODS as [string, ...string[]]).nullable(),
  description: z.string().describe('Descrição curta do gasto, ex.: "Compras do mês", "Jantar"'),
  items: z
    .array(
      z.object({
        name: z.string(),
        quantity: z.number().nullable(),
        total: z.number().nullable(),
      }),
    )
    .describe('Itens da nota, quando legíveis (no máximo 40)'),
})

export type ReceiptData = z.infer<typeof ReceiptSchema>

const MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
type MediaType = (typeof MEDIA_TYPES)[number]

const SYSTEM = `Você lê fotos de notas fiscais, cupons fiscais (NFC-e), recibos e comprovantes brasileiros e extrai os dados do gasto.
- Valores em reais, usando ponto como separador decimal no JSON (R$ 1.234,56 -> 1234.56).
- "total" é o valor efetivamente pago (após descontos). Se houver troco, ignore-o.
- Datas brasileiras vêm como DD/MM/AAAA; converta para YYYY-MM-DD.
- Escolha a categoria que melhor descreve a compra: mercado (supermercado, padaria, hortifruti), restaurante (bares, lanchonetes, delivery), casa, transporte (combustível, estacionamento, app de corrida), saude (farmácia, consultas), beleza, lazer, educacao, pets, vestuario, contas (luz, água, internet, telefone) ou outros.
- Se um campo não estiver legível, use null em vez de adivinhar.`

export async function POST(request: NextRequest) {
  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Faça login novamente.' }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'Leitura automática desativada: configure ANTHROPIC_API_KEY.' }, { status: 503 })
  }

  let image: string
  let mediaType: MediaType
  try {
    const body = (await request.json()) as { image?: string; mediaType?: string }
    image = body.image ?? ''
    mediaType = (MEDIA_TYPES as readonly string[]).includes(body.mediaType ?? '') ? (body.mediaType as MediaType) : 'image/jpeg'
  } catch {
    return NextResponse.json({ error: 'Requisição inválida.' }, { status: 400 })
  }
  if (!image || image.length > 7_000_000) {
    return NextResponse.json({ error: 'Imagem ausente ou grande demais.' }, { status: 400 })
  }

  const client = new Anthropic()
  try {
    const response = await client.beta.messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: betaZodOutputFormat(ReceiptSchema) },
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
            { type: 'text', text: `Extraia os dados deste gasto. Hoje é ${new Date().toISOString().slice(0, 10)}.` },
          ],
        },
      ],
    })

    if (response.stop_reason === 'refusal' || !response.parsed_output) {
      return NextResponse.json({ error: 'Não consegui ler esta nota. Preencha manualmente.' }, { status: 422 })
    }
    const data = response.parsed_output
    if (!data.is_receipt) {
      return NextResponse.json({ error: 'A foto não parece ser uma nota fiscal ou comprovante.' }, { status: 422 })
    }
    return NextResponse.json({ ...data, items: data.items.slice(0, 40) })
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: 'Muitas leituras seguidas. Tente de novo em instantes.' }, { status: 429 })
    }
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: 'Chave da API do Claude inválida.' }, { status: 500 })
    }
    if (error instanceof Anthropic.APIError) {
      console.error('Erro na leitura da nota', error.status, error.message)
      return NextResponse.json({ error: 'Falha ao ler a nota. Tente outra foto.' }, { status: 502 })
    }
    throw error
  }
}
