import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getFeaturePrice, getConBalance } from '@/lib/credits';
import { createAdminClient } from '@/lib/supabase-admin';

export const maxDuration = 300;

export interface ExamChoice {
  number: number;
  text: string;
}

export interface ExamQuestion {
  type: string;
  question_text: string;
  modified_passage?: string;
  choices: ExamChoice[];
  answer: number;
  explanation: string;
}

const TYPE_LABELS: Record<string, string> = {
  topic_title:      '주제/제목 유형',
  grammar:          '어법 유형',
  vocab_paraphrase: '어휘 - 낱말 쓰임 유형',
  vocab_blank:      '어휘 - (a)(b) 빈칸 유형',
  fill_blank:       '빈칸 추론 유형',
  summary:          '요약문 완성 유형',
  flow:             '흐름 문제',
  phrase_meaning:   '어구 의미 유형',
  sentence_order:   '순서 배열 유형',
};

const VALID_TYPES = new Set(Object.keys(TYPE_LABELS));

function buildExamPrompt(text: string, questionTypes: string[], difficulty: 'b1' | 'b2' | 'c1' | 'c2' = 'c2', targetAnswer?: number): string {
  const typeRules: Record<string, string> = 
  {
  common_principles: `
[CSAT_HIGH_LEVEL_PRINCIPLES]

You are not merely generating English test questions.
You are simulating KICE-style CSAT item writers.

Questions must:
- require discourse-level reasoning
- avoid keyword matching solutions
- include structurally plausible distractors
- test logical interpretation rather than surface comprehension

After generation, independently validate:
- uniqueness of the answer
- logical consistency
- grammar correctness
- distractor plausibility

If validation fails, regenerate the question completely.

Generation pipeline (REQUIRED):
STEP 1: Analyze passage logic — extract core claim, discourse structure, causal/contrast relations
STEP 2: Generate question and distractors
STEP 3: Self-validate — answer uniqueness, logical consistency, grammar, distractor plausibility
STEP 4: If validation fails, regenerate the ENTIRE question completely

You are a CSAT English test writer for the Korea Institute for Curriculum and Evaluation (KICE).

Target difficulty:
- CEFR C2~C2+
- Korean CSAT elite-level inference difficulty
- KICE-style abstract reasoning

Core philosophy:
- Do NOT create vocabulary-matching questions.
- Do NOT rely on surface-level keyword repetition.
- Questions must require conceptual inference, logical reconstruction, and abstraction.
- Students should fail if they rely only on keyword matching.

Paraphrasing rules:
- Use conceptual paraphrasing instead of dictionary-level synonym replacement.
- Rewrite ideas at a higher level of abstraction.
- Avoid directly repeating key nouns or adjectives from the passage.
- Reconstruct the meaning using different conceptual categories whenever possible.
- Direct synonym replacement is prohibited.

Bad paraphrase examples:
emotion → feeling
reason → logic
value → principle

Good paraphrase examples:
emotion → affective foundation
reason → analytical framework
values → internalized beliefs

Choice construction rules:
- All choices must appear semantically plausible.
- Maintain similar length, abstraction level, and tone across all choices.
- Avoid obviously weak distractors.
- Avoid choices that can be eliminated immediately through surface meaning alone.
- The correct answer must not appear noticeably more sophisticated than distractors.

KICE-style distractor patterns:
1. Partial agreement
2. Reversed causality
3. Overgeneralization
4. Surface-level keyword match
5. Misaligned abstraction
6. Incorrect logical scope
7. Confusion between example and core claim

Distractor engineering:
- Every distractor must fail for a different reason.
- Do not create multiple weak distractors of the same type.

Difficulty control:
- Prioritize abstract reasoning over obscure vocabulary.
- Vocabulary should feel academically natural, not artificially difficult.
- Correct answers should emerge only after understanding the full logical structure of the passage.

[정답 유일성 원칙 — 모든 유형 공통 적용]

- 실제 오류(문법·어휘·논리)는 반드시 정확히 1개만 존재해야 한다.
- 나머지 4개 선택지는 어떤 문법 이론·논리 분석으로도 오류가 되어서는 안 된다.
- 문법 학자 간 견해 차이가 발생할 수 있는 애매한 구조는 사용 금지.
- stylistic awkwardness(문체상 어색함)는 허용되지만 grammatical incorrectness(문법 오류)는 절대 아니어야 한다.
- Correct distractors must appear suspicious at first glance but become fully grammatical after structural analysis.
- Never create distractors that are controversial, marginally acceptable, or dependent on stylistic preference.
- Correct choices must remain fully grammatical even under formal written English standards.
- If more than one option can reasonably be interpreted as incorrect, discard the entire question and regenerate it.

[정답 유일성 검수 — 생성 후 반드시 수행]

각 선택지에 대해 순서대로 점검할 것:
1. 해당 선택지가 왜 맞는지(또는 왜 틀리는지) 문법·논리 규칙으로 설명 가능해야 한다.
2. 정답이 아닌 선택지는 어떤 관점에서도 수정 필요성이 없어야 한다.
3. "더 자연스럽다" 수준이 아니라 실제 문법·논리 규칙상 올바른지 검토할 것.
4. 두 개 이상의 선택지가 오류로 해석 가능하면 문제 전체를 폐기하고 재생성할 것.
`,

  topic_title: `
--- topic_title (주제/제목 유형) ---

[핵심 규칙]
- The correct answer must summarize the entire passage at the conceptual level.
- Do NOT reuse the passage's key wording directly.
- The correct option must paraphrase both the logical relation and the author's claim.
- Wrong choices must appear partially plausible by reusing secondary ideas or similar abstract vocabulary.
- At least two distractors should contain conceptual distortion rather than factual contradiction.

- question_text:
"다음 글의 주제로 가장 적절한 것은?"

- choices text 형식 (반드시 준수):
text 필드에 반드시 완전한 영어 명사구/동명사구/절을 작성할 것.
①②③④⑤ 기호를 text 필드에 절대 사용 금지 — 텍스트만 작성.
올바른 형식 예시:
  {"number": 1, "text": "the role of emotional memory in shaping human judgment"}
  {"number": 2, "text": "how social norms constrain individual creative expression"}
잘못된 형식 (절대 금지): {"number": 1, "text": "①"}

- modified_passage:
포함하지 않음

[출제 목표]
- 학생이 글 전체 논리를 통합적으로 이해해야만 정답을 고를 수 있게 설계할 것.
- 단순 키워드 매칭으로는 풀 수 없어야 한다.
- 필자의 핵심 주장과 세부 예시를 구분해야만 해결 가능해야 한다.

[정답 설계]
- 정답은 글 전체 핵심 주장을 가장 정확히 paraphrase한 것.
- 본문 핵심 단어를 그대로 반복하지 말 것.
- 핵심 논리를 한 단계 추상화하여 재진술할 것.
- topic keyword가 아니라 author's ultimate claim을 반영할 것.

[오답 설계]
- 오답 2개:
  본문에 직접 등장하지 않은 어휘를 사용하되 의미상 매우 유사하게 보이게 제작.
- 나머지 오답:
  ① 부분 정보만 반영
  ② 세부 사례 강조
  ③ 지나친 일반화
  ④ 논리 방향 반전
  ⑤ 예시와 핵심 주장 혼동

- 오답도 모두 문맥상 그럴듯하게 보이게 만들 것.

[KICE 실전 제목 설계 원칙 — PDF 분석 기반]
- 정답 제목 형식: 7~12단어. 콜론(:) 구조 권장 — "[핵심논지]: [부연설명]" 또는 "[Gerund] + [전치사구]"
- 정답 제목은 지문에 등장하는 특정 인물·기관·사례명(예: Jonas Chickering, Dewey)을 포함하지 말 것 → 핵심 주장을 추상화할 것
- 오답은 반드시 아래 5가지 범주에서 하나씩 배치할 것:
  ① 지문에서 언급된 특정 인물·사례에만 집중 (too narrow)
  ② 핵심 주장이 아닌 방법론/전략만 기술
  ③ 전체 주장의 일부(한 단락 수준) 정보만 반영
  ④ 글의 결론과 반대 방향 주장
  ⑤ 주변 세부 내용(예시·배경)을 핵심 주장인 것처럼 포장
- 정답은 keyword matching만으로 선택 불가 — 글 전체 논리 구조를 파악해야 선택 가능하게 설계
`,

  grammar: `
--- grammar (어법 유형 · 수능/평가원 스타일) ---

[핵심 생성 목표]
- 수능/평가원 스타일의 구조 기반 고난도 어법 문제를 생성한다.
- 학생이 문장 구조를 실제로 분석해야만 정답 판단 가능해야 한다.
- 직관적 자연스러움만으로 풀 수 없어야 한다.
- 반드시 "실제 문법 규칙 위반" 1개만 존재해야 한다.

━━━━━━━━━━━━━━━━━━
[가장 중요한 규칙]
━━━━━━━━━━━━━━━━━━

1. 절대 원문 그대로 가져오고 정답 지정 금지
- 반드시 1개의 실제 문법 오류를 생성해야 한다.
- 오류가 없다면 문제 생성 실패로 간주한다.

2. 오류는 반드시 구조 기반이어야 한다.
좋은 오류:
- 관계사 / 병렬구조 / 분사 / 준동사 / 명사절 접속사 / 재귀대명사 / it-가목적어 구조

나쁜 오류 (금지):
- 단순 전치사 / 단순 관사 / 단순 어휘 / 단순 시제 / 단순 수일치

3. 나머지 4개는 반드시 완전히 맞아야 한다.
- distractor도 실제 문법적으로 완벽해야 한다.
- "어색함"은 오류가 아니다.
- 생성 후 5개 모두 다시 검증할 것.

━━━━━━━━━━━━━━━━━━
[modified_passage 생성 규칙]
━━━━━━━━━━━━━━━━━━

- 원본 지문 전체를 그대로 사용할 것. 생략·축약 금지.
- 첫 문장부터 마지막 문장까지 반드시 포함.
- modified_passage 안에 반드시 ①②③④⑤ 총 5개 번호 삽입.
- 번호는 반드시 실제 존재하는 단어/구 바로 앞에 삽입할 것.
- 번호는 지문의 앞→뒤 순서대로 삽입할 것: ①이 가장 앞에, ⑤가 가장 뒤에 등장해야 한다.
- ①②③④⑤가 지문에 등장하는 순서를 반드시 지킬 것. 순서가 뒤바뀌면(예: ①②③⑤④) 절대 금지.

━━━━━━━━━━━━━━━━━━
[절대 규칙]
━━━━━━━━━━━━━━━━━━

1. ①②③④⑤ 모두 modified_passage 안에 존재해야 한다.
2. 각 번호는 서로 다른 문법 포인트여야 한다. 같은 유형 반복 금지.
3. choice의 단어/구는 modified_passage 속 표현과 완전히 동일해야 한다.
4. 본문에 없는 표현 생성 금지.

━━━━━━━━━━━━━━━━━━
[오류 강제 생성 규칙]
━━━━━━━━━━━━━━━━━━

원문이 문법적으로 올바른 경우,
반드시 아래 방식으로 ONLY ONE 오류 생성:

허용되는 오류 생성 방식:
- 관계사 교체 / 병렬 형태 불일치 / to V ↔ Ving 교체
- 재귀대명사 제거 / 감정분사 교체 / whether ↔ that 교체
- it-가목적어 구조에서 to 삭제 / 사역/허용동사 뒤 구조 파괴

예:
✅ makes it possible to amplify → makes it possible amplify
✅ not only reading but also writing → not only reading but also write
❌ 의미 자체 붕괴 / 비문 수준 오류 / 단순 철자 오류

━━━━━━━━━━━━━━━━━━
[번호 삽입 형식]
━━━━━━━━━━━━━━━━━━

단일 단어: ①remains
다중 단어: ②[which was established] / ③[not only reading]
→ 반드시 전체 구조 단위로 묶을 것. 일부만 자르지 말 것.

━━━━━━━━━━━━━━━━━━
[⚠️ 번호 삽입 절대 금지 단어 — 오류/정답 여부 무관하게 적용]
━━━━━━━━━━━━━━━━━━

①②③④⑤ 어떤 번호도 아래 단어 바로 앞에 삽입하면 절대 안 된다.
이는 정답 위치이든, 오답(distractor) 위치이든 관계없이 무조건 적용된다.

금지 단어 목록:
- 단독 전치사: of / in / to / for / on / at / by / with / from / about / as / into / through / over / during / between / among / against / without / before / after / since / until / upon / within / across / along / around / beyond / despite / except / like / near / off / outside / past / per / regarding / toward / under / unlike / via
- 단독 관사: a / an / the
- 단독 등위·종속 접속사: and / but / or / nor / so / yet / for / although / because / while / when / if / unless / as / though / whether / wherever / however / whatever / once / though

금지 예시:
❌ "leads to ①of language development" → ①이 전치사 of 앞
❌ "depends on ②to his ability" → ②가 전치사/부정사 to 앞
❌ "③the results show" → ③이 관사 the 앞
❌ "④and all participants" → ④가 접속사 and 앞

올바른 예시:
✅ "①remains unclear" → ①이 동사 앞
✅ "②[which was established]" → ②가 관계대명사 구 앞
✅ "③[not only reading]" → ③이 병렬구조 앞
✅ "④[lead to reducing]" → ④가 전치사구 전체를 포함한 구조 앞

━━━━━━━━━━━━━━━━━━
[question_text]
━━━━━━━━━━━━━━━━━━

"고정"
"다음 글의 밑줄 친 부분 중, 어법상 틀린 것은?"

━━━━━━━━━━━━━━━━━━
[choices 생성 규칙]
━━━━━━━━━━━━━━━━━━

형식: "① 단어/구"
예: {"number":1,"text":"① which was established"}
- choice는 modified_passage 표현과 완전히 동일해야 함
- paraphrase 금지 / 축약 금지

━━━━━━━━━━━━━━━━━━
[밑줄 포인트 선정 규칙]
━━━━━━━━━━━━━━━━━━

밑줄 포인트는 반드시 아래 중 하나를 요구해야 한다:
- clause boundary / modifier attachment / 병렬구조
- 관계사-선행사 관계 / 준동사 구조 / 논리주어 분석

좋은 예:
✅ not only A but also B
✅ lead to reducing
✅ makes it possible to amplify
✅ which was established
✅ whether a child will be

나쁜 예 (절대 금지):
❌ adults / ❌ in / ❌ suggests / ❌ was known / ❌ energy sector
❌ 단독 전치사 / ❌ 단독 관사 / ❌ 단독 접속사
❌ isolated vocabulary / ❌ 구조 분석 필요 없는 부분

━━━━━━━━━━━━━━━━━━
[오류 유형 우선순위 — C1~C2]
━━━━━━━━━━━━━━━━━━

고난도에서는 아래 유형 중심으로 오류/distractor 설계:

1. 병렬구조: not only A but also B / A and B 품사 불일치
2. 관계사: which/where / that/whether / what/that
3. 분사: interesting/interested / using/used / dangling participle
4. 준동사: lead to Ving / enable O to V / make it possible to V
5. 재귀대명사: themselves ↔ them

다음 단독 오류 금지:
❌ 단순 시제 / ❌ 단순 수동태 / ❌ 단순 수일치 / ❌ 단순 전치사

━━━━━━━━━━━━━━━━━━
[출제 가능 포인트 — 상세]
━━━━━━━━━━━━━━━━━━

[1] 관계사: which/that/who/where/when/why — 선행사·격 충돌, 삽입구로 숨겨진 선행사
예: the reason where → why

[2] 병렬구조: and/but/or, not only A but also B, both A and B, either A or B
오류: 동명사↔부정사, 형용사↔부사, 명사↔절
예: not only working hard but also achieve success

[3] 분사: 현재분사 vs 과거분사, 분사구문 논리주어, 감정분사
예: interesting vs interested / fascinating vs fascinated

[4] 명사절 접속사: what/that/whether
빈출: determine whether / question whether / show that

[5] 숨겨진 수일치: appositive/관계절/삽입구/전치사구
주의: 단순 단수/복수 금지, 실제 주어 분석 필요

[6] it-가목적어: make/find/consider + it + adj + to V
오류: to 삭제 (예: makes it possible amplify)

[7] 전치사 to + Ving: lead to Ving / contribute to Ving
→ 좋은 distractor 포인트 (reducing 맞음)

[8] 재귀대명사: themselves/itself — 오류: themselves → them

[9] 사역/허용동사: allow/enable/force/require + O + to V
오류: to V → Ving

━━━━━━━━━━━━━━━━━━
[Distractor 설계 규칙]
━━━━━━━━━━━━━━━━━━

오답 4개는 "틀려 보이지만 실제로는 맞는 구조"여야 한다.

추천 distractor:
- lead to + Ving / appositive가 낀 수일치 / participial adjective
- 복잡한 관계절 / it + adj + to V / interrupted agreement / nested clause

학생이 "이거 틀린 거 아닌가?" 싶게 만들어야 한다.

━━━━━━━━━━━━━━━━━━
[SELF-VALIDATION — REQUIRED]
━━━━━━━━━━━━━━━━━━

After generating the grammar question, perform the following validation:

STEP 1: Check whether exactly ONE grammatical error exists in the modified passage.

STEP 2: For each option (①~⑤):
- Explain why it is grammatically correct or incorrect.
- Verify clause structure.
- Identify the governing grammar rule.

STEP 3: Reject the question if any of the following:
- No actual grammar violation exists.
- More than one answer is possible.
- The issue is only stylistic awkwardness.
- The underlined point can be judged without structural analysis.
- Ambiguity exists between two or more options.
- The original passage remained unchanged.

STEP 4: If validation fails, regenerate the ENTIRE question completely.

The incorrect option must contain a REAL grammatical violation.
Awkward wording alone is NOT an error.

━━━━━━━━━━━━━━━━━━
[answer]
━━━━━━━━━━━━━━━━━━

- 실제 문법 오류 번호 1개

━━━━━━━━━━━━━━━━━━
[explanation]
━━━━━━━━━━━━━━━━━━

반드시 포함:
1. 왜 틀렸는지
2. 어떤 문법 규칙인지
3. 왜 나머지 선택지는 맞는지
4. 올바른 수정 형태

설명은 한국어로 상세히 작성.
`,

  vocab_paraphrase: `
--- vocab_paraphrase (어휘 - 문맥상 낱말의 쓰임 유형) ---

[문제 형식]
"다음 글의 밑줄 친 부분 중, 문맥상 낱말의 쓰임이 적절하지 않은 것은?"

[출제 방식]
- 원본 지문에서 5곳의 위치를 선정하여 ①②③④⑤ 번호를 modified_passage에 삽입.
- ①~⑤ 모든 위치의 단어를 원본 지문에 없는 새 단어로 교체한다.
  · 4개는 문맥상 올바른 새 단어로 교체 (동의어, 상위어, 유사 기능어 등).
  · 1개만 문맥상 부적절한 새 단어로 교체 (반의어, 혼동어, 논리적 반대).
- 교체된 5개 단어 모두 원본 지문 어디에도 등장하지 않는 단어여야 한다.
- 오답 단어는 표면적으로 자연스러워 보이되 글 전체 논리상 맞지 않아야 함.

[절대 규칙 - 위반 금지]
· ①②③④⑤ 5개 번호 모두 반드시 modified_passage 안에 삽입되어야 한다. 하나라도 빠지면 안 된다.
· 각 번호는 반드시 밑줄 칠 대상 단어 바로 앞에 붙인다 — 문장 맨 앞에 삽입 절대 금지.
  잘못된 예 (절대 금지): "⑤Interestingly, the methodology is subjected to..." → ⑤가 target word 앞이 아님
  올바른 예: "the methodology is ⑤subjected to critical analysis"
  잘못된 예: "①Although this finding suggests..." → ①이 접속사 앞에 붙음
  올바른 예: "Although this finding ①suggests a broader trend..."
· 관사(a, an, the), 전치사(of, in, to 등), 대명사, 접속사(although, when, that 등) 앞에 삽입 절대 금지.
  올바른 예: "leads to a ②feeling" / 잘못된 예: "leads to ②a feeling"
  올바른 예: "incorrect ①assumption" / 잘못된 예: "①an incorrect assumption"
· choices의 단어는 modified_passage에서 해당 번호 바로 뒤에 오는 첫 번째 단어와 반드시 완전히 일치해야 한다.
· 생성 후 각 번호(①~⑤)를 찾아 바로 뒤 단어가 choices의 해당 text와 일치하는지 반드시 재확인할 것.
· 단일 단어만 밑줄 대상으로 사용할 것. 구(phrase) 사용 금지.
· 5개의 선지 단어는 서로 완전히 달라야 한다. 동일한 단어가 두 개 이상의 선지에 포함되는 것을 절대 금지한다.
· 생성 후 ①②③④⑤가 모두 modified_passage에 있는지 반드시 확인할 것.
· 교체된 5개 단어 모두 원본 지문에 없는 단어인지 반드시 확인할 것. 원본 지문에 이미 사용된 단어를 선지로 쓰는 것을 금지한다.

- question_text:
"다음 글의 밑줄 친 부분 중, 문맥상 낱말의 쓰임이 적절하지 않은 것은?"

- modified_passage:
원본 지문 전체를 사용하되, 5곳에 ①②③④⑤를 삽입하고 정답 위치의 단어만 반의어/혼동어로 교체.

- choices text 형식 (반드시 준수):
"① 단어" 형식 — 원형 번호(①②③④⑤) + 공백 + 단어. 원형 번호를 text 필드 맨 앞에 포함할 것.
예시: {"number": 1, "text": "① perpetuate"}, {"number": 3, "text": "③ obscured"}
각 번호 뒤의 단어는 modified_passage에서 해당 번호 바로 뒤에 오는 단어와 완전히 일치해야 한다.

- answer:
문맥상 쓰임이 적절하지 않은 단어의 번호 1개

- explanation:
왜 해당 단어가 문맥상 적절하지 않은지 + 어떤 단어가 더 적절한지를 한글로 상세 설명

[밑줄 포인트 절대 금지 — 어휘 선정 시 반드시 준수]
다음은 ①②③④⑤ 밑줄 대상으로 절대 사용 금지:
- 단독 전치사 (in / on / at / of / during / over / up / off / between 등)
- 단독 관사 (a / an / the)
- 단독 접속사 (and / but / or — 병렬 오류 없이 단순 연결만 하는 경우)
- 단독 명사 / 단독 형용사 / 의미만 있는 일반 content word
- 단위 명사, 고유 명사 (사람·동식물 이름, 지명, 숫자 단위 등)
- 단순 일반동사 (shows / suggests / indicates 등 — 문맥 논리 분석 불필요한 경우)
- 문맥상 명백한 수동태 (구조 분석 없이 자명한 경우)
- 구조 분석 없이 직관으로 판단 가능한 어휘

금지 예시:
❌ acres  ❌ refuge  ❌ adults  ❌ in  ❌ and  ❌ shows  ❌ suggests  ❌ was known
❌ Ban  ❌ million  ❌ hundred

올바른 선정 예시:
✅ 글 전체 논리 구조와 인과 관계를 이해해야만 판단 가능한 어휘
✅ 역접·대조 구조 안에서 핵심 방향을 결정하는 어휘
✅ 지문의 핵심 주장을 표현하는 추상적 학술 어휘

[어휘 선정 기준 — 반드시 준수]
- Do not select function words (prepositions, conjunctions, articles, pronouns) or overly generic nouns (thing, way, fact, idea) as vocabulary targets.
- Prefer abstract academic vocabulary with nuanced contextual meaning — words whose precise usage depends on understanding the passage's logical structure.
- Target words should require semantic precision rather than dictionary-level recognition: the student must understand how the word functions within the argument, not just its definition.
- Avoid vocabulary items whose meanings remain unchanged regardless of context (e.g., "birth", "school", "hand") — these cannot test contextual appropriateness.
- 예: "established" (정착되다/확립되다) — 단어 자체보다 문맥 속 논리적 방향이 핵심인 어휘 선정

[선지 ①~⑤ 어휘 주제 연관성 규칙 — 반드시 준수]
- ①~⑤ 5개 단어 모두 반드시 지문의 핵심 주제·논지와 직접 연관된 어휘여야 한다.
- 지문이 "감정과 의사결정" 주제라면 선지 단어도 emotion / cognitive / rational / affective / distort 등 주제 관련 어휘를 사용할 것.
- 지문 주제와 무관한 임의 어휘(random academic word) 사용 금지.
  · 예: 지문이 예술·창의성 관련인데 선지에 "pharmaceutical / hydraulic / legislative" 등 전혀 다른 분야 어휘 사용 금지.
- 5개 단어가 모두 같은 의미 범주(synonyms)가 되어서는 안 되며, 주제 안에서 서로 다른 개념 역할을 하는 어휘로 구성할 것.
  · 예: 원인·결과·방법·특성·상태 등 다양한 논리적 역할을 대표하는 어휘 배치.
- 학생이 지문을 읽지 않고 선지만 봐도 "이 지문이 어떤 주제인지" 짐작 가능한 수준의 핵심 어휘를 사용할 것.

[고난도 조건]
- 교체된 단어가 표면적으로는 자연스러워 보여야 함 (단순 happy→sad 교체 금지)
- 학생이 글 전체 논리를 이해해야만 오류를 발견할 수 있어야 함
- 나머지 4개 단어도 C2~C2+ 고난도 어휘로 선정하여 학생이 모든 선지를 검토하도록 만들 것
- 교체 어휘는 해당 문장 내에서는 문법적으로 올바르지만 글 전체 맥락에서 논리적으로 틀려야 함

[KICE 실전 낱말 쓰임 설계 원칙 — PDF 분석 기반]
- 오류 단어는 반드시 정답 단어의 의미상 반의어 또는 논리적 반대어여야 함
  · 예: disrupt → reinforce / separate → combined / declining → increasing / less → more / uniformly → variably
- 오류 위치는 ①~⑤ 중 고르게 배치할 것 — 특정 번호에 편중되지 않도록 한다
- 오류 단어는 LOCAL 문장 안에서는 자연스럽게 읽히지만 GLOBAL 단락 논리와 충돌하게 설계할 것
  · 예: "emotion can reinforce this understanding" → 문장 자체는 자연스럽지만 전체 글에서 emotion은 이해를 방해함
- 4개 정답 단어는 원문 단어 그대로 복사 금지 — 반드시 동의어·상위어·paraphrase로 교체할 것
  · 예: 원문 "accepted" → 교체어 "recognized" / 원문 "increase" → 교체어 "boost"
- 오류 단어가 지문의 핵심 인과 관계나 대조 구조를 정확히 뒤집어야 최고 난이도 달성

[오류 단어 설계 4대 조건 — 반드시 충족]
1. Same semantic domain: 오류 단어는 정답 단어와 동일한 의미 영역(semantic domain) 안에 있어야 한다.
   · 예: cognitive 영역이면 → perceive / distort / interpret / suppress 등에서 선택. "legislative / hydraulic" 같은 다른 도메인 단어 절대 금지.
2. Local plausibility: 오류 단어가 포함된 문장 하나만 읽었을 때는 문법·의미 모두 자연스럽게 들려야 한다.
   · 단일 문장 수준에서 어색하거나 문법 오류가 생기는 단어 선택 금지.
3. No obvious antonym: happy→sad, increase→decrease처럼 즉각 반의어가 드러나는 교체는 금지한다.
   · 오류는 단어 의미를 몰라도 직관적으로 눈치챌 수 있을 만큼 뻔해서는 안 된다.
4. Discourse-level incorrectness only: 오류는 반드시 지문 전체의 논리 흐름(인과·대조·주장)을 이해한 후에만 발견 가능해야 한다.
   · 단락 1~2문장만 읽고 오류를 발견할 수 있으면 실격. 전체 담화를 파악해야만 틀렸음을 알 수 있어야 함.
  · 특히 역접(however/although/yet/but) 뒤 또는 대조 구조 내 단어를 오류 위치로 선정하면 고난도 실현 가능
`,

  vocab_blank: `
--- vocab_blank (어휘 (a)(b) 빈칸형) ---

- modified_passage:
원본 지문 전체를 사용하되, 핵심 어휘 2곳만 (a), (b)로 교체.
반드시 최소 3문장 이상, 원본 단락 전체를 유지할 것.
단락 일부만 잘라 쓰지 말 것. 지문 전체가 modified_passage에 포함되어야 한다.

[절대 규칙 - 위반 금지]
· (a)와 (b) 두 표시 모두 반드시 modified_passage 안에 존재해야 한다. 하나라도 빠지면 안 된다.
· (a)는 지문 앞부분, (b)는 지문 뒷부분에 배치하여 두 빈칸이 지문 전체를 아우르도록 할 것.
· 생성 후 "(a)"와 "(b)" 모두 modified_passage에 포함되어 있는지 반드시 확인할 것.
· (a)는 modified_passage 전체에서 정확히 1번만 등장해야 한다. 2번 이상 등장하면 절대 금지.
· (b)는 modified_passage 전체에서 정확히 1번만 등장해야 한다. 2번 이상 등장하면 절대 금지.
· 대상 단어가 지문에 여러 번 반복 등장하는 경우, 그 단어를 (a)/(b) 대상으로 절대 선택하지 말 것.
  예: 지문에 "perspective"가 4번 나오면 (a) 대상 금지 — 지문에서 딱 1번만 등장하는 단어를 선택할 것.
· (a)로 교체한 단어의 나머지 등장 위치는 원문 단어를 그대로 유지할 것. 모두 (a)로 교체하는 것 절대 금지.

- question_text:
"다음 빈칸 (a), (b)에 들어갈 말로 가장 적절한 것은?"

- choices text 형식 (반드시 준수):
text 필드에 "(a) 단어1 --- (b) 단어2" 형식으로 한 줄로 작성.
예시: {"number": 1, "text": "(a) perpetuate --- (b) constrain"}
절대 (a)와 (b)를 별도 필드로 분리하지 말 것.

[출제 목표]
- 학생이 글 전체 개념 관계를 이해해야만 해결 가능해야 한다.
- 단순 어휘 암기로는 풀 수 없어야 한다.

[정답 설계]
- 본문 표현 그대로 복사 금지
- 의미 기반 conceptual paraphrase 사용
- 원문 표현 ≠ 선택지 표현
- 원문 의미 = 선택지 의미

[오답 설계]
- 하나만 맞거나
- 논리 방향 반대
- 인과관계 왜곡
- 부분 정보만 반영
- 표면적으로는 유사하지만 개념적으로 틀리게 제작

[고난도 조건]
- 학생이 인과 / 대조 / 전제-결론 관계를 재구성해야 정답 도출 가능해야 함.
- keyword matching만으로는 절대 풀리지 않게 만들 것.
`,

  fill_blank: `
--- fill_blank (빈칸 추론 유형) ---

[핵심 규칙]
- The blank must contain the passage's core logical claim.
- Students must reconstruct the argument structure to solve the question.
- The correct answer must paraphrase the original meaning using different syntax and abstract vocabulary.
- Avoid lexical overlap between the blank answer and the original passage.
- Distractors should recycle passage vocabulary while distorting the logical relationship.

- modified_passage:
원본 지문 전체를 그대로 사용하되, 빈칸으로 만들 핵심 논리 구간 하나만 ___________으로 교체할 것.
원본 지문의 첫 문장부터 마지막 문장까지 모두 포함해야 한다. 지문을 잘라 쓰지 말 것.

- question_text:
"다음 빈칸에 들어갈 말로 가장 적절한 것은?"

- choices text 형식 (반드시 준수):
text 필드에 반드시 완전한 영어 구 또는 절을 작성할 것.
①②③④⑤ 기호를 text 필드에 절대 사용 금지 — 텍스트만 작성.
올바른 형식 예시:
  {"number": 1, "text": "the gradual erosion of individual autonomy under collective pressure"}
  {"number": 2, "text": "how prior knowledge shapes the perception of new information"}
잘못된 형식 (절대 금지): {"number": 1, "text": "①"}

- choices:
영어 구/절 5개

[출제 목표]
- 빈칸은 단순 문장 완성이 아니라 핵심 논리 추론을 요구해야 한다.
- 학생이 글 전체 논리를 개념 수준에서 재구성해야 해결 가능해야 함.

[정답 설계]
- 본문 표현 반복 금지
- 핵심 개념을 추상화 및 paraphrase하여 제작
- 원문 의미를 다른 개념 구조로 재표현할 것
- local context만으로는 풀리지 않게 만들 것

[학생이 반드시 추론해야 하는 요소]
- contrast
- causality
- author stance
- rhetorical flow
- abstract/general relationship

[오답 설계]
1. 부분적으로만 맞음
2. 논리 방향 반대
3. example와 claim 혼동
4. 지나친 일반화
5. 극단적 표현

[High-Level Blank Design]
- Prefer abstract noun phrases over concrete wording.
- Require conceptual reconstruction rather than sentence completion.
`,

  summary: `
--- summary (요약문 완성 유형) ---

[핵심 규칙]
- The summary sentence must paraphrase the passage instead of compressing sentences mechanically.
- (A) and (B) must represent the conceptual backbone of the text.
- The correct option should reconstruct the author's logic at a higher level of abstraction.
- Wrong choices should contain:
  · partial truth
  · reversed causality
  · exaggerated generalization
  · irrelevant detail emphasis

- question_text 형식 (반드시 정확히 준수):
첫 번째 줄: "다음 글의 내용을 한 문장으로 요약하고자 한다. 빈칸 (A), (B)에 들어갈 말로 가장 적절한 것은?"
빈 줄 (\\n\\n 필수)
두 번째 부분: 완전한 영어 요약문. (A)와 (B)를 "_________"로 표시.

- 요약문 길이 기준 (최우선 규칙):
  · 영어 요약문은 반드시 200~230자(character) 이내로 작성할 것 — 초과 절대 금지.
  · 단어 수 기준 30~38단어 수준.
  · 핵심 논리 구조(전제 → 결론, 대조, 인과)를 담되 불필요한 수식어·부연 설명 금지.
  · 종속절·분사구문·관계절 중 1개만 포함한 간결한 복문 형태.
  · (A)와 (B)가 문장의 핵심 논리적 범주를 채우는 위치에 배치되어야 함.

예시 (이 형식 그대로 사용):
"다음 글의 내용을 한 문장으로 요약하고자 한다. 빈칸 (A), (B)에 들어갈 말로 가장 적절한 것은?\\n\\nAlthough humans often perceive themselves as purely rational beings, their decision-making is fundamentally shaped by (A) _________ foundations that precede reason, suggesting that (B) _________ processes are not the sole basis of judgment."

- 요약문은 반드시 question_text 안에 \\n\\n 뒤에 포함할 것. 별도 필드 사용 금지.

- choices text 형식 (반드시 준수):
text 필드에 "(A) 단어1 --- (B) 단어2" 형식으로 한 줄로 작성.
예시: {"number": 1, "text": "(A) affective --- (B) analytical"}
절대 (A)와 (B)를 별도 필드로 분리하지 말 것.

[출제 목표]
- 글 전체 논리를 한 단계 추상화하여 요약하게 만들 것.
- 단순 topic keyword 복원이 아니라 author's claim reconstruction을 요구할 것.

[정답 설계]
- 본문 핵심 단어 직접 반복 금지
- conceptual paraphrase 사용
- 요약문은 원문보다 더 추상적인 수준에서 재구성할 것
- (A), (B)는 isolated vocabulary가 아니라 conceptual categories여야 함

[오답 설계]
- 하나만 맞음
- 논리 관계 오류
- 표면 키워드만 맞음
- 방향성 반대
- 세부 정보만 반영

[Advanced Summary Design]
- The summary must express the author's ultimate claim.
- Avoid sentence-level paraphrase.
- Require abstract conceptual reasoning.

[KICE 실전 요약문 설계 원칙 — PDF 분석 기반]
- (A)와 (B)는 반드시 서로 다른 의미 범주에서 출제할 것:
  · (A) = 원인/조건/방법/특성 범주 (예: divergent, impartial, comprehensive, unfounded)
  · (B) = 결과/효과/상태/관계 범주 (예: segregation, autonomy, adaptability, interconnection)
  · (A)와 (B)가 같은 의미 범주에서 나오는 것을 절대 금지
- 요약문 문장 구조 권장 패턴:
  · "While/Although [대조절], [주어] [동사] a(n) (A) [명사/형용사], which [결과절] (B) [명사]."
  · "By [방법구/분사구], [주어] can [결과동사] (A) [명사], enhancing [목적어]'s (B) [명사]."
  · "[주어]'s [행위] is (A) [형용사] because [이유절], making [목적어] (B) [형용사/명사]."
- 오답 5개 중 반드시 2개는 "한 쪽 빈칸만 맞고 다른 쪽은 틀린" 트랩으로 설계할 것
  · 예) (A)는 맞지만 (B)가 논리 방향 반대인 선지 1개
  · 예) (B)는 맞지만 (A)가 과잉 일반화인 선지 1개
- 나머지 3개 오답: ① 둘 다 틀리지만 표면상 그럴듯 ② 논리 완전 반전 ③ 세부 정보 수준 어휘
- (A)(B) 두 단어는 원문에 등장하지 않는 개념적 paraphrase여야 함 — 원문 단어 직접 사용 금지
`,

  flow: `
--- flow (흐름과 관계 없는 문장 유형) ---

[핵심 규칙]
- The irrelevant sentence must share surface keywords with surrounding sentences.
- However, it must fail to contribute to the passage's logical progression.
- The incorrect sentence should shift one of the following without appearing obviously unrelated:
  · topic scope
  · time frame
  · discourse function
  · causal chain
- The passage must maintain a single coherent progression such as:
  · claim → evidence
  · question → answer
  · misconception → correction
  · cause → effect
- The irrelevant sentence must interrupt this progression.

- question_text: "다음 글에서 전체 흐름과 관계 없는 문장은?" (이 문자열 고정, 변경 금지)

- modified_passage 형식 (반드시 준수):
  · 구조: [번호 없는 intro 2~3문장] + [①문장] + [②문장] + [③문장] + [④문장] + [⑤문장]
  · 전체를 하나의 연속된 단락으로 작성 — ①~⑤ 앞에 줄바꿈(\n) 절대 금지
  · ①~⑤ 는 각 문장 바로 앞에 공백 하나만 두고 붙임: "...intro. ①Sentence here. ②Sentence here."
  · intro는 원본 지문의 첫 2~3문장을 번호 없이 그대로 배치 (1문장 intro 금지)
  · ①~⑤ 5개 문장 중 1개가 흐름과 관계 없는 삽입 문장
  · 삽입 위치는 ①~⑤ 중 하나 (①과 ⑤에만 고정하지 말고 다양하게 배치)

[문장 길이 규칙 — 반드시 준수]
  · modified_passage 전체 길이는 반드시 800자(character) 이상 1300자 이내
  · 800자 미만 또는 1300자 초과 절대 금지 — 이 제한이 최우선 규칙
  · intro: 1~2문장 (2문장 권장), 각 문장 15~25단어 수준
  · ①~⑤: 각 문장 15~25단어 수준
  · 각 문장은 종속절·관계절·분사구문 중 최소 1개 포함 (단문 금지)
  · 단, 문장 길이보다 전체 1300자 이내 제한이 우선이므로 초과할 것 같으면 문장을 줄일 것

- choices: 반드시 아래 고정값 사용
  [{"number":1,"text":"①"},{"number":2,"text":"②"},{"number":3,"text":"③"},{"number":4,"text":"④"},{"number":5,"text":"⑤"}]

- answer: 흐름과 관계 없는 문장의 번호 (1~5 정수)

[정답 문장 설계]
- 겉보기에 자연스럽고, 주변 문장과 핵심 키워드 1~2개를 공유하며, 표면적으로 연결되는 것처럼 보일 것
- 그러나 논리 전개상 / 주제 방향상 / 문단 기능상 명확히 어긋날 것
- 어긋나는 방식: unrelated topic / wrong causal direction / irrelevant example / abrupt topic shift / different abstraction level 중 하나

[함정 설계]
- 정답 문장에 주변 문장의 핵심 키워드 최소 1~2개를 재활용 (superficial coherence 함정)
- 학생이 표면적 연결에 속도록 설계
- 정답 문장이 지나치게 튀거나 이질적으로 보이면 안 됨

[고난도 조건]
- 나머지 4개 문장은 서로 긴밀하게 연결, discourse marker (however / therefore / in fact / for example 등) 기능 일관되게 유지
- 학생이 paragraph-level rhetorical flow를 분석해야만 정답 도출 가능하게 설계
- example ↔ claim / cause ↔ result / general ↔ specific / problem ↔ solution 관계를 추론하게 만들 것
- The irrelevant sentence must appear superficially coherent while failing rhetorically or logically.
- The irrelevant sentence should share topic keywords with adjacent sentences.
- However, it must fail in rhetorical function or logical progression.
- Avoid obviously unrelated topic shifts.
- The sentence should appear superficially coherent on first reading.
- The irrelevant sentence must belong to the same academic topic field as the surrounding sentences.
- The sentence should disrupt logical progression rather than introduce an obviously unrelated topic.
`,

  phrase_meaning: `
--- phrase_meaning (밑줄 어구 의미 추론 유형) ---

[핵심 규칙]
- Do NOT test dictionary-level synonym replacement.
- The question must ask for the contextual function and implication of the phrase.
- The correct answer must explain what the expression means within the passage's logic.
- Distractors should:
  · overgeneralize
  · narrow the scope incorrectly
  · reverse causality
  · introduce unsupported interpretation
  · partially match surface wording
- At least two choices must appear highly plausible through shared conceptual vocabulary.

- question_text 형식 (반드시 준수):
  "밑줄 친 [실제 밑줄 표현] 이 다음 글에서 의미하는 바로 가장 적절한 것은?"
  예시: "밑줄 친 every man has a horizon of his own 이 다음 글에서 의미하는 바로 가장 적절한 것은?"
  주의: 대괄호 없이 실제 표현을 삽입할 것

- modified_passage 형식 (반드시 준수):
  · 원본 지문 전체를 그대로 사용할 것 — 첫 문장부터 마지막 문장까지 절대 생략·요약·축약 금지.
  · 지문 속 핵심 추상/비유/함축/일반화 표현을 [대괄호]로 감싸 밑줄 대상 표시
  · 예시: "...In fact, [every man has a horizon of his own], and he will expect..."
  · 표현 길이: 단어 2개 이상 ~ 절 수준 가능, 지문 원문 그대로 사용
  · 대괄호는 하나만 사용할 것 (여러 곳 금지)
  · 단락 일부를 발췌하거나 요약한 지문 사용 절대 금지 — 원문 지문과 동일한 전체 문장 수를 유지할 것

- choices: 5개 영어 문장 또는 절 형태 (원형 번호 없이 텍스트만)
  · text 필드에 반드시 완전한 영어 문장 또는 절을 작성할 것
  · 각 선택지 text는 반드시 55자(character) 이상 110자 이내 — 55자 미만 또는 110자 초과 절대 금지
  · ①②③④⑤ 기호를 text 필드에 절대 사용 금지 — 텍스트만 작성
  · 올바른 형식 예시:
    {"number": 1, "text": "one's success is judged by how many goals he has achieved"}
    {"number": 2, "text": "each one has his own methods of getting what he wants"}
    {"number": 3, "text": "there cannot be any limit to what one desires in his mind"}
    {"number": 4, "text": "one's standard of happiness is tailored to societal norms"}
    {"number": 5, "text": "the limit of what one desires to get varies by person"}
  · 잘못된 형식 (절대 금지): {"number": 1, "text": "①"}
  · 각 오답은 서로 다른 방식으로 틀릴 것:
    1. 부분적으로만 맞음 (partially correct)
    2. 표면 키워드는 맞지만 논리 방향이 틀림 (keyword match, wrong direction)
    3. 지나친 일반화 (over-generalization)
    4. 예시 수준 해석 (example-level interpretation)
    5. 감정/가치 방향 반대 (reversed implication)
  · 선택지 중 2개는 매우 헷갈리게 구성 (본문 키워드 활용 함정)

- answer: 1~5 정수

[밑줄 표현 선정 기준 — 우선순위]
① 비유 표현 (metaphor, analogy)
② 추상화된 일반 명제 (abstract generalization)
③ 철학적/심리적 함축 표현
④ 역설적 표현

[정답 설계]
- 정답: literal meaning이 아닌 intended implication의 conceptual paraphrase
- 직접적인 단어 치환 금지
- abstract reasoning 기반으로 재진술
- keyword matching만으로 절대 풀리지 않게 설계

[KICE-style abstraction]
- The correct answer should reflect the author's intended implication rather than surface wording.
- Require inference beyond sentence-level comprehension.
- Prefer abstract conceptual interpretation over direct paraphrase.
- The question must test implied meaning, not dictionary meaning.
- Avoid structurally mirroring the underlined expression in the correct answer.
- The correct answer should reinterpret the implication conceptually rather than restating the structure.
- At least two distractors must remain plausible even after understanding the surface meaning.
- Distractors should remain plausible even after understanding the literal meaning of the underlined phrase.
- Avoid distractors that introduce completely new causal explanations absent from the passage.
`,

  sentence_order: `
--- sentence_order (순서 배열 유형) ---

[핵심 규칙]
- The correct order must depend on logical progression, not superficial connectors.
- Students should track:
  · pronoun reference
  · causal sequence
  · abstract-to-concrete movement
  · claim-evidence structure
  · contrast and concession
- Avoid making the answer solvable through a single transition word.
- Wrong sequences should preserve local coherence while breaking global logic.

[생성 목표]
수능·평가원 스타일의 "글의 순서 배열" 문제를 생성한다.
학생이 단순 키워드 연결이 아니라,
논리 전개 구조(도입→설명→예시→결론)를 분석해야만 정답을 찾을 수 있어야 한다.

━━━━━━━━━━━━━━━━━━
[question_text — 고정]
━━━━━━━━━━━━━━━━━━

"주어진 글 다음에 이어질 글의 순서로 가장 적절한 것은?"

⚠️ 절대 규칙: question_text 필드에는 위 지시문 문자열만 넣을 것.
[주어진 글], (A), (B), (C) 본문은 반드시 modified_passage 필드에만 작성할 것.
question_text에 지문 내용 포함 절대 금지.

━━━━━━━━━━━━━━━━━━
[가장 중요한 규칙 — 원본 지문 재구성]
━━━━━━━━━━━━━━━━━━

❌ 새로운 문장 창작 절대 금지.
✅ 원본 지문의 문장들을 그대로 사용하되, 순서를 재배치하여 [주어진 글] + (A)(B)(C)로 구성.

- 원본 지문의 모든 문장을 유지할 것 (추가·삭제·변형 금지).
- [주어진 글]에 원본 첫 문장(또는 도입에 적합한 문장)을 배치.
- 나머지 문장들을 논리적으로 (A)(B)(C) 세 단락으로 묶어 순서를 섞음.
- 학생이 원래 순서를 추론해야 정답에 도달하도록 설계.

━━━━━━━━━━━━━━━━━━
[modified_passage 구조 — 필수 형식]
━━━━━━━━━━━━━━━━━━

modified_passage는 반드시 아래 형식으로 작성:

[주어진 글]
{원본 도입 문장 1~2개}

(A)
{원본 지문 문장 2~4개 묶음}

(B)
{원본 지문 문장 2~4개 묶음}

(C)
{원본 지문 문장 2~4개 묶음}

규칙:
- [주어진 글]은 독립적으로 이해 가능한 원본 도입부.
- (A)(B)(C)는 원본 문장을 묶어 만든 단락. 단락 간 배치 순서를 섞는 것이지, 단락 내 문장 순서는 반드시 원본 지문 순서를 유지해야 한다.
- Sentences within each segment (A)(B)(C) must appear in the EXACT same order as they appear in the original passage. Do NOT reorder sentences within a segment.
- 각 단락은 지시어·연결어·대명사를 통해 앞 내용 없이는 이해 불가한 구조여야 함.

[Critical Constraint]
No sentence from the original passage may appear more than once across:
- the introduction paragraph
- A/B/C segments

Each sentence must belong to exactly ONE location.
If any sentence is duplicated, regenerate the entire question.

The task is NOT to arbitrarily split the passage.
The reordered segments must form a valid discourse progression.

Each segment must:
- continue logically from the previous segment
- introduce new information naturally
- preserve referential cohesion
- avoid repeated topic introduction

Exactly ONE order must satisfy:
- logical progression
- referential consistency
- discourse continuity.

Alternative plausible orders must be eliminated.

━━━━━━━━━━━━━━━━━━
[choices — 고정 형식]
━━━━━━━━━━━━━━━━━━

choices는 반드시 아래 5개를 그대로 사용:
{"number":1,"text":"① (A)-(B)-(C)"}
{"number":2,"text":"② (A)-(C)-(B)"}
{"number":3,"text":"③ (B)-(A)-(C)"}
{"number":4,"text":"④ (B)-(C)-(A)"}
{"number":5,"text":"⑤ (C)-(A)-(B)"}

━━━━━━━━━━━━━━━━━━
[answer]
━━━━━━━━━━━━━━━━━━

- 정답 배열 번호 1개 (1~5)
- [주어진 글] 이후 논리적으로 완결된 단 하나의 순서가 정답

━━━━━━━━━━━━━━━━━━
[핵심 출제 원칙]
━━━━━━━━━━━━━━━━━━

순서는 반드시 아래 요소를 통해 결정 가능해야 한다:

1. 지시어 연결
   - this / these / such / those / they / this idea / this process
   - 반드시 앞 내용이 있어야 이해 가능한 구조

2. 논리 단계
   - 문제 제기 → 원인 분석 → 사례 → 결론
   - 일반 주장 → 구체 사례
   - 개념 설명 → 실험 결과
   - 현상 → 결과

3. 연결어
   - however / therefore / for example / in contrast / consequently
   - 접속부사의 논리 방향이 이전 단락과 맞아야 함

4. 정보량 비대칭
   - 앞 단락에서 개념 소개
   - 뒤 단락에서 "this phenomenon" 식 회수

5. 관사·대명사
   - a/an → the progression
   - 최초 언급 → 재언급 구조 활용

━━━━━━━━━━━━━━━━━━
[고난도(C1~C2) 생성 규칙]
━━━━━━━━━━━━━━━━━━

반드시 아래 중 최소 2개 이상 사용:

① 역접 흐름: however / nevertheless / despite this
② 개념 회수: this tendency / such behavior / these findings
③ 원인→결과: therefore / consequently / as a result
④ 일반→구체: abstract principle → experimental evidence
⑤ 시간 흐름: initially / subsequently / eventually
⑥ 문제→해결: challenge → proposed method → implication

━━━━━━━━━━━━━━━━━━
[금지 사항]
━━━━━━━━━━━━━━━━━━

❌ 시간표현만으로 즉시 정답 보이는 구조 (First → Second → Finally)
❌ 노골적 연결 ("As mentioned in paragraph A")
❌ 키워드만 반복되는 단락
❌ 단락 길이 극단적 차이
❌ 선택지 하나만 압도적으로 자연스러운 경우

Do NOT create segments that:
- begin with unexplained pronouns
- repeat already introduced concepts
- contain duplicated transition signals
- can logically follow multiple locations equally well

Do NOT determine order primarily by transition words.

Prioritize:
1. discourse progression
2. topic continuity
3. referential cohesion
4. semantic development

Transition markers alone are insufficient evidence.

━━━━━━━━━━━━━━━━━━
[정답 자기검증]
━━━━━━━━━━━━━━━━━━

생성 후 반드시 확인:
1. 정답 배열만 완전한 논리 흐름인가?
2. 각 단락의 지시어가 선행 내용을 필요로 하는가?
3. 학생이 단순 키워드 매칭만으로 풀 수 없는가?
4. conclusion 단락이 앞에 오면 부자연스러운가?

━━━━━━━━━━━━━━━━━━
[explanation]
━━━━━━━━━━━━━━━━━━

각 단락 간 연결 논리를 한글로 설명:
- 지시어, 대명사, 일반→구체, 문제→해결, 역접, 예시 확장 등
- 왜 이 순서만 논리적으로 완결되는지 상세히 설명
`
};

  const selectedRules = typeRules.common_principles + '\n' + questionTypes.map(t => typeRules[t] || '').join('\n');

  return `너는 대한민국 수능 영어영역 출제위원이다. 20년 경력의 수능 영어 전문가로서 아래 영어 지문을 바탕으로 요청된 유형의 수능형 문제를 생성하라.

=== 영어 지문 ===
${text}
=== 지문 끝 ===

요청 유형: ${questionTypes.join(', ')}

반드시 아래 JSON 형식으로만 반환하라. 마크다운 코드블록 없이 순수 JSON만 출력하라.

{
  "questions": []
}

=== 공통 출제 원칙 ===
- 실제 대한민국 수능 영어 스타일을 유지한다.
- 선택지 길이는 비슷하게 유지한다.
- 정답이 지나치게 눈에 띄지 않게 한다.
- 평가원 스타일의 논리적 함정을 포함한다.
- AI 문제 티가 나지 않게 정교하게 문제를 생성한다.
- 선택지는 반드시 5개.

${
  difficulty === 'b1' ? `=== 어휘 난이도 기준 [중등 — CEFR B1] (최우선 적용) ===
- 모든 선지·빈칸어휘는 중학교 수준의 준학술 어휘를 사용한다.
- 너무 쉬운 일상어(get, make, go, say 등)는 선지로 사용 금지.
- CEFR B1 수준 어휘 예시:
  · 추상명사: ability, benefit, challenge, connection, environment, experience, knowledge, opportunity, society, purpose
  · 동사: achieve, allow, compare, consider, discover, express, improve, provide, support, suggest
  · 형용사: certain, common, creative, cultural, emotional, individual, natural, positive, practical, traditional
- 선지 단어는 중학교~고등학교 초급 어휘로 구성하되 단순 암기로도 도전 가능한 수준.
- 낱말 쓰임형 선지: 5개 모두 B1 학술 어휘로 구성.
- 어휘 (a)(b) 빈칸형: 빈칸 어휘는 중학교 수준 핵심 어휘 사용.
- 빈칸 추론·요약문 완성: 선지는 구/절 형태이되 핵심 어휘가 B1 수준 포함.`
  : difficulty === 'b2' ? `=== 어휘 난이도 기준 [고등 중 — CEFR B2] (최우선 적용) ===
- 모든 선지·빈칸어휘는 고2~고3 일반 수능 필수 어휘 수준으로 사용한다.
- 쉬운 일상 어휘(get, make, use, find, show, help, need, want 등)는 선지에 사용 금지.
- CEFR B2 수준 어휘 예시:
  · 추상명사: approach, analysis, evidence, behavior, structure, process, function, effect, influence, pattern
  · 동사: analyze, establish, maintain, consider, develop, identify, represent, demonstrate, indicate, evaluate
  · 형용사: significant, complex, specific, relevant, effective, consistent, fundamental, traditional, logical, flexible
- 선지 단어는 2음절 이상 학술 어휘로 구성하되 고등학생 상위권이 이해할 수 있는 수준으로 제한한다.
- 낱말 쓰임형 선지: 5개 모두 B2 학술 어휘로 구성.
- 어휘 (a)(b) 빈칸형: 빈칸 어휘는 수능 필수 어휘 중 표준 수준 사용.
- 빈칸 추론·요약문 완성: 선지는 구/절 형태이되 핵심 어휘가 B2 수준 포함.`
  : difficulty === 'c1' ? `=== 어휘 난이도 기준 [고등 중상 — CEFR C1] (최우선 적용) ===
- 모든 선지·빈칸어휘는 고3 수능 고난도 어휘 수준으로 사용한다.
- 쉬운 일상 어휘(get, make, use, find, show, help, need, want 등)는 선지에 사용 금지.
- CEFR C1 수준 어휘 예시:
  · 추상명사: cognition, motivation, inference, perception, disposition, framework, mechanism, assumption, tendency
  · 동사: facilitate, perpetuate, elicit, constrain, embody, undermine, reinforce, diminish, enhance, convey, manifest
  · 형용사: cognitive, rational, empirical, inherent, subjective, explicit, implicit, nuanced, sequential, hierarchical
- 선지 단어는 반드시 2음절 이상, C1 수준 학술 어휘로 구성한다.
- 낱말 쓰임형 선지: 5개 모두 C1 학술 어휘로 구성.
- 어휘 (a)(b) 빈칸형: 빈칸 어휘는 수능 고난도 필수 어휘로 사용.
- 빈칸 추론·요약문 완성: 선지는 구/절 형태이되 핵심 어휘가 C1 수준 포함.`
  : `=== 어휘 난이도 기준 [고등 최상 — CEFR C2] (최우선 적용) ===
- 모든 선지·빈칸어휘는 C2 수준 이상만 사용한다.
- 쉬운 일상 어휘(get, make, use, find, show, help, need, want 등)는 선지에 사용 금지.
- CEFR C2 수준 어휘 예시:
  · 추상명사: epistemology, predisposition, circumspection, teleology, hegemony, dialectic, reification, ontology, axiom, equivocation
  · 동사: extrapolate, instantiate, obfuscate, attenuate, promulgate, reify, adjudicate, interpolate, countervail
  · 형용사: axiomatic, tendentious, inimical, perspicacious, inveterate, recondite, sanguine, ineluctable, protean
- 선지 단어는 반드시 2음절 이상, C2 수준 학술 어휘로만 구성한다. 일반 고3 수준 어휘(cognitive, emotional, rational 등) 단독 사용 금지.
- 낱말 쓰임형 선지: 정답 포함 5개 모두 C2 수준 고급 학술 어휘로 구성.
- 어휘 (a)(b) 빈칸형: 빈칸 어휘 자체가 고난도여야 하며, 선지 단어쌍도 C2 어휘 사용.
- 빈칸 추론·요약문 완성: 선지는 구/절 형태이되 핵심 어휘가 반드시 C2 수준 포함.`
}

=== 유형별 세부 규칙 ===
${selectedRules}

=== 각 문제 객체 JSON 구조 ===
{
  "type": "유형키 (예: topic_title)",
  "question_text": "문제 지시문 전체 (요약문 유형은 요약문 포함)",
  "modified_passage": "수정된 지문 (grammar/vocab_blank/fill_blank/vocab_paraphrase/sentence_order 유형만, 해당 없는 유형은 키 자체 생략)",
  "choices": [
    {"number": 1, "text": "선지1"},
    {"number": 2, "text": "선지2"},
    {"number": 3, "text": "선지3"},
    {"number": 4, "text": "선지4"},
    {"number": 5, "text": "선지5"}
  ],
  "answer": 정답번호,
  "explanation": "한글로 정답 근거와 오답 이유 상세 설명"
}

[선지 text 필드 절대 규칙]
- flow 유형만: choices text 필드에 "①"~"⑤" 기호 단독 사용 허용.
- sentence_order 유형: choices text 필드에 "① (A)-(B)-(C)" 형식 사용 (프롬프트 지정 형식 그대로).
- 그 외 모든 유형(topic_title, fill_blank, phrase_meaning, summary, vocab_blank): choices text 필드에 반드시 완전한 영어 명사구/절/문장을 작성할 것. ①②③④⑤ 기호만 있는 선지 절대 금지.

반드시 요청된 유형 순서대로 questions 배열에 포함하라. 요청되지 않은 유형은 생성하지 마라.${targetAnswer != null ? `

[정답 위치 지정 — 절대 준수]
이번 문제의 정답(answer) 번호는 반드시 ${targetAnswer}번이어야 한다. 다른 번호는 정답이 될 수 없다.` : ''}`;
}

