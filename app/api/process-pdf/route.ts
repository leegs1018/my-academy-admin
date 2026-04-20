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

interface KoreanSummaryRow {
  label: string;
  content: string;
}

interface KoreanSummary {
  type: '일반' | '논쟁' | '문제';
  rows: KoreanSummaryRow[];
}

interface GeneratedMaterials {
  tf_questions: TFQuestion[];
  answer_key: string;
  korean_summary: KoreanSummary;
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
아래 영어 지문을 분석하여 5가지 교육 자료를 생성해주세요.

난이도: ${difficulty} (${difficultyGuide[difficulty] || difficultyGuide['중']})

=== 영어 지문 ===
${text}
=== 지문 끝 ===

반드시 아래 JSON 형식으로만 반환하세요. 마크다운 코드블록 없이 순수 JSON만 출력하세요.

{
  "korean_summary": {
    "type": "일반",
    "rows": [
      {"label": "핵심내용", "content": "한글로 핵심 내용 1~2문장"},
      {"label": "사례", "content": "한글로 사례 1~2문장"},
      {"label": "결론", "content": "한글로 결론 1문장"}
    ]
  },
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
1. korean_summary: 고등 시험대비용. 지문 종류를 먼저 파악한 후 아래 구조로 작성.
   - type 값: "일반" | "논쟁" | "문제" 중 하나를 반드시 설정.
   - rows 배열: 각 행은 label(항목명)과 content(한글 1~2문장)로 구성.
     - 일반 지문 → rows 3개: label = "핵심내용", "사례", "결론"
     - 논쟁 지문 → rows 3개: label = "주장", "근거", "결론"
     - 문제 지문 → rows 3개: label = "현상", "문제", "해결"
   - content는 각 행당 한글 1~2문장으로 명확하게 작성. 원문 직역 금지.
2. tf_questions: 본문 내용에 따라 T/F 답하는 문제. T 5개, F 5개 (반드시 동수). 영어 서술문으로 작성. 특히 본문에 사용되지 않은 어휘를 많이 활용. 괄호 없음. 번호는 1~10 숫자.
3. answer_key: "1. T  2. F ..." 형식. 괄호 없음. 번호 복사가 깔끔하게.
4. english_titles: 지문 내용에 알맞은 영어 제목 3가지. 조금 길게 (시험 문제 대비용). 괄호 안에 한글 번역 포함. 총 3개.
5. one_sentence_summaries: 본문에 쓰이지 않은 단어만 사용. 영어 1문장 요약 3가지. 한글 번역도 괄호 안에 포함. 요약문에서 중요 어휘는 **볼드** 처리. 총 3개.
6. vocabulary_table: 지문 내에서 주제와 관련된 어휘를 10개 추출 (지문에 쓰인 어휘 그대로, 소문자 변환). 각 어휘마다 동의어 3개, 반의어 1개 생성. 한글 뜻 포함. 모두 소문자. 형식: word ( 한글뜻 ) — 괄호 안 양쪽에 한 칸 공백. 총 10행 × (표제어+동의어3+반의어1) = 50항목, 동의어+반의어만 합산 시 40개.`;
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
