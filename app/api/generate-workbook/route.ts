import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getFeaturePrice, getConBalance } from '@/lib/credits';
import { createAdminClient } from '@/lib/supabase-admin';

export const maxDuration = 120;

export type WorkbookType =
  | 'vocab_choice'
  | 'vocab_fill'
  | 'grammar_choice'
  | 'grammar_correct'
  | 'grammar_correct_adv'
  | 'translation'
  | 'word_order'
  | 'english_writing'
  | 'passage_translation'
  | 'paragraph_order'
  | 'sentence_insertion'
  | 'suneung_vocab_right'
  | 'suneung_vocab_wrong'
  | 'suneung_grammar_right'
  | 'suneung_grammar_wrong'
  | 'combo_vocab_grammar'
  | 'combo_vocab_fill'
  | 'combo_grammar_order'
  | 'combo_grammar_insert';

const DIFF_GUIDE: Record<string, string> = {
  b1: '중등~고등 하 수준',
  b2: '고등 중 수준',
  c1: '고등 상 수준',
  c2: '고등 최상/수능 상위권 수준',
};

function buildPrompt(text: string, type: WorkbookType, difficulty: string): string {
  const diff = `${difficulty} (${DIFF_GUIDE[difficulty] || DIFF_GUIDE['b2']})`;
  const header = (title: string) =>
    `당신은 한국 영어학원의 전문 영어 교사 AI입니다.\n[필수 원칙] 원본 지문을 절대 변형하지 마세요.\n\n${title}\n난이도: ${diff}\n\n=== 영어 지문 ===\n${text}\n=== 지문 끝 ===\n\n`;

  switch (type) {

    // ── 어휘 선택 ────────────────────────────────────────────────────────────
    case 'vocab_choice':
      return header('아래 영어 지문으로 어휘 선택 문제를 생성하세요.') +
`[핵심 규칙] 각 문장마다 반드시 정확히 3개의 어휘 선택지를 삽입해야 합니다.
문장이 10개이면 선택지는 반드시 총 30개입니다. 이 규칙을 절대 어기지 마세요.

생성 규칙:
1. 지문의 모든 문장에서 각 문장마다 정확히 3개의 어휘/표현을 선택합니다.
   - 단어 수가 적은 짧은 문장도 반드시 3개를 선택해야 합니다.
   - 관사(a/an/the), 접속사(and/but/or), be동사(is/are/was)는 가급적 제외합니다.
   - 대신 명사, 동사, 형용사, 부사, 전치사를 우선 선택합니다.
2. 각 위치에 번호[어휘A / 어휘B] 형식으로 선택지 2개만 만듭니다. (정답 1개 + 오답 1개)
3. 오답은 반드시 정답과 품사가 동일해야 하며, 문맥상 어울리지 않는 단어를 사용합니다.
   - 명사 ↔ 명사, 동사 ↔ 동사, 형용사 ↔ 형용사, 부사 ↔ 부사, 전치사 ↔ 전치사
   - 반의어, 동의어 혼동 쌍, 철자 유사 혼동 쌍을 우선 활용합니다.
4. 원문 문장 구조와 단어를 그대로 유지합니다. 문장 어순 변경 금지.
5. 선택 어휘 위치에만 번호와 대괄호를 삽입합니다. 나머지 텍스트는 원문 그대로.
6. 정답이 앞 선택지(A)와 뒤 선택지(B)에 고르게 분포되도록 합니다. (약 50:50)

중요: 선택지는 반드시 영어 단어로만 작성합니다. 한국어 번역 절대 금지.
출력 형식 (순수 JSON만, 마크다운 코드블록 없이):
{
  "passage": "Video gaming is 1[one / none] of the 2[most / least] studied 3[topics / methods] in the field. It 4[has / lacks] attracted ...",
  "answer_key": "1. one  2. most  3. topics  4. has ..."
}`;

    // ── 어휘 완성 ────────────────────────────────────────────────────────────
    case 'vocab_fill':
      return header('아래 영어 지문으로 어휘 완성(빈칸 채우기) 문제를 생성하세요.') +
`생성 규칙:
1. 지문을 문장 단위로 분리합니다.
2. 각 문장마다 핵심 어휘 2~4개를 빈칸으로 만듭니다. 빈칸 형식: _(N:X)_
   - N: 전체 지문에서의 빈칸 번호 (1부터 순서대로)
   - X: 정답 단어의 첫 번째 알파벳 소문자 (힌트)
   - 예시: "Rapunzel was a _(1:l)_ girl _(2:w)_ was _(3:l)_ up in a tower by an old _(4:w)_."
3. 각 문장에 대해 자연스러운 한국어 번역을 작성합니다.
4. 원문 단어/어순은 그대로 유지합니다. 빈칸 처리된 단어만 _(N:X)_ 형식으로 교체합니다.
5. 관사(a, an, the), 전치사(of, in, at), be동사(is, are, was)는 빈칸 대상에서 제외합니다.
6. 핵심 명사, 동사, 형용사, 부사를 우선 빈칸으로 선택합니다.
7. answer_key에는 모든 빈칸 번호와 정답 단어를 나열합니다.

출력 형식 (순수 JSON만, 마크다운 코드블록 없이):
{
  "sentences": [
    { "en": "원문 문장 (_(1:l)_ _(2:w)_ 형식 빈칸 포함)", "ko": "자연스러운 한국어 번역" },
    { "en": "다음 문장 (_(3:v)_ 형식)", "ko": "한국어 번역" }
  ],
  "answer_key": "1. long-haired  2. who  3. visited ..."
}`;

    // ── 어법 선택 ────────────────────────────────────────────────────────────
    case 'grammar_choice':
      return header('아래 영어 지문으로 어법 선택 문제를 생성하세요.') +
`생성 규칙:
1. 각 문장마다 2~3개의 어법 포인트를 선택하여 선택지로 만듭니다. 전체 20~30개.
   포인트 유형: to부정사/동명사, 능동/수동, 주어-동사 수 일치, 관계사(who/whose/which/that),
   접속사, 형용사/부사, 시제, 전치사, 현재분사/과거분사 등
2. 각 위치에 반드시 숫자[형태A / 형태B] 형식으로 표시합니다. 선택지는 2개입니다.
   ⚠️ 반드시 숫자가 먼저, 대괄호가 그 뒤에 옵니다: 1[who / whose] ← 올바름
   ⚠️ [1. who / whose] 형식은 절대 금지입니다.
3. 오답은 어법적으로 명확히 틀린 형태여야 합니다.
4. 정답이 1번째 선택지인 경우와 2번째 선택지인 경우를 50:50으로 균등 배분합니다.
5. 원문 문장의 단어는 선택지 삽입 부분 외에 절대 변경하지 않습니다.

중요: 선택지는 반드시 영어 단어/형태로만 작성합니다. 한국어 절대 금지.
출력 형식 (순수 JSON만, 반드시 1[opt / opt] 형식 준수):
{
  "passage": "어법 선택지가 삽입된 지문 — 형식 예시: ...he 1[who / whose] runs... 2[is / are] known...",
  "answer_key": "1. who  2. is ..."
}`;

    // ── 어법 수정 ────────────────────────────────────────────────────────────
    case 'grammar_correct':
      return header('아래 영어 지문으로 어법 수정 문제를 만드세요.') +
`생성 규칙:
1. 각 문장에서 어법 오류를 정확히 3개 삽입합니다. 전체 25~35개.
   오류 유형: 동사 형태(능동↔수동, 현재분사↔과거분사), to부정사↔동명사, 관계사(who/whose/which/that),
   형용사↔부사, 수 일치, 시제, 전치사 등
2. 틀린 단어는 반드시 번호[틀린단어] 형식으로 표시합니다.
   ⚠️ 반드시 단어 1개만 대괄호 안에 넣습니다. (예: 1[whose], 2[locking], 3[has])
   ⚠️ 구(phrase)나 여러 단어를 괄호 안에 넣는 것은 절대 금지입니다. (예: 1[to the purpose] ← 금지)
3. 번호[단어]로 표시된 단어는 모두 틀린 어법입니다. 학생은 전부 올바른 형태로 수정합니다.
4. 번호[단어] 외의 나머지 원문 단어는 절대 변경하지 않습니다.
5. 오류 위치가 지문 전체에 고르게 분산되어야 합니다.
6. 문장당 반드시 3개 — 2개나 4개 삽입 금지.

출력 형식 (순수 JSON만):
{
  "passage": "문장마다 단어 1개씩, 정확히 3개 오류 삽입 (1[단어] 형식, 전체 25~35개)",
  "answer_key": "1. 틀린단어 → 바른단어  2. 틀린단어 → 바른단어 ..."
}`;

    // ── 어법 수정(상) ────────────────────────────────────────────────────────
    case 'grammar_correct_adv':
      return header('아래 영어 지문으로 심화 어법 수정 문제를 만드세요.') +
`생성 규칙:
1. 지문을 문장 단위로 분리합니다 (10~20문장).
2. 각 문장마다 2~3개의 어법 오류를 의도적으로 삽입합니다.
   오류 유형: 동사 형태(능동↔수동, 현재분사↔과거분사), to부정사↔동명사, 관계사(who/whose/which/that),
   형용사↔부사, 수 일치, 시제, 전치사, 분사구문, 비교급/최상급 오류 등
3. 오류가 삽입된 문장을 그대로 제시합니다. 오류 위치를 표시하지 않습니다.
4. 학생은 각 문장에서 틀린 어법을 스스로 찾아 수정해야 합니다.
5. 정답은 문장 번호별로 "틀린단어→바른단어" 형식으로 나열합니다.

출력 형식 (순수 JSON만):
{
  "sentences": [
    { "num": 1, "text": "오류가 포함된 문장 원문 (표시 없이 그대로)" },
    { "num": 2, "text": "오류가 포함된 문장 원문" }
  ],
  "answer_key": "1. whose→who, locking→locked  2. coming→came, visiting→visit ..."
}`;

    // ── 해석하기 ─────────────────────────────────────────────────────────────
    case 'translation':
      return header('아래 영어 지문으로 해석 연습 문제를 생성하세요.') +
`생성 규칙:
1. 지문을 문장 단위로 분리합니다 (10~15문장).
2. 각 문장에 번호를 붙입니다.
3. 영어 원문을 절대 바꾸지 말고, 자연스러운 한국어 해석을 제공합니다.

출력 형식 (순수 JSON만):
{
  "sentences": [
    { "num": 1, "en": "원문 영어 문장.", "ko": "자연스러운 한국어 해석." },
    ...
  ]
}`;

    // ── 낱말 배열 ────────────────────────────────────────────────────────────
    case 'word_order':
      return header('아래 영어 지문으로 낱말 배열 문제를 생성하세요.') +
`생성 규칙:
1. 10~12문장을 선택합니다 (어순 배열이 의미 있는 복문/구조 우선).
2. 각 문장을 단어 단위로 분리하여 순서를 무작위로 섞습니다.
3. 마침표/쉼표는 인접한 단어에 붙인 채로 포함합니다.
4. 문제: 한국어 뜻 + 섞인 단어 목록 → 학생이 영어 문장 완성.
5. 원문 영어 문장은 절대 변형하지 않습니다.

출력 형식 (순수 JSON만):
{
  "sentences": [
    { "num": 1, "ko": "한국어 뜻", "scrambled": ["word3", "word1,", "word2"], "answer": "word1 word2 word3," },
    ...
  ]
}`;

    // ── 영작하기 ─────────────────────────────────────────────────────────────
    case 'english_writing':
      return header('아래 영어 지문으로 영작하기 문제를 생성하세요.') +
`생성 규칙:
1. 10~12문장을 선택합니다.
2. 한국어 번역을 제시하고 학생이 원본 영어 문장을 영작합니다.
3. 힌트: 각 문장의 첫 단어와 마지막 단어를 제공합니다.
4. 원문 영어 문장은 절대 변형하지 않습니다.

출력 형식 (순수 JSON만):
{
  "sentences": [
    { "num": 1, "ko": "한국어 문장", "hint_start": "첫단어", "hint_end": "마지막단어.", "answer": "원본 영어 문장." },
    ...
  ]
}`;

    // ── 본문 해석지 ──────────────────────────────────────────────────────────
    case 'passage_translation':
      return header('아래 영어 지문으로 본문 해석지를 생성하세요.') +
`생성 규칙:
1. 지문 전체를 문장 단위로 분리합니다. 영어 원문은 절대 변형하지 않습니다.
2. 각 문장에서 핵심 어휘(학생이 알아야 할 중요 단어) 1~3개를 key_words로 지정합니다.
   key_words는 원문에 나오는 단어 형태 그대로 (원형 아님).
3. 지문 전체에서 핵심 어휘 15~25개를 추출하여 vocab_table을 만듭니다.
   vocab_table 각 항목: 원형(표제어), 뜻, 유의어 3개(+뜻), 반의어 1개(+뜻).
   유의어/반의어가 없거나 부적절하면 빈 문자열("")로 둡니다.

출력 형식 (순수 JSON만):
{
  "sentences": [
    {
      "en": "원문 영어 문장.",
      "ko": "자연스러운 한국어 해석.",
      "key_words": ["locked", "tower"]
    }
  ],
  "vocab_table": [
    {
      "word": "lock", "meaning": "잠그다; 갇히다",
      "syn1": "confine", "syn1_m": "가두다",
      "syn2": "imprison", "syn2_m": "감금하다",
      "syn3": "trap", "syn3_m": "가두다",
      "antonym": "free", "antonym_m": "자유롭게 하다"
    }
  ]
}`;

    // ── 문단 배열 ────────────────────────────────────────────────────────────
    case 'paragraph_order':
      return header('아래 영어 지문으로 문단 배열 문제를 생성하세요.') +
`생성 규칙:
1. 지문을 3~5개 단락(paragraph)으로 나눕니다.
2. 첫 번째 단락은 고정 제시합니다 (문두 단락).
3. 나머지 단락을 (A), (B), (C) 등으로 레이블 붙이고 순서를 섞어 제시합니다.
4. 각 단락의 문장은 원본 그대로 유지합니다.
5. 학생이 올바른 순서를 찾아 씁니다.

출력 형식 (순수 JSON만):
{
  "fixed_paragraph": "첫 번째 단락 원문 (변형 금지)",
  "shuffled_paragraphs": [
    { "label": "A", "text": "단락 원문" },
    { "label": "B", "text": "단락 원문" },
    { "label": "C", "text": "단락 원문" }
  ],
  "answer_key": "올바른 순서: (B) - (C) - (A)"
}`;

    // ── 문장 삽입 ────────────────────────────────────────────────────────────
    case 'sentence_insertion':
      return header('아래 영어 지문으로 문장 삽입 문제를 생성하세요.') +
`[핵심 원칙] 원지문의 단어·문장·표현을 절대 변형하지 마세요. 삽입할 문장 제거 및 ①~⑤ 기호 삽입 외에 어떤 수정도 금지합니다.

생성 규칙:
1. 지문에서 삽입하기 좋은 문장 1개를 원문 그대로 선택합니다. (접속어/대명사 연결이 자연스러운 문장 우선)
2. 해당 문장을 지문에서 제거하고, 나머지 지문의 문장은 원문 그대로 유지합니다.
3. 제거된 문장이 있던 위치를 포함하여 문장 사이 5곳에 ①②③④⑤를 배치합니다.
4. ①~⑤ 기호는 문장 사이에 넣습니다 (예: "문장A. ② 문장B.").
5. 정답이 ①이나 ⑤에만 몰리지 않도록 합니다.

출력 형식 (순수 JSON만):
{
  "insert_sentence": "삽입할 문장 원문 그대로",
  "passage": "①②③④⑤ 기호가 삽입된 지문 (나머지 원문 그대로)",
  "answer_key": "정답: ③"
}`;

    // ── 적절한 어휘 (수능형) ─────────────────────────────────────────────────
    case 'suneung_vocab_right':
      return header('아래 영어 지문으로 수능형 "(A)(B)(C)의 각 [ ] 안에서 문맥에 맞는 어휘로 가장 적절한 것을 고르시오" 문제를 생성하세요.') +
`생성 규칙:
1. 지문에서 어휘 대조 위치 3곳을 선정하여 (A)(B)(C)로 표시합니다.
2. 각 위치에 (A)[단어1 / 단어2] 형식으로 두 어휘 선택지를 제공합니다.
   - 정답: 문맥에 적절한 단어  /  오답: 반의어, 혼동어, 또는 의미상 부자연스러운 단어
   - 예: (A)[asked / assigned], (B)[less / more], (C)[truth / lie]
3. ①~⑤ 보기 5개를 (A)(B)(C) 조합으로 구성합니다.
   - 정답 조합이 반드시 1개 포함되어야 합니다.
   - 나머지 4개는 (A)(B)(C) 중 하나 이상 오답이 섞인 조합입니다.
4. 원문 문장은 선택지 삽입 위치 외에 절대 변경하지 않습니다.

출력 형식 (순수 JSON만):
{
  "passage": "지문 — (A)[asked / assigned] 형식으로 삽입. 예: She (A)[asked / assigned] him.",
  "choices": [
    {"label": "①", "A": "word_a1", "B": "word_b1", "C": "word_c1"},
    {"label": "②", "A": "word_a2", "B": "word_b2", "C": "word_c2"},
    {"label": "③", "A": "word_a3", "B": "word_b3", "C": "word_c3"},
    {"label": "④", "A": "word_a4", "B": "word_b4", "C": "word_c4"},
    {"label": "⑤", "A": "word_a5", "B": "word_b5", "C": "word_c5"}
  ],
  "answer_key": "⑤"
}`;

    // ── 부적절한 어휘 (수능형) ──────────────────────────────────────────────
    case 'suneung_vocab_wrong':
      return header('아래 영어 지문으로 수능형 "밑줄 친 단어 중 문맥상 낱말의 쓰임이 적절하지 않은 것" 문제를 생성하세요.') +
`생성 규칙:
1. 5개의 단어 위치를 선정하여 ①②③④⑤로 표시합니다.
2. 4개는 원문의 적절한 단어 그대로 유지, 1개만 문맥상 부적절한 단어로 교체합니다.
3. 교체 시 반의어, 혼동어(예: increase↔decrease, accept↔reject)를 사용합니다.
4. 오류 위치는 ①~⑤ 고르게 분산합니다.
5. 나머지 문장은 원본 그대로 유지합니다.

출력 형식 (순수 JSON만):
{
  "passage": "①~⑤ 표시가 있는 지문. 부적절한 단어 1개 포함.",
  "answer_key": "정답: ③ (틀린단어 → 적절한단어로 수정)"
}`;

    // ── 맞는 어법 (수능형) ──────────────────────────────────────────────────
    case 'suneung_grammar_right':
      return header('아래 영어 지문으로 수능형 "어법상 적절한 것을 고르시오 (A)(B)(C)" 문제를 생성하세요.') +
`생성 규칙:
1. 3개 위치에 (A)(B)(C)를 표시하고 각각 두 어법 선택지를 제공합니다.
2. 선택지 예: (A) [ to go / going ], (B) [ which / what ], (C) [ is / are ]
3. 원본 지문의 어법에 맞는 형태가 정답이어야 합니다.
4. 오답은 어법적으로 명확히 틀린 형태를 사용합니다.
5. 나머지 문장은 원본 그대로 유지합니다.

출력 형식 (순수 JSON만):
{
  "passage": "(A)[ to go / going ] 형식이 삽입된 지문",
  "answer_key": "(A) to go, (B) which, (C) are"
}`;

    // ── 틀린 어법 (수능형) ──────────────────────────────────────────────────
    case 'suneung_grammar_wrong':
      return header('아래 영어 지문으로 수능형 "어법상 틀린 것을 고르시오 ①~⑤" 문제를 생성하세요.') +
`생성 규칙:
1. 5개 위치에 ①~⑤ 번호를 붙입니다.
2. 4개는 원본 어법상 맞는 표현 그대로 유지, 1개만 어법 오류로 교체합니다.
3. 오류 유형: 동사 형태, 수 일치, 분사, 관계사, to부정사/동명사 혼동
4. 오류 위치는 ①~⑤ 고르게 분산합니다.
5. 나머지 문장은 원본 그대로 유지합니다.

출력 형식 (순수 JSON만):
{
  "passage": "①~⑤ 번호가 붙은 지문. 어법 오류 1개 포함.",
  "answer_key": "정답: ③ (틀린표현 → 올바른표현으로 수정)"
}`;

    // ── 1지문 2유형: 어휘+어법 ──────────────────────────────────────────────
    case 'combo_vocab_grammar':
      return header('아래 영어 지문으로 어휘 선택 문제와 어법 선택 문제를 동시에 생성하세요.') +
`섹션1 (어휘 선택):
- 12~15개 핵심 어휘 위치에 번호[A/B/C] 형식으로 선택지 삽입.
- 정답 위치 균등 분산.

섹션2 (어법 선택):
- 어법 포인트 10~12개에 번호[형태A/형태B] 형식으로 선택지 삽입.
- 섹션1과 다른 위치에서 선택.

원본 지문을 절대 변형하지 마세요.

출력 형식 (순수 JSON만):
{
  "section1": {
    "passage": "어휘 선택지 삽입 지문 (1[A/B/C] 형식)",
    "answer_key": "1. 정답  2. 정답 ..."
  },
  "section2": {
    "passage": "어법 선택지 삽입 지문 (1[형태A/형태B] 형식)",
    "answer_key": "1. 정답형태  2. 정답형태 ..."
  }
}`;

    // ── 1지문 2유형: 어휘+문장완성 ─────────────────────────────────────────
    case 'combo_vocab_fill':
      return header('아래 영어 지문으로 어휘 선택 문제와 어휘 완성(빈칸) 문제를 동시에 생성하세요.') +
`섹션1 (어휘 선택): 12~15개 어휘 선택지 (번호[A/B/C] 형식).
섹션2 (어휘 완성): 10~13개 빈칸 (_(번호)_ 형식) + 보기 단어 박스.

원본 지문을 절대 변형하지 마세요.

출력 형식 (순수 JSON만):
{
  "section1": {
    "passage": "어휘 선택지 삽입 지문",
    "answer_key": "1. 정답  2. 정답 ..."
  },
  "section2": {
    "passage": "빈칸 삽입 지문 (_(1)_ 형식)",
    "word_bank": ["word1", "word2", ...],
    "answer_key": "1. word  2. word ..."
  }
}`;

    // ── 1지문 2유형: 어법+문장배열 ─────────────────────────────────────────
    case 'combo_grammar_order':
      return header('아래 영어 지문으로 어법 수정 문제와 낱말 배열 문제를 동시에 생성하세요.') +
`섹션1 (어법 수정): 5~7개 어법 오류 삽입 (①[틀린단어] 형식).
섹션2 (낱말 배열): 8~10문장 선택 → 단어 순서 섞기.

원본 지문을 절대 변형하지 마세요.

출력 형식 (순수 JSON만):
{
  "section1": {
    "passage": "오류 삽입 지문 (①[틀린단어] 형식)",
    "answer_key": "① 틀린 → 바른\\n② 틀린 → 바른 ..."
  },
  "section2": {
    "sentences": [
      { "num": 1, "ko": "한국어 뜻", "scrambled": ["w3","w1","w2"], "answer": "w1 w2 w3" }
    ]
  }
}`;

    // ── 1지문 2유형: 어법+문장삽입 ─────────────────────────────────────────
    case 'combo_grammar_insert':
      return header('아래 영어 지문으로 어법 선택 문제와 문장 삽입 문제를 동시에 생성하세요.') +
`섹션1 (어법 선택): 12~15개 어법 포인트에 번호[형태A/형태B] 삽입.
섹션2 (문장 삽입): 적절한 문장 1개 제거 → ①②③④⑤ 삽입 위치 표시.

원본 지문을 절대 변형하지 마세요.

출력 형식 (순수 JSON만):
{
  "section1": {
    "passage": "어법 선택지 삽입 지문",
    "answer_key": "1. 정답  2. 정답 ..."
  },
  "section2": {
    "insert_sentence": "삽입할 문장",
    "passage": "①~⑤ 표시 지문",
    "answer_key": "정답: ②"
  }
}`;

    default:
      return header('아래 영어 지문으로 어휘 선택 문제를 생성하세요.') +
`출력 형식: { "passage": "...", "answer_key": "..." }`;
  }
}

