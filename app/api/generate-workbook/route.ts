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
  | 'summary_sentence'
  | 'passage_analysis'
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
1. 각 문장마다 반드시 3개의 어법 포인트를 선택하여 선택지로 만듭니다. 전체 25~35개.
   ⚠️ 문장당 정확히 3개 — 2개나 1개 금지. 8문장 지문이면 24개 생성.
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
1. 지문의 모든 문장 각각에 어법 오류를 정확히 3개씩 삽입합니다.
   오류 유형: 동사 형태(능동↔수동, 현재분사↔과거분사), to부정사↔동명사, 관계사(who/whose/which/that),
   형용사↔부사, 수 일치, 시제, 전치사 등
2. 틀린 단어는 반드시 번호[틀린단어] 형식으로 표시합니다.
   ⚠️ 반드시 단어 1개만 대괄호 안에 넣습니다. (예: 1[whose], 2[locking], 3[has])
   ⚠️ 구(phrase)나 여러 단어를 괄호 안에 넣는 것은 절대 금지입니다. (예: 1[to the purpose] ← 금지)
3. 번호[단어]로 표시된 단어는 모두 틀린 어법입니다. 학생은 전부 올바른 형태로 수정합니다.
4. 번호[단어] 외의 나머지 원문 단어는 절대 변경하지 않습니다.
5. 오류 위치가 문장 전체에 고르게 분산되어야 합니다 (문장 앞/중/뒤).

⚠️⚠️ 핵심 규칙 — 모든 문장에 예외 없이 정확히 3개:
예) "She 1[go] to school every 2[day], but her 3[friend] never come."
    "He 4[are] happy because he 5[finding] the answer 6[quick]."
→ 2문장 = 6개 오류. 지문이 8문장이면 반드시 24개, 10문장이면 30개 생성.
문장당 1개나 2개만 넣는 것은 절대 금지입니다.

