import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export const maxDuration = 60;

interface TFQuestion {
  number: number;
  statement: string;
  answer: 'T' | 'F';
}

interface VocabRow {
  word: string;
  meaning: string;
  syn1: string; syn1_m: string;
  syn2: string; syn2_m: string;
  syn3: string; syn3_m: string;
  antonym: string; antonym_m: string;
}

interface GeneratedMaterials {
  summaries: string[];
  tf_questions: TFQuestion[];
  answer_key: string;
  korean_summary: string;
  english_titles: string[];
  one_sentence_summaries: { english: string; korean: string }[];
  vocabulary_table: VocabRow[];
}

function buildPrompt(text: string, difficulty: string): string {
  const difficultyGuide: Record<string, string> = {
    '상': '수능/내신 상위권 수준. 고급 어휘와 복잡한 구문 사용.',
    '중': '일반 고등학교 내신 수준. 중간 난이도 어휘 사용.',
    '하': '중학교~고등학교 초급 수준. 기본 어휘 위주로 사용.',
  };

  return `당신은 한국 영어학원의 전문 영어 교사 AI입니다.
아래 영어 지문을 분석하여 6가지 교육 자료를 생성해주세요.

난이도: ${difficulty} (${difficultyGuide[difficulty] || difficultyGuide['중']})

=== 영어 지문 ===
${text}
=== 지문 끝 ===

반드시 아래 JSON 형식으로만 반환하세요. 마크다운 코드블록 없이 순수 JSON만 출력하세요.

{
  "summaries": [
    "Summary 1 - medium length (3~5 sentences) using words from the passage",
    "Summary 2 - medium length (3~5 sentences) using words from the passage (different perspective)"
  ],
  "tf_questions": [
    {"number": 1, "statement": "English statement using vocabulary NOT in the passage", "answer": "T"},
    {"number": 2, "statement": "...", "answer": "F"},
    {"number": 3, "statement": "...", "answer": "T"},
    {"number": 4, "statement": "...", "answer": "F"},
    {"number": 5, "statement": "...", "answer": "T"},
    {"number": 6, "statement": "...", "answer": "F"},
    {"number": 7, "statement": "...", "answer": "T"},
    {"number": 8, "statement": "...", "answer": "F"},
    {"number": 9, "statement": "...", "answer": "T"},
    {"number": 10, "statement": "...", "answer": "F"}
  ],
  "answer_key": "1. T  2. F  3. T  4. F  5. T  6. F  7. T  8. F  9. T  10. F",
  "korean_summary": "1. 핵심 주장:\\n- (한 문장. 글 전체를 관통하는 주장)\\n\\n2. 관계의 본질:\\n- (글에서 설명하는 대상 간의 관계 정의. 관계의 성격 설명. 필요시 비유 포함)\\n\\n3. 글쓴이의 비판:\\n- (글쓴이가 문제 삼는 대상 또는 태도. 무엇을 비판하는지 + 왜 문제인지)",
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
    {"word": "표제어", "meaning": "한글뜻", "syn1": "유의어1", "syn1_m": "뜻", "syn2": "유의어2", "syn2_m": "뜻", "syn3": "유의어3", "syn3_m": "뜻", "antonym": "반의어", "antonym_m": "뜻"}
  ]
}

생성 규칙:
1. summaries: 반드시 지문에 나온 단어를 그대로 활용. 각 3~5문장 중간 길이. 2가지 다른 관점. 영어로 작성.
2. tf_questions: T 5개, F 5개 (반드시 동수). 지문에 없는 어휘로 영어 서술문 작성. 괄호 없음. 번호는 1~10 숫자.
3. answer_key: "1. T  2. F ..." 형식. 괄호 없음. 번호 복사가 깔끔하게.
4. korean_summary: 반드시 아래 3개 항목을 모두 포함할 것.
   - "1. 핵심 주장:" : 한 문장. 글 전체를 관통하는 주장만.
   - "2. 관계의 본질:" : 대상 간 관계의 성격 정의. 단순 요약 금지. 필요시 비유 포함.
   - "3. 글쓴이의 비판:" : 비판 대상 + 왜 문제인지 포함.
   - 각 항목 2~3문장 이내. 원문 직역 금지, 의미 요약. 추상적 표현 금지.
5. english_titles: 10단어 이상의 시험 대비용 긴 제목. 괄호 안에 한글 번역 포함. 총 3개.
6. one_sentence_summaries: 지문에 없는 단어만 사용. 핵심 어휘는 **볼드** 처리. 총 3개. 영어+한국어.
7. vocabulary_table: 지문의 핵심 어휘 10개. 모두 소문자. 뜻은 한국어 1~2단어. word (의미), syn1 (의미), syn2 (의미), syn3 (의미), antonym (의미) 가로 표 형식.`;
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
    const { text, difficulty } = await request.json() as { text: string; difficulty: string };

    if (!text || text.trim().length < 50) {
      return NextResponse.json(
        { error: '지문 텍스트가 너무 짧습니다.' },
        { status: 400 }
      );
    }

    console.log('[debug] KEY_PREFIX:', process.env.OPENAI_API_KEY?.slice(0, 12), '| KEY_SUFFIX:', process.env.OPENAI_API_KEY?.slice(-6), '| LENGTH:', process.env.OPENAI_API_KEY?.length);
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 8192,
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