function extractJson(text: string): string {
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) return codeBlock[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1) return text.slice(start, end + 1);
  return text.trim();
}

// 어휘 선택 정답 위치 균등 분산 (기존 로직 재사용)
function redistributeVocabAnswers(passage: string, answerKey: string): string {
  const choiceRegex = /(\d+)\[([^\]]+)\]/g;
  type ItemInfo = { fullMatch: string; num: number; opts: string[]; answerIdx: number };
  const items: ItemInfo[] = [];
  const answerMap: Record<number, string> = {};

  const keyParts = answerKey.split(/\d+\.\s*/g).filter(Boolean);
  const nums = [...answerKey.matchAll(/(\d+)\./g)].map(m => parseInt(m[1]));
  nums.forEach((n, i) => { answerMap[n] = (keyParts[i] || '').trim().split(/\s+/)[0]; });

  let match: RegExpExecArray | null;
  const regex = new RegExp(choiceRegex.source, 'g');
  while ((match = regex.exec(passage)) !== null) {
    const num = parseInt(match[1]);
    const opts = match[2].split(/\s*\/\s*/).map(o => o.trim());
    const ans = answerMap[num] || '';
    const answerIdx = opts.findIndex(o => o.toLowerCase() === ans.toLowerCase());
    if (answerIdx >= 0) items.push({ fullMatch: match[0], num, opts, answerIdx });
  }
  if (items.length === 0) return passage;

  const total = items.length;
  const perSlot = Math.ceil(total / 3);
  const targets: number[] = [];
  for (let p = 0; p < 3; p++) for (let k = 0; k < perSlot && targets.length < total; k++) targets.push(p);
  for (let i = targets.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [targets[i], targets[j]] = [targets[j], targets[i]];
  }

  let newPassage = passage;
  items.forEach((item, idx) => {
    const tp = targets[idx];
    if (item.answerIdx === tp) return;
    const newOpts = [...item.opts];
    [newOpts[item.answerIdx], newOpts[tp]] = [newOpts[tp], newOpts[item.answerIdx]];
    newPassage = newPassage.replace(item.fullMatch, `${item.num}[${newOpts.join(' / ')}]`);
  });
  return newPassage;
}

