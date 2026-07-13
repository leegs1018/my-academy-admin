import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getFeaturePrice, getConBalance } from '@/lib/credits';
import { createAdminClient } from '@/lib/supabase-admin';

export const maxDuration = 60;

interface TFQuestion {
  number: number;
  statement: string;
  answer: 'T' | 'F';
  explanation: string;
}

interface VocabRow {
  word: string;
  meaning: string;
  syn1: string; syn1_m: string;
  syn2: string; syn2_m: string;
  syn3: string; syn3_m: string;
  antonym: string; antonym_m: string;
}

interface KoreanSummaryRow {
  label: string;
  content: string;
}

interface KoreanSummary {
  type: '일반' | '논쟁' | '문제';
  rows: KoreanSummaryRow[];
}

interface GeneratedMaterials {
  paraphrased_passage: string;
  tf_questions: TFQuestion[];
  answer_key: string;
  korean_summary: KoreanSummary;
  english_titles: string[];
  one_sentence_summaries: { english: string; korean: string }[];
  vocabulary_table: VocabRow[];
}

function buildPrompt(text: string, difficulty: string): string {
  const difficultyGuide: Record<string, string> = {
    'b1': '중등~고등 하 수준. 기본 어휘 위주로 사용.',
    'b2': '고등 중 수준. 중간 난이도 어휘 사용.',
    'c1': '고등 상 수준. 고급 어휘와 복잡한 구문 사용.',
    'c2': '고등 최상 수준. 수능 상위권, 원어민 수준 어휘 사용.',
  };

  const tfLengthRule = `각 statement는 반드시 영문 기준 100자 이상 130자 이하(character)여야 한다. 100자 미만 또는 130자 초과 절대 금지. 종속절(although, while, whereas 등), 분사구문, 관계절, 삽입구 등을 반드시 포함하여 문장을 충분히 길고 복잡하게 만들 것. 작성 후 반드시 글자 수를 확인하여 100~130자 범위 내에 있는지 검증할 것. 어휘는 지문 난이도에 맞게 선택.`;

  return `당신은 한국 영어학원의 전문 영어 교사 AI입니다.
아래 영어 지문을 분석하여 6가지 교육 자료를 생성해주세요.

난이도: ${difficulty} (${difficultyGuide[difficulty] || difficultyGuide['b2']})

=== 영어 지문 ===
${text}
=== 지문 끝 ===

반드시 아래 JSON 형식으로만 반환하세요. 마크다운 코드블록 없이 순수 JSON만 출력하세요.

{
  "paraphrased_passage": "C1 레벨 어휘로 paraphrase한 변형 지문",
  "korean_summary": {
    "type": "일반",
    "rows": [
      {"label": "핵심내용", "content": "한글로 핵심 내용 1~2문장"},
      {"label": "사례", "content": "한글로 사례 1~2문장"},
      {"label": "결론", "content": "한글로 결론 1문장"}
    ]
  },
  "tf_questions": [
    {"number": 1, "statement": "English statement using vocabulary NOT in the passage", "answer": "T", "explanation": "한글로 왜 T인지 설명"},
    {"number": 2, "statement": "...", "answer": "F", "explanation": "한글로 왜 F인지 설명"},
    {"number": 3, "statement": "...", "answer": "T", "explanation": "..."},
    {"number": 4, "statement": "...", "answer": "F", "explanation": "..."},
    {"number": 5, "statement": "...", "answer": "T", "explanation": "..."},
    {"number": 6, "statement": "...", "answer": "F", "explanation": "..."},
    {"number": 7, "statement": "...", "answer": "T", "explanation": "..."},
    {"number": 8, "statement": "...", "answer": "F", "explanation": "..."},
    {"number": 9, "statement": "...", "answer": "T", "explanation": "..."},
    {"number": 10, "statement": "...", "answer": "F", "explanation": "..."}
  ],
  "answer_key": "1. T  2. F  3. T  4. F  5. T  6. F  7. T  8. F  9. T  10. F",
  "english_titles": [
    "First Long Title For Exam Preparation (한글 번역)",
    "Second Title Covering the Main Theme (한글 번역)",
    "Third Title Reflecting the Author's Message (한글 번역)"
  ],
  "one_sentence_summaries": [
    {"english": "A summary using **key vocabulary** not in the original passage.", "korean": "한국어 번역"},
    {"english": "A second summary with **different bold terms**.", "korean": "한국어 번역"},
    {"english": "A third summary emphasizing **another aspect**.", "korean": "한국어 번역"}
  ],
  "vocabulary_table": [
    {"word": "English_word", "meaning": "한글뜻", "syn1": "English_syn1", "syn1_m": "한글뜻1", "syn2": "English_syn2", "syn2_m": "한글뜻2", "syn3": "English_syn3", "syn3_m": "한글뜻3", "antonym": "English_antonym", "antonym_m": "한글뜻"}
  ]
}

생성 규칙:
0. paraphrased_passage: 원문 지문을 C1 레벨 어휘(elicit, perpetuate, cognitive, nuanced, alleviate, paradigm, scrutinize, facilitate, inherent, albeit, trajectory, discern 등)로 paraphrase. 같은 내용을 다른 어휘와 구문으로 새롭게 표현. 문장 수와 전체 길이는 원문과 비슷하게 유지. 원문 어휘 그대로 복사 금지. 의역 허용.
1. korean_summary: 고등 시험대비용. 지문 종류를 먼저 파악한 후 아래 구조로 작성.
   - type 값: "일반" | "논쟁" | "문제" 중 하나를 반드시 설정.
   - rows 배열: 각 행은 label(항목명)과 content(한글 1~2문장)로 구성.
     - 일반 지문 → rows 3개: label = "핵심내용", "사례", "결론"
     - 논쟁 지문 → rows 3개: label = "주장", "근거", "결론"
     - 문제 지문 → rows 3개: label = "현상", "문제", "해결"
   - content는 각 행당 한글 1~2문장으로 명확하게 작성. 원문 직역 금지.
2. tf_questions: 본문 내용에 따라 T/F 답하는 문제. T 5개, F 5개 (반드시 동수). 영어 서술문으로 작성. 특히 본문에 사용되지 않은 어휘를 많이 활용. 괄호 없음. 번호는 1~10 숫자. ${tfLengthRule} explanation은 해당 문장이 왜 T 또는 F인지 한글 1~2문장으로 설명. 지문의 어느 내용을 근거로 판단했는지 포함.
3. answer_key: "1. T  2. F ..." 형식. 괄호 없음. 번호 복사가 깔끔하게.
4. english_titles: 지문 내용에 알맞은 영어 제목 3가지. 조금 길게 (시험 문제 대비용). 괄호 안에 한글 번역 포함. 총 3개.
5. one_sentence_summaries: 본문에 쓰이지 않은 단어만 사용. 영어 1문장 요약 3가지. 한글 번역은 괄호(( ))나 이중 괄호 없이 순수 한글 텍스트로만 작성. 요약문에서 중요 어휘는 **볼드** 처리. 한글 번역에서 중요 어휘는 *이탤릭* 처리 (별표 1개). 총 3개.
6. vocabulary_table: 지문 내에서 주제와 관련된 어휘를 10개 추출 (지문에 쓰인 어휘 그대로, 소문자 변환). 각 어휘마다 동의어 3개, 반의어 1개 생성. 모두 소문자.
   필드별 언어 규칙 (반드시 준수):
   - word: 반드시 영어 단어 (English only)
   - meaning: 반드시 한글 뜻 (Korean only)
   - syn1, syn2, syn3: 반드시 영어 유의어 (English only)
   - syn1_m, syn2_m, syn3_m: 반드시 한글 뜻 (Korean only)
   - antonym: 반드시 영어 반의어 (English only)
   - antonym_m: 반드시 한글 뜻 (Korean only)
   영어 필드에 한글 입력 금지. 한글 필드에 영어 입력 금지. 총 10행.`;
}