const MULTI_STEP_TYPES = new Set(['vocab_paraphrase', 'phrase_meaning', 'vocab_blank', 'fill_blank', 'summary', 'sentence_order']);

function buildAnalysisPrompt(text: string, questionType: string, targetAnswer: number | undefined): string {
  if (questionType === 'grammar') {
    return `수능 어법 문제 출제 계획을 세워라.

[지문]
${text}

수행 순서:
1. 관계사/병렬/분사/명사절/수일치/준동사/재귀대명사 구조 포인트를 지문에서 8개 찾고 원문 표현 인용
2. 그 중 구조 분석 없이 판단 불가능한 5개 선정 → ①②③④⑤ 번호 부여
3. ${targetAnswer}번 위치를 오류 위치로 확정:
   - 원문 표현 → 오류 삽입 표현 (구체적으로 명시)
   - 위반 문법 규칙 명시 (예: "관계부사 where → 관계대명사 which 교체")
4. 나머지 4개: 틀려보이지만 완전히 맞는 이유 각각 설명

분석 텍스트만 출력. JSON 금지.`;
  }

  if (questionType === 'sentence_order') {
    return `You are a KICE-style CSAT English item writer. Analyze the passage below and plan a sentence ordering question.

[Passage]
${text}

STEP 1
Identify:
1. topic sentence
2. supporting progression
3. causal relations
4. referential links (pronouns, demonstratives, definite articles)
5. concluding statements

STEP 2
Split the passage ONLY at valid discourse transition points.
- List every sentence as S1, S2, S3...
- Assign each sentence to exactly ONE location: intro / A / B / C
- No sentence may appear in more than one location
- Do NOT determine split points primarily by transition words
- Prioritize: discourse progression > topic continuity > referential cohesion > semantic development
- Transition markers alone are insufficient evidence for a split
- CRITICAL: sentences within each segment must remain in the EXACT original passage order — do NOT reorder sentences inside A, B, or C

STEP 3
Generate A/B/C groupings:
- Intro: 1~2 sentences that can stand alone as an opening
- A, B, C: remaining sentences grouped by logical role
- Determine the ONLY correct order based on logical progression, referential cohesion, and discourse continuity
- State which choice number (1~5) the correct order maps to: 1=(A)-(B)-(C), 2=(A)-(C)-(B), 3=(B)-(A)-(C), 4=(B)-(C)-(A), 5=(C)-(A)-(B)

STEP 4
Verify:
- no duplicated sentence across intro/A/B/C
- exactly one coherent order exists
- pronoun references resolve correctly within each segment
- no segment can independently serve as the opening
- alternative orders fail due to referential or logical breakdown

Output analysis text only. No JSON.`;
  }

  if (questionType === 'phrase_meaning') {
    return `수능 어구 의미 추론 문제 출제 계획을 세워라.

[지문]
${text}

수행 순서:
1. 비유/추상/함축/역설 표현 후보 6개를 지문에서 찾아 원문 그대로 인용
2. 가장 고난도 추론이 필요한 표현 1개 선정 + 이유 (전체 논리 파악 필요)
3. 해당 표현의 진의(intended implication) — literal 의미가 아닌 필자 의도 설명
4. 정답 선지 (55~110자 영어 문장, conceptual paraphrase):
   - ${targetAnswer}번 위치의 정답
   - literal 의미가 아닌 추상적 재진술
5. 오답 4개 (각 55~110자, 서로 다른 실패 방식):
   - 부분 일치 / 역방향 / 과잉일반화 / 예시수준 / 반대함의 중 4가지

분석 텍스트만 출력. JSON 금지.`;
  }

  if (questionType === 'vocab_paraphrase') {
    return `수능 낱말 쓰임 문제 출제 계획을 세워라.

[지문]
${text}

수행 순서:
1. 지문의 핵심 논리 흐름 파악: 주제·중심 주장·전개 방향 1~2줄 요약
2. 밑줄 후보 단어 8개 선정 (명사/동사/형용사 중 문맥 의존도 높은 단어, 원문 그대로 인용)
   - 선정 기준: 주변 문맥 없이는 적절성 판단 불가능한 단어
   - 관사/전치사/접속사 금지
3. 후보 중 5개 선정 → ①②③④⑤ 번호 부여 + 위치(문장 인용)
4. ${targetAnswer}번 위치를 오답(문맥상 부적절) 단어로 확정:
   - 원문 단어 → 교체할 반의어/혼동어 결정
   - 왜 문맥상 부적절한지 설명
   - 교체 단어가 원문에 없는 단어인지 확인
5. 나머지 4개: 원문 단어 → 문맥상 적절한 새 단어로 교체 계획
   - 각 교체 단어가 원문에 없는 단어인지 확인
   - 왜 문맥상 적절한지 설명

분석 텍스트만 출력. JSON 금지.`;
  }

  if (questionType === 'vocab_blank') {
    return `수능 어휘 (a)(b) 빈칸 문제 출제 계획을 세워라.

[지문]
${text}

수행 순서:
1. 지문의 핵심 논리 구조 분석: 전체 주장 1~2줄 요약 + 핵심 인과·대조 관계 명시
2. (a) 후보 위치 3곳 선정 (지문 앞부분):
   - 조건: 글 전체 논리와 인과/대조 관계를 이해해야 적절성 판단 가능한 어휘
   - 원문 문장 그대로 인용 + 해당 어휘 명시
   - 중요: 지문 전체에서 딱 1번만 등장하는 단어를 선택할 것. 같은 단어가 2번 이상 등장하면 후보에서 제외.
3. (b) 후보 위치 3곳 선정 (지문 뒷부분):
   - 조건: (a)와 다른 의미 범주 (원인↔결과, 방법↔상태, 특성↔효과 등)
   - 원문 문장 그대로 인용 + 해당 어휘 명시
   - 중요: 지문 전체에서 딱 1번만 등장하는 단어를 선택할 것. 같은 단어가 2번 이상 등장하면 후보에서 제외.
4. 최종 (a)(b) 위치 확정:
   - (a)와 (b)가 지문의 conceptual backbone을 대표하는지 확인
   - 단순 동의어 암기로는 판단 불가능한지 확인
   - (a)와 (b) 각각 modified_passage에서 정확히 1번만 등장하는지 최종 확인. 반복 단어 선택 금지.
5. 정답 선지 설계: 정답은 ${targetAnswer}번
   - "(a) 단어 --- (b) 단어" 형식으로 정답 확정
   - 정답 단어는 원문 표현 직접 사용 금지 — conceptual paraphrase 사용
6. 오답 4개 설계 (서로 다른 실패 방식):
   - (a)만 맞고 (b)는 논리 반대인 선지 1개
   - (b)만 맞고 (a)는 과잉일반화인 선지 1개
   - 둘 다 표면상 그럴듯하지만 논리 왜곡인 선지 1개
   - 둘 다 틀리고 인과 방향 반전인 선지 1개

분석 텍스트만 출력. JSON 금지.`;
  }

  if (questionType === 'fill_blank') {
    return `수능 빈칸 추론 문제 출제 계획을 세워라.

[지문]
${text}

수행 순서:
1. 지문 전체 논리 구조 분석:
   - 핵심 주장(core claim) 1문장으로 요약
   - 전개 방식: claim→evidence / problem→solution / contrast / cause→effect 중 해당 구조 명시
   - 학생이 반드시 추론해야 하는 논리 관계 명시
2. 빈칸 후보 위치 4곳 선정:
   - 조건: 글 전체 논리를 재구성해야만 채울 수 있는 핵심 논리 구간
   - local context만으로는 절대 풀리지 않는 위치
   - 원문 문장 인용 + 빈칸 대상 구간 명시
3. 최적 빈칸 위치 1곳 확정 + 이유:
   - 왜 이 위치가 글의 핵심 논리 주장을 담는지 설명
   - 빈칸 앞뒤 문장의 논리 연결 구조 설명
4. 정답 선지 설계: 정답은 ${targetAnswer}번
   - 원문 표현 직접 반복 금지 — 다른 구문·추상 어휘로 paraphrase
   - lexical overlap 없이 의미만 보존
5. 오답 4개 설계 (서로 다른 실패 방식):
   - 부분 정보만 반영 1개
   - 논리 방향 반대 1개
   - 예시와 핵심 주장 혼동 1개
   - 표면 키워드 재활용하되 논리 왜곡 1개

분석 텍스트만 출력. JSON 금지.`;
  }

  if (questionType === 'summary') {
    return `수능 요약문 완성 문제 출제 계획을 세워라.

[지문]
${text}

수행 순서:
1. 지문 전체 논리 구조 분석:
   - 필자의 핵심 주장을 1문장으로 추상화
   - 전제·조건·결과·대조 관계를 명시
2. 요약문 설계 (반드시 200~230자(character) 이내):
   - 지문을 기계적으로 압축하지 말고 한 단계 높은 추상 수준에서 재구성
   - 구조 권장: While/Although [대조절], [주어] [동사] (A) [명사], which [결과절] (B) [명사]
   - (A)는 원인/조건/방법/특성 범주, (B)는 결과/효과/상태/관계 범주
   - (A)(B) 두 단어는 원문에 등장하지 않는 conceptual paraphrase여야 함
   - 요약문 전체 character 수를 반드시 세어 200~230자 이내인지 확인
3. (A)(B) 정답 확정:
   - (A)와 (B)가 지문의 conceptual backbone을 대표하는지 확인
   - 서로 다른 의미 범주인지 확인
4. 정답 선지: 정답은 ${targetAnswer}번
   - "(A) 단어 --- (B) 단어" 형식
5. 오답 4개 설계:
   - (A)는 맞지만 (B)가 논리 방향 반대인 선지 1개
   - (B)는 맞지만 (A)가 과잉 일반화인 선지 1개
   - 둘 다 틀리지만 표면상 그럴듯한 선지 1개
   - 논리 완전 반전 선지 1개

분석 텍스트만 출력. JSON 금지.`;
  }

  return '';
}

