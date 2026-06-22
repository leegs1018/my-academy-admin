import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getFeaturePrice, getConBalance } from '@/lib/credits';
import { createAdminClient } from '@/lib/supabase-admin';

export const maxDuration = 60;

interface VocabChoiceResult {
  vocab_choice_passage: string;
  answer_key: string;
}

function buildPrompt(text: string, difficulty: string): string {
  const diffGuide: Record<string, string> = {
    b1: '중등~고등 하 수준',
    b2: '고등 중 수준',
    c1: '고등 상 수준',
    c2: '고등 최상/수능 상위권 수준',
  };

  return `당신은 한국 영어학원의 전문 영어 교사 AI입니다.
아래 영어 지문으로 어휘 선택 문제를 생성하세요.

난이도: ${difficulty} (${diffGuide[difficulty] || diffGuide['b2']})

=== 영어 지문 ===
${text}
=== 지문 끝 ===

생성 규칙:
1. 지문 전체에서 20~28개의 핵심 어휘/표현을 선택한다.
2. 각 위치에 [정답어휘 / 오답어휘] 또는 [오답어휘 / 정답어휘] (무작위 순서) 쌍을 만든다.
3. 오답은 반드시 품사 일치, 문맥상 그럴듯하되 의미상 부적절한 단어를 선택한다.
4. 번호는 지문 순서대로 1부터 순번을 부여한다.
5. 원문 문장 구조를 그대로 유지하고, 선택 어휘 위치에만 번호와 괄호를 삽입한다.

자체 검수:
- 각 쌍의 정답이 유일한지 확인
- 오답이 지나치게 쉽거나 품사가 다르면 교체
- 문장의 자연스러운 흐름이 유지되는지 확인

출력 형식 (반드시 순수 JSON만, 마크다운 코드블록 없이):
{
  "vocab_choice_passage": "지문 텍스트. 선택 어휘 위치에 1[정답 / 오답] 형식으로 삽입. 예: The scientist 1[discovered / invented] a new method",
  "answer_key": "1. discovered  2. word  3. word ..."
}`;
}

function extractJson(text: string): string {
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) return codeBlock[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1) return text.slice(start, end + 1);
  return text.trim();
}

export async function POST(request: Request) {
  try {
    const { text, difficulty, academy_id } = await request.json() as {
      text: string;
      difficulty?: string;
      academy_id?: string;
    };

    if (!text || text.trim().length < 50) {
      return NextResponse.json({ error: '지문 텍스트가 너무 짧습니다.' }, { status: 400 });
    }

    if (academy_id) {
      const price = await getFeaturePrice('vocab_choice');
      if (price > 0) {
        const balance = await getConBalance(academy_id);
        if (balance < price) {
          return NextResponse.json({ error: 'INSUFFICIENT_CON', required: price, balance }, { status: 402 });
        }
        const supabaseAdmin = createAdminClient();
        const { error: deductError } = await supabaseAdmin.rpc('deduct_con', {
          p_academy_id: academy_id,
          p_amount: price,
          p_feature_key: 'vocab_choice',
          p_description: '어휘 선택 문제 생성',
        });
        if (deductError) {
          if (deductError.message?.includes('INSUFFICIENT_CON')) {
            const balance2 = await getConBalance(academy_id);
            return NextResponse.json({ error: 'INSUFFICIENT_CON', required: price, balance: balance2 }, { status: 402 });
          }
          return NextResponse.json({ error: 'CON 차감 중 오류가 발생했습니다.' }, { status: 500 });
        }
      }
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 4096,
      messages: [{ role: 'user', content: buildPrompt(text, difficulty || 'b2') }],
    });

    const rawText = response.choices[0]?.message?.content ?? '';

    let data: VocabChoiceResult;
    try {
      data = JSON.parse(extractJson(rawText)) as VocabChoiceResult;
    } catch {
      console.error('[generate-vocab-choice] JSON 파싱 실패:', rawText.slice(0, 500));
      return NextResponse.json({ error: 'AI 응답 파싱에 실패했습니다. 다시 시도해주세요.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    console.error('[generate-vocab-choice] 오류:', error);
    let message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
    if (message.includes('401') || message.includes('authentication')) {
      message = 'API 키가 올바르지 않습니다.';
    } else if (message.includes('429')) {
      message = 'API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.';
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