function extractJson(text: string): string {
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) return codeBlock[1].trim();
  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}');
  if (jsonStart !== -1 && jsonEnd !== -1) return text.slice(jsonStart, jsonEnd + 1);
  return text.trim();
}

export async function POST(request: Request) {
  try {
    const { text, difficulty, academy_id, feature_key: featureKeyParam } = await request.json() as { text: string; difficulty: string; academy_id?: string; feature_key?: string };
    const featureKey = featureKeyParam || 'pdf_analysis';
    const featureDesc = featureKey === 'mock_workbook' ? '모의고사 툴/워크북 생성' : '지문분석 툴/워크북 생성';

    if (!text || text.trim().length < 50) {
      return NextResponse.json(
        { error: '지문 텍스트가 너무 짧습니다.' },
        { status: 400 }
      );
    }

    // CON 잔액 확인 및 차감
    if (academy_id) {
      const price = await getFeaturePrice(featureKey);
      if (price > 0) {
        const balance = await getConBalance(academy_id);
        if (balance < price) {
          return NextResponse.json({ error: 'INSUFFICIENT_CON', required: price, balance }, { status: 402 });
        }
        const supabaseAdmin = createAdminClient();
        const { error: deductError } = await supabaseAdmin.rpc('deduct_con', {
          p_academy_id: academy_id,
          p_amount: price,
          p_feature_key: featureKey,
          p_description: featureDesc,
        });
        if (deductError) {
          if (deductError.message?.includes('INSUFFICIENT_CON')) {
            return NextResponse.json({ error: 'INSUFFICIENT_CON', required: price, balance }, { status: 402 });
          }
          return NextResponse.json({ error: 'CON 차감 중 오류가 발생했습니다.' }, { status: 500 });
        }
      }
    }

    console.log('[debug] KEY_PREFIX:', process.env.OPENAI_API_KEY?.slice(0, 12), '| KEY_SUFFIX:', process.env.OPENAI_API_KEY?.slice(-6), '| LENGTH:', process.env.OPENAI_API_KEY?.length);
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    const response = await client.chat.completions.create({
      model: 'gpt-5.1',
      max_completion_tokens: 8192,
      messages: [
        {
          role: 'user',
          content: buildPrompt(text, difficulty || '중'),
        },
      ],
    });

    const rawText = response.choices[0]?.message?.content ?? '';

    let data: GeneratedMaterials;
    try {
      data = JSON.parse(extractJson(rawText)) as GeneratedMaterials;
    } catch {
      console.error('[process-pdf] JSON 파싱 실패:', rawText.slice(0, 500));
      return NextResponse.json(
        { error: 'AI 응답 파싱에 실패했습니다. 다시 시도해주세요.' },
        { status: 500 }
      );
    }

    // T/F statement 130자 초과 시 단어 경계에서 강제 절단
    if (Array.isArray(data.tf_questions)) {
      data.tf_questions = data.tf_questions.map(q => {
        if (!q.statement || q.statement.length <= 130) return q;
        const cut = q.statement.slice(0, 130);
        const lastSpace = cut.lastIndexOf(' ');
        q.statement = (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[,;]$/, '') + '.';
        return q;
      });
    }

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    console.error('[process-pdf] 오류:', error);
    let message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

    if (message.includes('401') || message.includes('authentication')) {
      message = 'API 키가 올바르지 않습니다. .env.local의 OPENAI_API_KEY를 확인해주세요.';
    } else if (message.includes('429')) {
      message = 'API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.';
    } else if (message.includes('529') || message.includes('overloaded')) {
      message = 'AI 서버가 일시적으로 혼잡합니다. 잠시 후 다시 시도해주세요.';
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