function extractJson(text: string): string {
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) return codeBlock[1].trim();
  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}');
  if (jsonStart !== -1 && jsonEnd !== -1) return text.slice(jsonStart, jsonEnd + 1);
  return text.trim();
}

interface TypeConfigInput {
  type: string;
  difficulty: 'b1' | 'b2' | 'c1' | 'c2';
  count: number;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      text: string;
      typeConfigs?: TypeConfigInput[];
      // legacy fields (backward compat)
      questionTypes?: string[];
      difficulty?: 'b1' | 'b2' | 'c1' | 'c2';
      academy_id?: string;
    };

    const { text, academy_id } = body;

    // 신규 typeConfigs 방식 또는 구버전 questionTypes+difficulty 방식 모두 지원
    let enabledConfigs: TypeConfigInput[];
    if (body.typeConfigs && body.typeConfigs.length > 0) {
      enabledConfigs = body.typeConfigs.filter(c => c.type && VALID_TYPES.has(c.type));
    } else if (body.questionTypes && body.questionTypes.length > 0) {
      const diff = body.difficulty ?? 'b2';
      enabledConfigs = body.questionTypes
        .filter(t => VALID_TYPES.has(t))
        .map(t => ({ type: t, difficulty: diff, count: 1 }));
    } else {
      enabledConfigs = [];
    }

    if (!text || text.trim().length < 50) {
      return NextResponse.json({ error: '지문 텍스트가 너무 짧습니다.' }, { status: 400 });
    }
    if (enabledConfigs.length === 0) {
      return NextResponse.json({ error: '문제 유형을 최소 1개 선택해주세요.' }, { status: 400 });
    }

    // CON 차감 — 문제 개수 기준 (count 합산)
    if (academy_id) {
      const pricePerType = await getFeaturePrice('ai_question_per_type');
      const totalQuestions = enabledConfigs.reduce((s, c) => s + Math.max(1, Math.min(3, c.count)), 0);
      const totalCost = pricePerType * totalQuestions;
      if (totalCost > 0) {
        const balance = await getConBalance(academy_id);
        if (balance < totalCost) {
          return NextResponse.json({
            error: 'INSUFFICIENT_CON',
            required: totalCost,
            balance,
            price_per_type: pricePerType,
          }, { status: 402 });
        }
        const supabaseAdmin = createAdminClient();
        const { error: deductError } = await supabaseAdmin.rpc('deduct_con', {
          p_academy_id: academy_id,
          p_amount: totalCost,
          p_feature_key: 'ai_question_per_type',
          p_description: `실전변형 문제 생성 (${totalQuestions}문제 × ${pricePerType}C)`,
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

    const CIRCLES = ['①','②','③','④','⑤'];

    const TYPE_MODEL_MAP: Record<string, string> = {
      grammar: 'gpt-5.5',
    };
    const DEFAULT_MODEL = 'gpt-5.1';

    const TYPE_TOKENS_MAP: Record<string, number> = {
      grammar: 4000,
      sentence_order: 3000,
    };
    const DEFAULT_TOKENS = 2500;

    // 유형별 개별 생성 + 검증 (난이도 파라미터 추가)
    const generateForType = async (questionType: string, difficulty: 'b1' | 'b2' | 'c1' | 'c2'): Promise<ExamQuestion | null> => {
      const MAX_RETRIES = (questionType === 'grammar' || questionType === 'vocab_paraphrase' || questionType === 'sentence_order' || questionType === 'phrase_meaning') ? 4 : 4;
      // sentence_order는 지문 자체가 논리 순서를 결정하므로 targetAnswer 강제 불가
      const targetAnswer = questionType === 'sentence_order' ? undefined : Math.floor(Math.random() * 5) + 1;
      const model = TYPE_MODEL_MAP[questionType] ?? DEFAULT_MODEL;
      const isMultiStep = MULTI_STEP_TYPES.has(questionType);
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        let q: ExamQuestion | undefined;
        try {
          type Msg = { role: 'user' | 'assistant'; content: string };
          let messages: Msg[];

          if (isMultiStep) {
            const analysisPrompt = buildAnalysisPrompt(text, questionType, targetAnswer);
            let analysis = '';
            try {
              const step1 = await client.chat.completions.create({
                model,
                max_completion_tokens: 1500,
                messages: [{ role: 'user' as const, content: analysisPrompt }],
              });
              analysis = step1.choices[0]?.message?.content ?? '';
              console.log(`[${questionType}] Step1 분석 완료 (${analysis.length}자)`);
            } catch (step1Err) {
              // Step1 실패 시 single-step으로 fallback
              console.warn(`[${questionType}] Step1 실패 → single-step fallback:`, step1Err);
            }

            if (analysis) {
              const step2Instruction = questionType === 'sentence_order'
                ? `위 분석을 바탕으로 문제를 생성하라. 분석에서 결정한 자연스러운 논리 순서를 정확히 반영할 것.\n\n${buildExamPrompt(text, [questionType], difficulty, undefined)}`
                : `위 분석을 바탕으로 문제를 생성하라. 분석에서 결정한 구조와 정답(${targetAnswer}번)을 정확히 반영할 것.\n\n${buildExamPrompt(text, [questionType], difficulty, targetAnswer)}`;
              messages = [
                { role: 'user', content: analysisPrompt },
                { role: 'assistant', content: analysis },
                { role: 'user', content: step2Instruction },
              ];
            } else {
              messages = [{ role: 'user', content: buildExamPrompt(text, [questionType], difficulty, targetAnswer) }];
            }
          } else {
            messages = [{ role: 'user', content: buildExamPrompt(text, [questionType], difficulty, targetAnswer) }];
          }

          const response = await client.chat.completions.create({
            model,
            max_completion_tokens: TYPE_TOKENS_MAP[questionType] ?? DEFAULT_TOKENS,
            messages,
          });
          const rawText = response.choices[0]?.message?.content ?? '';
          const parsed = JSON.parse(extractJson(rawText)) as { questions: ExamQuestion[] };
          q = parsed.questions[0];
        } catch (err) {
          console.error(`[${questionType}] API 오류 (attempt ${attempt}):`, err);
          if (attempt < MAX_RETRIES) continue;
          return null;
        }

        if (!q) {
          if (attempt < MAX_RETRIES) continue;
          return null;
        }

        // 선지 수 검증 (모든 유형)
        if (!q.choices || q.choices.length !== 5) {
          console.warn(`[${questionType}] 선지 수 오류 (${q.choices?.length ?? 0}개) — 재시도 ${attempt + 1}`);
          if (attempt < MAX_RETRIES) continue;
          return null;
        }

        // targetAnswer 일치 검증 — sentence_order는 지문 논리가 정답을 결정하므로 제외
        if (targetAnswer !== undefined && q.answer !== targetAnswer) {
          console.warn(`[${questionType}] 정답 불일치: 요청=${targetAnswer} 실제=${q.answer} — 재시도 ${attempt + 1}`);
          if (attempt < MAX_RETRIES) continue;
          return null;
        }

        // flow 검증: ①~⑤ 모두 modified_passage에 존재해야 함
        if (questionType === 'flow') {
          const missing = CIRCLES.filter(c => !q!.modified_passage?.includes(c));
          if (missing.length > 0) {
            console.warn(`[flow] 누락 번호 ${missing.join('')} — 재시도 ${attempt + 1}`);
            if (attempt < MAX_RETRIES) continue;
            return null;
          }
        }

        // phrase_meaning 검증: 선지 길이 55자 이상
        if (questionType === 'phrase_meaning') {
          const shortChoices = q!.choices.filter((c: ExamChoice) => c.text.length < 55);
          if (shortChoices.length > 0) {
            console.warn(`[phrase_meaning] 선지 길이 미달 (${shortChoices.map(c => c.text.length).join(',')}) — 재시도 ${attempt + 1}`);
            if (attempt < MAX_RETRIES) continue;
            return null;
          }
        }

        // summary 검증: question_text에 (A)와 (B) 포함
        if (questionType === 'summary') {
          const qt = q!.question_text ?? '';
          if (!qt.includes('(A)') || !qt.includes('(B)')) {
            console.warn(`[summary] question_text에 (A)(B) 누락 — 재시도 ${attempt + 1}`);
            if (attempt < MAX_RETRIES) continue;
            return null;
          }
        }

        // fill_blank 검증: modified_passage에 빈칸 마커 존재
        if (questionType === 'fill_blank') {
          if (!q!.modified_passage?.includes('___')) {
            console.warn(`[fill_blank] 빈칸 마커 누락 — 재시도 ${attempt + 1}`);
            if (attempt < MAX_RETRIES) continue;
            return null;
          }
        }

        // topic_title, fill_blank, phrase_meaning 검증: 선지가 원형 기호 단독이면 안 됨
        if (['topic_title', 'fill_blank', 'phrase_meaning'].includes(questionType)) {
          const hasSymbolOnly = q!.choices.some((c: ExamChoice) => /^[①②③④⑤]$/.test(c.text.trim()));
          if (hasSymbolOnly) {
            console.warn(`[${questionType}] 선지에 기호 단독 항목 — 재시도 ${attempt + 1}`);
            if (attempt < MAX_RETRIES) continue;
            return null;
          }
        }

        // grammar 검증
        if (questionType === 'grammar') {
          const missing = CIRCLES.filter(c => !q!.modified_passage?.includes(c));
          if (missing.length > 0) {
            console.warn(`[grammar] 누락 번호 ${missing.join('')} — 재시도 ${attempt + 1}`);
            if (attempt < MAX_RETRIES) continue;
            return null;
          }
          // 번호 순서 검증: ①②③④⑤가 지문에 등장하는 순서대로여야 함
          const passage = q!.modified_passage ?? '';
          const circlePositions = CIRCLES.map(c => passage.indexOf(c));
          const isOutOfOrder = circlePositions.some((pos, i) => i > 0 && pos < circlePositions[i - 1]);
          if (isOutOfOrder) {
            console.warn(`[grammar] 번호 순서 오류 (positions: ${circlePositions.join(',')}) — 재시도 ${attempt + 1}`);
            if (attempt < MAX_RETRIES) continue;
            return null;
          }
          const gTexts = q!.choices.map((c: ExamChoice) => c.text.replace(/^[①②③④⑤]\s*/, '').trim().toLowerCase());
          if (new Set(gTexts).size < gTexts.length) {
            console.warn(`[grammar] 선지 중복 — 재시도 ${attempt + 1}`);
            if (attempt < MAX_RETRIES) continue;
            return null;
          }
          // 전치사/관사/접속사 단어 앞에 번호 삽입 금지 검증
          const GRAMMAR_BANNED_WORDS = new Set([
            'of','in','to','for','on','at','by','with','from','about','as','into','through','over',
            'during','between','among','against','without','before','after','since','until','upon',
            'within','across','along','around','beyond','despite','except','like','near','off',
            'outside','past','per','regarding','toward','under','unlike','via',
            'a','an','the',
            'and','but','or','nor','so','yet','although','because','while','when','if','unless',
            'though','whether','wherever','however','whatever','once',
          ]);
          let circleOnBannedWord = false;
          for (const circle of CIRCLES) {
            const idx = passage.indexOf(circle);
            if (idx === -1) continue;
            const afterCircle = passage.slice(idx + circle.length).trimStart();
            const firstWord = afterCircle.replace(/^\[/, '').split(/[\s,.\[\]()/;:!?'"]/)[0].toLowerCase().replace(/[^a-z'-]/g, '');
            if (firstWord && GRAMMAR_BANNED_WORDS.has(firstWord)) {
              console.warn(`[grammar] ${circle}가 금지어(${firstWord}) 앞에 배치됨 — 재시도 ${attempt + 1}`);
              circleOnBannedWord = true;
              break;
            }
          }
          if (circleOnBannedWord) {
            if (attempt < MAX_RETRIES) continue;
            return null;
          }
        }

        // vocab_paraphrase 검증
        if (questionType === 'vocab_paraphrase') {
          const missing = CIRCLES.filter(c => !q!.modified_passage?.includes(c));
          if (missing.length > 0) {
            console.warn(`[vocab_paraphrase] 누락 번호 ${missing.join('')} — 재시도 ${attempt + 1}`);
            if (attempt < MAX_RETRIES) continue;
            return null;
          }
          // 번호 순서 검증
          const vpPassage = q!.modified_passage ?? '';
          const vpPositions = CIRCLES.map(c => vpPassage.indexOf(c));
          const vpOutOfOrder = vpPositions.some((pos, i) => i > 0 && pos < vpPositions[i - 1]);
          if (vpOutOfOrder) {
            console.warn(`[vocab_paraphrase] 번호 순서 오류 (positions: ${vpPositions.join(',')}) — 재시도 ${attempt + 1}`);
            if (attempt < MAX_RETRIES) continue;
            return null;
          }
          const vpTexts = q!.choices.map((c: ExamChoice) => c.text.replace(/^[①②③④⑤]\s*/, '').trim().toLowerCase());
          if (new Set(vpTexts).size < vpTexts.length) {
            console.warn(`[vocab_paraphrase] 선지 중복 — 재시도 ${attempt + 1}`);
            if (attempt < MAX_RETRIES) continue;
            return null;
          }
          // 전치사/관사/접속사 앞에 번호 삽입 금지 검증
          const VP_BANNED_WORDS = new Set([
            'of','in','to','for','on','at','by','with','from','about','as','into','through','over',
            'during','between','among','against','without','before','after','since','until','upon',
            'within','across','along','around','beyond','despite','except','like','near','off',
            'outside','past','per','regarding','toward','under','unlike','via',
            'a','an','the',
            'and','but','or','nor','so','yet','although','because','while','when','if','unless',
            'though','whether','wherever','however','whatever','once',
          ]);
          let vpCircleOnBannedWord = false;
          for (const circle of CIRCLES) {
            const idx = vpPassage.indexOf(circle);
            if (idx === -1) continue;
            const afterCircle = vpPassage.slice(idx + circle.length).trimStart();
            const firstWord = afterCircle.split(/[\s,.\[\]()/;:!?'"]/)[0].toLowerCase().replace(/[^a-z'-]/g, '');
            if (firstWord && VP_BANNED_WORDS.has(firstWord)) {
              console.warn(`[vocab_paraphrase] ${circle}가 금지어(${firstWord}) 앞에 배치됨 — 재시도 ${attempt + 1}`);
              vpCircleOnBannedWord = true;
              break;
            }
          }
          if (vpCircleOnBannedWord) {
            if (attempt < MAX_RETRIES) continue;
            return null;
          }
        }

        // vocab_blank 검증
        if (questionType === 'vocab_blank') {
          const passage = q!.modified_passage ?? '';
          const missingBlanks = ['(a)', '(b)'].filter(b => !passage.toLowerCase().includes(b));
          if (missingBlanks.length > 0) {
            console.warn(`[vocab_blank] 누락 빈칸 ${missingBlanks.join(',')} — 재시도 ${attempt + 1}`);
            if (attempt < MAX_RETRIES) continue;
            return null;
          }
          // (a)(b) 각 1번씩만 등장해야 함
          const passageLower = passage.toLowerCase();
          const countA = (passageLower.match(/\(a\)/g) ?? []).length;
          const countB = (passageLower.match(/\(b\)/g) ?? []).length;
          if (countA !== 1 || countB !== 1) {
            console.warn(`[vocab_blank] (a)=${countA}회, (b)=${countB}회 — 각 1회여야 함 — 재시도 ${attempt + 1}`);
            if (attempt < MAX_RETRIES) continue;
            return null;
          }
        }

        // sentence_order 검증: (A)(B)(C) 모두 modified_passage에 존재해야 함
        if (questionType === 'sentence_order') {
          const passage = q!.modified_passage ?? '';
          const missingParts = ['(A)', '(B)', '(C)'].filter(p => !passage.includes(p));
          if (missingParts.length > 0) {
            console.warn(`[sentence_order] 누락 단락 ${missingParts.join(',')} — 재시도 ${attempt + 1}`);
            if (attempt < MAX_RETRIES) continue;
            return null;
          }
          // 중복 문장 검증: (C)에 (A)(B) 내용이 반복되면 안 됨
          const getSection = (label: string): string => {
            const tag = `(${label})`;
            const start = passage.indexOf(tag);
            if (start === -1) return '';
            const afterTag = start + tag.length;
            const rest = passage.slice(afterTag);
            const nextIdx = rest.search(/\([ABC]\)/);
            return (nextIdx === -1 ? rest : rest.slice(0, nextIdx)).trim().toLowerCase();
          };
          const sA = getSection('A');
          const sB = getSection('B');
          const sC = getSection('C');
          if (sA && sB && sC) {
            const CHUNK = 45;
            let dup = false;
            for (const src of [sA, sB]) {
              for (let i = 0; i <= src.length - CHUNK && !dup; i += 15) {
                if (sC.includes(src.slice(i, i + CHUNK))) dup = true;
              }
            }
            if (dup) {
              console.warn(`[sentence_order] (C)에 (A)(B) 중복 내용 발견 — 재시도 ${attempt + 1}`);
              if (attempt < MAX_RETRIES) continue;
              return null;
            }
          }
        }

        return q;
      }
      console.error(`[${questionType}] 모든 시도 소진 — null 반환 (MAX_RETRIES=${MAX_RETRIES})`);
      return null;
    };

    // 유형 병렬 실행 + 유형 내 count도 병렬 실행 (순차 실행 시 타임아웃 방지)
    const allResults = await Promise.all(
      enabledConfigs.map(async (cfg) => {
        const count = Math.max(1, Math.min(3, cfg.count));
        const results = await Promise.all(
          Array.from({ length: count }, () => generateForType(cfg.type, cfg.difficulty))
        );
        const passed = results.filter((q): q is ExamQuestion => q !== null);
        if (passed.length < count) {
          console.warn(`[${cfg.type}] 요청 ${count}개 중 ${passed.length}개만 생성 성공`);
        }
        return passed;
      })
    );
    const questions = allResults.flat();

    return NextResponse.json({ success: true, questions });
  } catch (error: unknown) {
    console.error('[generate-exam-questions] 오류:', error);
    let message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
    if (message.includes('401') || message.includes('authentication')) {
      message = 'API 키가 올바르지 않습니다.';
    } else if (message.includes('429')) {
      message = 'API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.';
    } else if (message.includes('529') || message.includes('overloaded')) {
      message = 'AI 서버가 일시적으로 혼잡합니다. 잠시 후 다시 시도해주세요.';
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