출력 형식 (순수 JSON만):
{
  "passage": "모든 문장마다 정확히 3개 오류 삽입 (1[단어] 형식)",
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
1. 반드시 마침표(.)가 있는 위치에서만 문장을 나눕니다. 쉼표(,), 세미콜론(;), 콜론(:)은 문장 분리 기준이 아닙니다.
2. 각 문장은 반드시 완전한 문장(대문자 시작, 마침표로 끝)이어야 합니다.
3. 중간에 쉼표로 연결된 절들은 하나의 문장으로 묶습니다.
4. 지문 전체에서 10~15개 문장을 선택합니다.
5. 각 문장에 번호를 붙이고, 영어 원문을 절대 변형하지 않으며 자연스러운 한국어 해석을 제공합니다.

출력 형식 (순수 JSON만):
{
  "sentences": [
    { "num": 1, "en": "Once upon a time, there was a girl who loved to sing.", "ko": "옛날 옛날에, 노래하기를 좋아하는 소녀가 있었다." },
    { "num": 2, "en": "She would sing every day, filling the room with beautiful melodies.", "ko": "그녀는 매일 노래를 불러 방을 아름다운 선율로 채웠다." }
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
1. 지문에서 단어 5개를 선정하여 ①②③④⑤ 번호를 단어 바로 앞에 붙입니다. (예: ①unlocked, ②heard)
2. 4개는 원문의 문맥에 적절한 단어 그대로 유지합니다.
3. 1개만 문맥상 부적절한 단어(반의어 또는 혼동어)로 교체합니다. (예: increase→decrease, accept→reject)
4. 오류 위치는 ①~⑤ 중 고르게 분산합니다. (항상 ①이나 ⑤로 고정 금지)
5. 번호+단어 사이에 공백 없이 붙입니다: ①unlocked (O)  / ① unlocked (X)
6. 나머지 문장은 원본 그대로 유지합니다.

⚠️ 중요: passage에 ①②③④⑤ 다섯 번호가 반드시 모두 포함되어야 합니다.
번호 하나라도 빠지면 절대 안 됩니다. 예: ①word … ②word … ③word … ④word … ⑤word 전부 등장.

출력 형식 (순수 JSON만):
{
  "passage": "지문 (예: ...who was ①unlocked up in a tower...②heard...③scared...④more...⑤life...)",
  "answer_key": "③ (scared → pleased)"
}`;

    // ── 맞는 어법 (수능형) ──────────────────────────────────────────────────
    case 'suneung_grammar_right':
      return header('아래 영어 지문으로 수능형 "(A)(B)(C)의 각 [ ] 안에서 어법에 맞는 표현으로 가장 적절한 것을 고르시오" 문제를 생성하세요.') +
`생성 규칙:
1. 지문에서 어법 판단이 필요한 위치 정확히 3곳을 선정하여 (A)(B)(C)로 표시합니다.
2. 각 위치에 (A)[표현1 / 표현2] 형식으로 두 어법 선택지를 삽입합니다.
   - 정답: 어법상 맞는 표현  /  오답: 어법상 명확히 틀린 표현
   - 예: (A)[replying / replied], (B)[telling / tell], (C)[to come / coming]
3. ①~⑤ 보기 5개를 (A)(B)(C) 조합으로 구성합니다.
   - 정답 조합이 반드시 1개 포함되어야 합니다.
   - 나머지 4개는 (A)(B)(C) 중 하나 이상 오답이 섞인 조합입니다.
4. 원문 문장은 선택지 삽입 위치 외에 절대 변경하지 않습니다.

출력 형식 (순수 JSON만):
{
  "passage": "지문 — (A)[replying / replied] 형식으로 삽입.",
  "choices": [
    {"label": "①", "A": "word_a1", "B": "word_b1", "C": "word_c1"},
    {"label": "②", "A": "word_a2", "B": "word_b2", "C": "word_c2"},
    {"label": "③", "A": "word_a3", "B": "word_b3", "C": "word_c3"},
    {"label": "④", "A": "word_a4", "B": "word_b4", "C": "word_c4"},
    {"label": "⑤", "A": "word_a5", "B": "word_b5", "C": "word_c5"}
  ],
  "answer_key": "③"
}`;

    // ── 틀린 어법 (수능형) ──────────────────────────────────────────────────
    case 'suneung_grammar_wrong':
      return header('아래 영어 지문으로 수능형 "밑줄 친 부분 중 어법상 틀린 것을 고르시오 ①~⑤" 문제를 생성하세요.') +
`생성 규칙:
1. 지문에서 단어(또는 짧은 어구) 5개를 선정하여 ①②③④⑤ 번호를 단어 바로 앞에 붙입니다.
   (예: ①What's, ②heard, ③with, ④couldn't, ⑤beautiful)
2. 4개는 원문 어법상 올바른 형태 그대로 유지합니다.
3. 1개만 어법상 잘못된 형태로 교체합니다.
   - 오류 유형: 동사 형태(to부정사↔동명사), 관계사(which↔what, who↔whom), 시제 오류, 수 일치, 분사 형태 등
   - 예: having → to have, which → what, are → is, hearing → heard
4. 오류 위치는 ①~⑤ 중 고르게 분산합니다. (항상 ①이나 ⑤로만 고정 금지)
5. 번호+단어 사이에 공백 없이 붙입니다: ①What's (O) / ① What's (X)
6. 나머지 문장은 원본 그대로 유지합니다.

⚠️ 중요: passage에 ①②③④⑤ 다섯 번호가 반드시 모두 포함되어야 합니다.
번호 하나라도 빠지면 절대 안 됩니다. 예: ①word … ②word … ③word … ④word … ⑤word 전부 등장.

출력 형식 (순수 JSON만):
{
  "passage": "지문 (예: ...①What's it like...②hope...③with...④couldn't...⑤beautiful...)",
  "answer_key": "② (hope → hoped)"
}`;

    // ── 1지문 2유형: 어휘+어법 ──────────────────────────────────────────────
    case 'combo_vocab_grammar':
      return header('아래 영어 지문으로 "어휘 빈칸 + 어법" 1지문 2문항 문제를 생성하세요.') +
`지문 형식 (두 종류 표시를 지문 전체에 골고루 섞어 삽입):
- 어휘 빈칸 5개: (A)_____, (B)_____, (C)_____, (D)_____, (E)_____ 형식
- 어법 항목 5개: ①word, ②word 형식 (번호+단어 공백 없이 붙임. 예: ①like, ②sang)

문제 1 (어휘 빈칸): 빈칸 (A)~(E)에 들어갈 말로 적절하지 않은 것
- 5개 선택지 형식: {"label":"①","blank":"(A)","word":"ask"}
- ①=(A), ②=(B), ③=(C), ④=(D), ⑤=(E) — 각 빈칸 하나씩 반드시 5개 전부
- 4개는 문맥에 적절한 단어, 1개만 부적절한 단어
- q1_answer: 부적절한 선택지 번호 (예: "③")
⚠️ q1_choices 반드시 5개 — ①(A)②(B)③(C)④(D)⑤(E) 하나도 빠짐없이

문제 2 (어법): ①~⑤ 중 어법상 어색한 것 2개를 찾는 쌍 선택
- 어법 항목 5개 중 정확히 2개가 어법 오류(동사형태, 관계사, 분사 오류 등)
- 5개 선택지 각각에 두 개 번호의 쌍 제공 형식: {"label":"①","pair":"①, ③"}
- 정답 쌍에는 어법 오류 2개가 모두 포함되어야 함
- q2_answer: 정답 선택지 번호 (예: "④")

⚠️⚠️ 핵심 규칙:
- 어휘 빈칸 ①~⑤ FIVE개 반드시 모두 생성: (A)_____, (B)_____, (C)_____, (D)_____, (E)_____
- 어법 항목 ①~⑤ FIVE개 반드시 모두 생성: ①word, ②word, ③word, ④word, ⑤word
- 총 10개 표시를 지문 전체에 고르게 분산. 원문 나머지 절대 변경 금지.
- ①~⑤ 번호가 하나라도 빠지면 오답입니다. 모두 포함 필수.

출력 형식 (순수 JSON만):
{
  "passage": "Rapunzel was (A)_____ girl who ①locked up in a tower... ②came to visit. (B)_____ ...",
  "q1_choices": [
    {"label": "①", "blank": "(A)", "word": "locked"},
    {"label": "②", "blank": "(B)", "word": "good"},
    {"label": "③", "blank": "(C)", "word": "tired"},
    {"label": "④", "blank": "(D)", "word": "asked"},
    {"label": "⑤", "blank": "(E)", "word": "first"}
  ],
  "q1_answer": "③",
  "q2_choices": [
    {"label": "①", "pair": "①, ③"},
    {"label": "②", "pair": "①, ⑤"},
    {"label": "③", "pair": "②, ⑤"},
    {"label": "④", "pair": "③, ⑤"},
    {"label": "⑤", "pair": "②, ③"}
  ],
  "q2_answer": "②"
}`;

    // ── 1지문 2유형: 어휘+문장완성 ─────────────────────────────────────────
    case 'combo_vocab_fill': {
      const diffLevel = difficulty;
      const isB1 = diffLevel === 'b1';
      const isB2 = diffLevel === 'b2';
      const isHigher = diffLevel === 'c1' || diffLevel === 'c2';
      const q2Instruction = isB1
        ? `문제 2 (단어배열): 빈칸 (가),(나)에 주어진 단어를 올바른 순서로 배열하여 영작하시오.
- 각 긴 빈칸마다 정답 문장의 모든 단어를 섞어서 words 배열로 제공 (필요시 어형 변형 가능)
- 반드시 "ko" 필드에 각 빈칸에 들어갈 문장의 한국어 번역 포함
- 조건 문구: "주어진 단어를 모두 사용하여 다음 우리말과 같은 뜻이 되도록 배열하시오."`
        : isB2
        ? `문제 2 (단어일부제공): 빈칸 (가),(나)에 들어갈 말을 보기 단어로 완성하시오.
- 각 긴 빈칸마다 정답 문장 단어의 60~70%만 words로 제공 (나머지는 학생이 스스로 채움)
- ko 필드 없음
- 조건 문구: "보기의 단어를 활용하여 빈칸을 완성하시오. (필요시 단어 추가 및 어형 변형 가능)"`
        : `문제 2 (어형변화): 빈칸 (가),(나)에 들어갈 말을 보기 단어에서 어형을 변화시켜 완성하시오.
- 각 긴 빈칸마다 정답 문장 단어의 50~60%를 기본형/틀린 형태로 words에 제공 (어형 변화 필요)
- ko 필드 없음
- 조건 문구: "보기의 단어를 필요에 따라 어형을 변화시켜 빈칸을 완성하시오."`;

      return header('아래 영어 지문으로 "어휘 빈칸 + 문장 완성" 1지문 2문항 문제를 생성하세요.') +
`지문 형식 (두 종류 빈칸을 지문에 혼합 삽입):
- 짧은 빈칸 4개: (A)[____], (B)[____], (C)[____], (D)[____] 형식 — 단어 1개
- 긴 빈칸 2개: (가)[________________________], (나)[________________________] 형식 — 완전한 문장 1개
  (긴 빈칸은 반드시 문장 경계에 위치, 문장 전체를 대체)

문제 1 (어휘): 빈칸 (A)~(D)에 들어갈 수 없는 단어 하나
- 5개 선택지 형식: {"label":"①","word":"locked"}
- 4개는 문맥에 적절(각 빈칸의 정답 단어), 1개는 부적절한 단어(디스트랙터)
- q1_answer: 들어갈 수 없는 선택지 번호 (예: "③")

${q2Instruction}

⚠️⚠️ 핵심 규칙:
- 짧은 빈칸 FOUR개 반드시 모두 생성: (A)[____], (B)[____], (C)[____], (D)[____] — 하나도 빠뜨리면 안 됨
- 긴 빈칸 TWO개 반드시 모두 생성: (가)[________________________], (나)[________________________]
- 각 빈칸은 반드시 문맥상 맞는 품사/의미의 단어. 원문 나머지 절대 변경 금지.
- q1_choices의 ①~④는 (A)~(D)의 정답 단어, ⑤만 부적절한 디스트랙터로 구성.

출력 형식 (순수 JSON만):
{
  "passage": "...girl who was (A)[____] up in a tower... (가)[________________________]. After she...",
  "q1_choices": [
    {"label": "①", "word": "locked"},
    {"label": "②", "word": "scared"},
    {"label": "③", "word": "replied"},
    {"label": "④", "word": "decided"},
    {"label": "⑤", "word": "happy"}
  ],
  "q1_answer": "③",
  "q2_items": [
    {
      "blank": "(가)",
      ${isB1 ? '"ko": "이것은 마녀가 그녀에게 말한 것과 달랐고, 그래서 그녀는 그를 믿지 않았다.",' : ''}
      "words": ${isB1 ? '["This", "was", "different", "from", "what", "the", "witch", "told", "her", "so", "she", "didn\'t", "believe", "him"]' : '["different", "from", "the", "witch", "told", "she", "believe"]'},
      "answer": "This was different from what the witch told her, so she didn't believe him."
    },
    {
      "blank": "(나)",
      ${isB1 ? '"ko": "세계는 행복과 희망으로 가득 찬 멋진 곳이었다.",' : ''}
      "words": ${isB1 ? '["the", "world", "was", "full", "of", "happiness", "and", "hope", "a", "wonderful", "place"]' : '["full", "happiness", "hope", "wonderful"]'},
      "answer": "The world was full of happiness and hope."
    }
  ]
}`;};

    // ── 1지문 2유형: 어법+문장배열 ─────────────────────────────────────────
    case 'combo_grammar_order':
      return header('아래 영어 지문으로 "문단 순서 배열 + 어법 수정" 1지문 2문항 문제를 생성하세요.') +
`지문 분할 방식:
- 원본 지문을 내용 흐름에 따라 5개 문단으로 나누어 (A)~(E)로 표시
- (A): 반드시 지문의 첫 문단(도입부) — 학생에게 먼저 주어지는 부분
- (B)~(E): 나머지 4개 문단을 섞인 순서(스크램블)로 배치 — 학생이 순서를 맞춰야 함
- paragraphs 배열에는 섞인 순서 그대로 저장 (A는 첫 번째, 나머지는 섞여서)

문제 1 (문단 순서 배열): "(A)에 이어질 내용을 순서에 맞게 배열하시오"
- order_answer: 올바른 논리적 순서 (예: "(A) - (D) - (B) - (C) - (E)")

문제 2 (어법 수정): "어법상 어색한 부분 3개를 찾아 각각 바르게 고치시오"
- 전체 지문에 어법 오류 정확히 3개 삽입 (단어/구 수준)
- 오류 유형: 동사형태, 관계사, 시제, 수 일치, 분사 형태 등
- grammar_errors: [{label:"(1)", wrong:"...", correct:"..."}] 3개
- 오류는 서로 다른 문단에 분산 배치

⚠️ 규칙: 원문 내용은 어법 오류 3곳 외 절대 변경 금지. 각 문단은 최소 2문장 이상.

출력 형식 (순수 JSON만):
{
  "paragraphs": [
    {"label": "(A)", "text": "도입 문단 — 첫 번째 고정"},
    {"label": "(B)", "text": "스크램블된 문단"},
    {"label": "(C)", "text": "스크램블된 문단"},
    {"label": "(D)", "text": "스크램블된 문단"},
    {"label": "(E)", "text": "스크램블된 문단"}
  ],
  "order_answer": "(A) - (D) - (B) - (C) - (E)",
  "grammar_errors": [
    {"label": "(1)", "wrong": "heard Rapunzel to sing", "correct": "heard Rapunzel singing"},
    {"label": "(2)", "wrong": "full with thoughts", "correct": "full of thoughts"},
    {"label": "(3)", "wrong": "made up his mind", "correct": "made up her mind"}
  ]
}`;

    // ── 1지문 2유형: 어법+문장삽입 ─────────────────────────────────────────
    case 'combo_grammar_insert':
      return header('아래 영어 지문으로 "어법 수정 + 문장 삽입" 1지문 2문항 문제를 생성하세요.') +
`지문 형식 (두 종류 표시를 하나의 지문에 혼합):
- 문장 삽입 위치 5곳: (A) (B) (C) (D) (E) 를 문장 경계에 삽입 (단독 마커, 공백 사이)
- 어법 항목 5개: ①word ②word 형식으로 인라인 삽입 (번호+단어 공백 없이)
  → ①~⑤ 중 정확히 3개만 어법 오류, 나머지 2개는 올바른 표현
  → 어법 오류 3개의 번호를 grammar_wrong에 기록

문제 1 (어법 수정): "밑줄 친 ②③⑤를 어법에 맞게 바꾸어 쓰시오"
- grammar_wrong: 어법 오류인 3개의 번호 목록 (예: ["②","③","⑤"])
- grammar_answers: 각 오류의 틀린 형태와 바른 형태

문제 2 (문장 삽입): "(A)~(E) 중 주어진 문장이 들어가기에 가장 적절한 곳"
- insert_sentence: 삽입할 문장 (지문에서 제거한 원문 문장)
- insert_answer: 정답 위치 (예: "(C)")

⚠️⚠️ 핵심 규칙:
- 문장 삽입 마커 FIVE개 반드시 모두 생성: (A) (B) (C) (D) (E) — 하나도 빠뜨리면 안 됨
- 어법 항목 ①~⑤ FIVE개 반드시 모두 생성: ①word ②word ③word ④word ⑤word — ①만 있고 나머지 없으면 오답
- (A)~(E) 마커와 ①~⑤ 항목은 겹치지 않게 배치
- 번호+단어 사이 공백 금지: ①caring (O) / ① caring (X)
- passage에 ①②③④⑤가 모두 보여야 하며 하나라도 빠지면 오답입니다
- 원문 나머지 절대 변경 금지

출력 형식 (순수 JSON만):
{
  "passage": "...was locked up in a tower. (A) Every day...take good ②caring of you.' (B) One day...Rapunzel ③making up her mind... she ⑤using her hair... (C)...(D)...(E)...",
  "insert_sentence": "This was different from what the witch told her, so she didn't believe him.",
  "insert_answer": "(C)",
  "grammar_wrong": ["②", "③", "⑤"],
  "grammar_answers": [
    {"num": "②", "wrong": "caring", "correct": "care"},
    {"num": "③", "wrong": "making", "correct": "made"},
    {"num": "⑤", "wrong": "using", "correct": "used"}
  ]
}`;

    // ── 지문 구문분석 ─────────────────────────────────────────────────────────
    case 'passage_analysis':
      return header('아래 영어 지문으로 구문분석 학습지를 생성하세요.') +
`생성 규칙:
1. 지문을 문장 단위로 분리합니다 (모든 문장 포함, 생략 금지).
2. 각 문장에 자연스러운 한국어 번역을 작성합니다.
3. 각 문장을 의미 단위(chunk) 배열로 구문 분석합니다.

chunk의 role 종류 (총 9가지):
필수 문장 성분 5가지:
- "S"  : 주어
- "V"  : 동사 (조동사+본동사 전체, 예: "has been developed")
- "O"  : 목적어
- "SC" : 주격보어 (2형식 be/become/seem 뒤 보어)
- "OC" : 목적격보어 (5형식 목적어 뒤 보어)

수식어구 4가지 (렌더링 시 자동으로 ( ) 괄호가 추가됨):
- "관계사절" : 관계대명사/관계부사절 전체 (예: "which helped him succeed")
- "분사구"   : 현재분사구 또는 과거분사구 (예: "running fast", "written by him")
- "to부정사구" : to부정사구 전체 (예: "to achieve their goals")
- "전치사구"  : 전치사부터 명사구 끝까지 (예: "in the early 20th century")

일반 수식어:
- "M" : 위 4가지에 해당하지 않는 단순 부사/형용사 등

중요 규칙:
- chunk는 문장 왼쪽부터 순서대로 나열합니다. 건너뛰기 금지.
- 수식어구(관계사절·분사구·to부정사구·전치사구)의 text에는 괄호를 포함하지 않습니다.
- 부사절(when/because/if/although 등)은 "M"으로 처리하고 text에 절 전체를 씁니다.
- 반드시 S와 V는 표시합니다.

출력 형식 (순수 JSON만, 마크다운 코드블록 없이):
{
  "sentences": [
    {
      "num": 1,
      "en": "They used brain not brawn to kill their prey.",
      "ko": "그들은 근력이 아닌 두뇌를 사용하여 먹이를 죽였다.",
      "chunks": [
        {"text": "They", "role": "S"},
        {"text": "used", "role": "V"},
        {"text": "brain not brawn", "role": "O"},
        {"text": "to kill their prey", "role": "to부정사구"}
      ]
    },
    {
      "num": 2,
      "en": "At the end of the long hunting era, before they turned to farming, they were already enjoying some degree of affluence.",
      "ko": "긴 수렵 시대의 끝 무렵, 그들이 농업으로 전환하기 전에, 그들은 이미 어느 정도의 풍요로움을 누리고 있었다.",
      "chunks": [
        {"text": "At the end of the long hunting era", "role": "전치사구"},
        {"text": "before they turned to farming", "role": "M"},
        {"text": "they", "role": "S"},
        {"text": "were already enjoying", "role": "V"},
        {"text": "some degree of affluence", "role": "O"}
      ]
    }
  ]
}`;

    // ── 요약문 서술형 ──────────────────────────────────────────────────────────
    case 'summary_sentence':
      return header('아래 영어 지문으로 요약문 서술형 문제를 생성하세요.') +
`생성 규칙:
1. 지문의 핵심 내용을 담은 1~2문장짜리 요약문을 작성합니다. (약 25~50단어)
   - 요약문은 지문의 단어와 표현을 최대한 활용하되, 원문을 그대로 옮기지 않습니다.
   - 지문 전체의 주제와 핵심 논지를 포함해야 합니다.
2. 요약문에서 핵심 단어 5~8개를 선택하여 빈칸으로 만듭니다.
   - 빈칸 정답 단어는 반드시 원본 지문에 그 형태 그대로 등장하는 단어여야 합니다.
   - 핵심 명사, 동사, 형용사, 부사를 우선 빈칸으로 선택합니다.
   - 관사(a/an/the), 전치사(of/in/at), 접속사(and/but)는 빈칸 제외.
3. 빈칸 형식: (1)________, (2)________ 순서로 번호를 매깁니다.
4. answer_key는 "(1) 단어  (2) 단어" 형식으로 각 빈칸 정답을 나열합니다.
   정답은 원본 지문에 나오는 정확한 철자로 작성합니다.

출력 형식 (순수 JSON만, 마크다운 코드블록 없이):
{
  "instruction": "다음 글의 내용을 한 문장으로 요약할 때, 빈칸에 들어갈 알맞은 단어를 본문에서 찾아 쓰시오.",
  "summary": "By developing higher (1)________, early humans escaped the (2)________ demands of the continuous (3)________ for food, securing (4)________ and leisure prior to the (5)________ era.",
  "answer_key": "(1) intelligence  (2) heavy  (3) search  (4) affluence  (5) farming"
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
  nums.forEach((n, i) => { answerMap[n] = (keyParts[i] || '').trim(); });

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
        model: 'gpt-5.1',
        max_completion_tokens: 4096,
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