export async function POST(request: Request) {
  try {
    const { passages, type, tab, difficulty, academy_id } = await request.json() as {
      passages: string[];
      type: WorkbookType;
      tab?: 'input' | 'mock';
      difficulty?: string;
      academy_id?: string;
    };
    const featureKey = `${(tab ?? 'input') === 'input' ? 'wb_direct' : 'wb_mock'}_${type}`;

    if (!passages || passages.length === 0) {
      return NextResponse.json({ error: '지문을 입력해주세요.' }, { status: 400 });
    }
    const validPassages = passages.filter(p => p && p.trim().length >= 50);
    if (validPassages.length === 0) {
      return NextResponse.json({ error: '지문이 너무 짧습니다. (최소 50자)' }, { status: 400 });
    }

    // CON 차감: 지문 수 × 단가
    if (academy_id) {
      const price = await getFeaturePrice(featureKey);
      const totalCost = price * validPassages.length;
      if (totalCost > 0) {
        const balance = await getConBalance(academy_id);
        if (balance < totalCost) {
          return NextResponse.json({ error: 'INSUFFICIENT_CON', required: totalCost, balance }, { status: 402 });
        }
        const db = createAdminClient();
        const { error: deductError } = await db.rpc('deduct_con', {
          p_academy_id: academy_id,
          p_amount: totalCost,
          p_feature_key: featureKey,
          p_description: `워크북 생성 (${type} × ${validPassages.length}지문)`,
        });
        if (deductError) {
          if (deductError.message?.includes('INSUFFICIENT_CON')) {
            const balance2 = await getConBalance(academy_id);
            return NextResponse.json({ error: 'INSUFFICIENT_CON', required: totalCost, balance: balance2 }, { status: 402 });
          }
          return NextResponse.json({ error: 'CON 차감 중 오류가 발생했습니다.' }, { status: 500 });
        }
      }
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    const diff = difficulty || 'b2';

    // 지문별 순차 생성
    const results: unknown[] = [];
    for (const text of validPassages) {
      const prompt = buildPrompt(text.trim(), type, diff);
      const response = await client.chat.completions.create({
        model: 'gpt-4.1-mini',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      });
      const rawText = response.choices[0]?.message?.content ?? '';
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(extractJson(rawText)) as Record<string, unknown>;
      } catch {
        results.push({ error: 'AI 응답 파싱 실패. 다시 시도해주세요.' });
        continue;
      }

      // 어휘 선택 계열 정답 분산 후처리
      if (type === 'vocab_choice' && parsed.passage && parsed.answer_key) {
        parsed.passage = redistributeVocabAnswers(parsed.passage as string, parsed.answer_key as string);
      }
      if (type === 'grammar_choice' && parsed.passage) {
        // AI가 [1. opt / opt] 포맷으로 생성할 때 → 1[opt / opt] 로 정규화
        parsed.passage = (parsed.passage as string).replace(/\[(\d+)\.\s*([^\]]+)\]/g, '$1[$2]');
        if (parsed.answer_key) {
          parsed.passage = redistributeVocabAnswers(parsed.passage as string, parsed.answer_key as string);
        }
      }
      if (type === 'combo_vocab_grammar') {
        const s1 = parsed.section1 as Record<string, unknown>;
        if (s1?.passage && s1?.answer_key) {
          s1.passage = redistributeVocabAnswers(s1.passage as string, s1.answer_key as string);
        }
      }

      results.push({ ...parsed, _original_text: text.trim() });
    }

    return NextResponse.json({ success: true, type, results });
  } catch (error: unknown) {
    console.error('[generate-workbook] 오류:', error);
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
