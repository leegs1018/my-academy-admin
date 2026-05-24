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
};

const VALID_TYPES = new Set(Object.keys(TYPE_LABELS));

function buildExamPrompt(text: string, questionTypes: string[], difficulty: 'b1' | 'b2' | 'c1' | 'c2' = 'c2', targetAnswer?: number): string {
  const typeRules: Record<string, string> = 
  {
  common_principles: `
[CSAT_HIGH_LEVEL_PRINCIPLES]

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
--- grammar (어법 유형) ---

[생성 목표]
수능·평가원 스타일의 C1~C2 고난도 어법 문제를 생성한다.
문제는 단순 자연스러움 판단이 아니라,
학생이 반드시 문장 구조를 분석해야만 해결 가능해야 한다.

핵심 원칙:
"밑줄 포인트는 단순 단어가 아니라
문법 구조 간 충돌 가능 지점(structural conflict point)이어야 한다."

즉,
학생이 아래 중 최소 하나를 실제로 분석해야만 정오 판단 가능해야 한다:
- clause boundary
- 관계사-선행사 연결
- 병렬 구조
- modifier attachment
- 논리주어
- 준동사 구조
- 명사절 접속사
- 재귀대명사 참조

직관만으로 풀리면 실패한 문제다.

━━━━━━━━━━━━━━━━━━
[modified_passage 생성 규칙]
━━━━━━━━━━━━━━━━━━

- 원본 지문 전체를 그대로 사용할 것.
- 첫 문장부터 마지막 문장까지 절대 생략 금지.
- 요약·축약·재서술 금지.
- modified_passage 안에 반드시 ①②③④⑤ 총 5개의 번호를 삽입할 것.
- 번호는 반드시 실제 존재하는 단어/구 바로 앞에 삽입할 것.

[절대 규칙]
- ①②③④⑤ 모두 modified_passage 안에 존재해야 한다.
- choice의 표현은 modified_passage와 완전히 동일해야 한다.
- 지문에 없는 표현 생성 금지.
- 반드시 1개만 문법적으로 틀려야 한다.
- 나머지 4개는 완전히 문법적으로 맞아야 한다.
- 5개의 선택지는 서로 완전히 다른 구조여야 한다.
- 같은 유형의 포인트를 3개 이상 반복 금지.
- 생성 후 반드시 "실제 오류가 정확히 1개인지" 자기검증할 것.

━━━━━━━━━━━━━━━━━━
[번호 삽입 형식]
━━━━━━━━━━━━━━━━━━

1. 단일 단어
예:
①remains
②whether

2. 다중 단어
예:
③[which was established]
④[not only reading but also analyzing]

규칙:
- 대괄호 안에는 실제 밑줄 대상 전체를 넣을 것.
- 부분만 자르지 말 것.
- choice 역시 동일하게 출력할 것.

━━━━━━━━━━━━━━━━━━
[question_text]
━━━━━━━━━━━━━━━━━━

"고정 문자열"
"다음 글의 밑줄 친 부분 중, 어법상 틀린 것은?"

━━━━━━━━━━━━━━━━━━
[choices 생성 규칙]
━━━━━━━━━━━━━━━━━━

형식:
{"number":1,"text":"① which was established"}

규칙:
- 반드시 번호 + 공백 + 실제 표현
- choice 표현은 modified_passage와 완전히 동일해야 함
- paraphrase 금지
- 축약 금지

━━━━━━━━━━━━━━━━━━
[가장 중요한 생성 규칙]
━━━━━━━━━━━━━━━━━━

절대로:
- 아무 단어나
- 아무 동사나
- 의미만 있는 content word나
- 단순 자연스러운 표현

을 밑줄 포인트로 잡지 말 것.

반드시:
"구조적으로 충돌 가능성이 있는 지점"만 선택할 것.

즉:
학생이 문장 구조를 실제로 파싱(parse)해야만
정오 판단 가능해야 한다.

━━━━━━━━━━━━━━━━━━
[좋은 밑줄 포인트 유형 — 우선순위]
━━━━━━━━━━━━━━━━━━

1. 관계사
- 관계대명사 vs 관계부사
- that / which / who / where / when / why
- 선행사와 관계사 격 충돌
- 삽입구 때문에 선행사가 숨겨진 구조

좋은 예:
the reason ①[why]
the city ②[where he lived]

나쁜 예:
❌ 단순 that
❌ 단순 which

━━━━━━━━━━━━━━━━━━

2. 병렬구조
- and / but / or
- both A and B
- not only A but also B
- either A or B

오류 방식:
- 동명사 ↔ 부정사
- 형용사 ↔ 부사
- 명사 ↔ 절
- parallel category mismatch

좋은 예:
not only reading but also ①[analyze]

━━━━━━━━━━━━━━━━━━

3. 분사
- 현재분사 vs 과거분사
- 감정분사
- 분사구문 논리주어
- 수식 분사

좋은 예:
Students were ①[fascinated]
The theory is ②[interesting]

오류 예:
The theory is ③[interested]

━━━━━━━━━━━━━━━━━━

4. 명사절 접속사
- what / that / whether
- whether vs that 매우 중요

핵심:
- whether = "~인지 아닌지"
- that = "~라는 사실"

좋은 예:
determine ①[whether]
research shows ②[that]

오류 예:
determine ③[that]

━━━━━━━━━━━━━━━━━━

5. 숨겨진 수일치
- 긴 삽입구
- appositive
- 관계절
- 전치사구

반드시:
주어와 동사가 멀리 떨어져 있어야 함.

좋은 예:
Charles Darwin's approach to speciation,
a highly complex problem,
①[exemplifies]

나쁜 예:
❌ The students ①likes

━━━━━━━━━━━━━━━━━━

6. it-가목적어 구조
패턴:
make/find/consider + it + adj + to V

좋은 예:
makes it possible ①[to amplify]

오류 예:
makes it possible ②[amplify]

━━━━━━━━━━━━━━━━━━

7. 전치사 to + 동명사
매우 좋은 distractor 유형.

패턴:
lead to
contribute to
be devoted to
be committed to

+ Ving

좋은 예:
lead to ①[reducing]

주의:
이건 "올바른 표현"으로 distractor에 활용할 것.

━━━━━━━━━━━━━━━━━━

8. 재귀대명사
- themselves / itself / himself

좋은 예:
plants defend ①[themselves]

오류 예:
plants defend ②[them]

━━━━━━━━━━━━━━━━━━

9. 사역·허용동사
allow / enable / force / permit / require + O + to V

좋은 예:
enabled students ①[to learn]

오류 예:
enabled students ②[learning]

━━━━━━━━━━━━━━━━━━
[밑줄 포인트 다양성 규칙]
━━━━━━━━━━━━━━━━━━

5개 포인트는 서로 다른 구조에서 선정할 것.

권장 조합:
(A) 관계사
(B) 병렬
(C) 분사
(D) 명사절 접속사
(E) 숨겨진 수일치
(F) 재귀대명사
(G) it-가목적어
(H) to + Ving 구조
(I) 사역동사 구조

동일 카테고리 3개 이상 금지.

━━━━━━━━━━━━━━━━━━
[절대 금지 포인트]
━━━━━━━━━━━━━━━━━━

다음은 밑줄 금지:

❌ 단독 전치사
(in/on/of/at/by/with 등)

❌ 단독 관사
(a/an/the)

❌ 단독 접속사
(and/but/or)

❌ 단순 content word
(adults / acres / individuals 등)

❌ 단순 일반동사
(shows / suggests / indicates)

❌ 구조 분석 필요 없는 단순 수동태
(is known / was built)

❌ 단순 수일치
(The students likes)

❌ 단순 시제 오류
(went → goes)

❌ 전치사 누락 문제
(X% of Y 에서 of 누락 등)

━━━━━━━━━━━━━━━━━━
[핵심 생성 규칙 — 매우 중요]
━━━━━━━━━━━━━━━━━━

좋은 문제:
학생이
- 진짜 주어 찾기
- clause boundary 찾기
- modifier attachment 분석
- 병렬 범위 분석
- 관계사 선행사 찾기

를 해야만 풀 수 있음.

나쁜 문제:
- 단어 뜻만 보고 풀림
- 직관으로 풀림
- 자연스러움만으로 풀림
- 단순 proofreading

━━━━━━━━━━━━━━━━━━
[Distractor 설계 규칙]
━━━━━━━━━━━━━━━━━━

나머지 4개는 실제로 완전히 맞아야 한다.
하지만 "의심스럽게" 보여야 한다.

좋은 distractor:
- lead to + Ving
- appositive 뒤 숨겨진 수일치
- 관계절 nested structure
- participial adjective
- interrupted agreement
- complex clause

학생이:
"이거 틀린 거 같은데?"
라고 느껴야 하지만 실제로는 맞아야 한다.

━━━━━━━━━━━━━━━━━━
[오류 생성 규칙]
━━━━━━━━━━━━━━━━━━

- 오류는 반드시 실제 문법 규칙 위반이어야 한다.
- 단순 awkwardness 금지.
- 의미 붕괴 금지.
- 표면상 자연스럽게 보여야 한다.
- 상위권 학생도 1차 독해에서 지나칠 수 있어야 한다.

━━━━━━━━━━━━━━━━━━
[실패 패턴 — 절대 금지]
━━━━━━━━━━━━━━━━━━

다음 유형의 문제는 실패로 간주:

❌ 밑줄 포인트가 그냥 단어
❌ 문법 구조 분석이 필요 없음
❌ 직관으로 바로 정답 보임
❌ 단순 시제
❌ 단순 수일치
❌ 단순 전치사
❌ 의미 이상함만 이용
❌ 지문 아무곳이나 밑줄

━━━━━━━━━━━━━━━━━━
[금지 규칙 — Surface Grammar Error Ban]
━━━━━━━━━━━━━━━━━━

Do NOT create errors that can be identified through local phrase checking alone.

The incorrect option must NOT be solvable by checking only:
- preposition + verb form
- simple infinitive omission
- article usage
- isolated tense mismatch
- isolated singular/plural mismatch

The student must analyze:
- clause structure,
- logical subject,
- modifier attachment,
- parallel category,
- or antecedent relationship

before determining the error.

The incorrect option should remain locally plausible.

A student reading only the underlined phrase should NOT be able to determine the answer immediately.

The grammatical violation must emerge only after analyzing the larger sentence structure.

━━━━━━━━━━━━━━━━━━
[정답 자기검증 — 반드시 수행]
━━━━━━━━━━━━━━━━━━

STEP 1.
정답 위치에 대해:
"어떤 문법 규칙이 위반되었는가?"
를 명확히 설명 가능해야 함.

설명 못 하면 오류 아님.

STEP 2.
다음은 오류로 오판 금지:
- It was shown that
- lead to + Ving
- interesting/interested
- hidden agreement
- enable + O + to V

STEP 3.
나머지 4개도:
"왜 맞는지"
설명 가능해야 함.

━━━━━━━━━━━━━━━━━━
[품질 검수 — 생성 후 반드시 확인]
━━━━━━━━━━━━━━━━━━

1. ①②③④⑤ 모두 존재하는가?
2. choice와 modified_passage가 완전히 동일한가?
3. 실제 오류가 정확히 1개인가?
4. 나머지 4개는 완전히 맞는가?
5. 구조 분석이 필요한가?
6. clause boundary 분석이 필요한가?
7. 관계·수식 범위 분석이 필요한가?
8. 직관만으로 안 풀리는가?
9. isolated vocabulary를 밑줄치지 않았는가?
10. 평가원 스타일 구조 함정이 존재하는가?

━━━━━━━━━━━━━━━━━━
[실제 오류 생성 강제 규칙 — 매우 중요]
━━━━━━━━━━━━━━━━━━

정답 번호로 선택된 부분은 반드시
"원문 표현에서 실제로 문법 형태가 변경되어야 한다."

즉:
- 원문을 그대로 유지한 채 번호만 붙이는 것을 절대 금지한다.
- 반드시 원문의 형태를 문법적으로 틀린 형태로 변형해야 한다.

허용 예시:
- whether → that
- to reduce → reducing
- themselves → them
- which was → which were
- interested → interesting

금지 예시:
- 원문 표현 그대로 사용
- 수정 없이 번호만 삽입
- "틀려 보인다"는 이유만으로 정답 지정

생성 후 반드시 아래를 검증할 것:

STEP 1.
원문(original passage)과 modified_passage의 정답 위치를 비교하라.

STEP 2.
정답 번호 위치에서
실제로 문법 형태 변화가 발생했는지 확인하라.

STEP 3.
형태 변화가 없다면:
→ 오류 생성 실패로 간주하고
새로운 오류를 다시 생성할 것.

STEP 4.
정답 위치의 수정 전/수정 후를 내부적으로 비교할 것.

예시:
원문: "determine whether the strategy is effective"
수정: "determine that the strategy is effective"
→ 실제 문법 형태 변화 존재 → 정상적인 오류 생성

반면:
원문: "it was shown that"
수정: "it was shown that"
→ 형태 변화 없음 → 오류 생성 실패 → 재생성 필요

━━━━━━━━━━━━━━━━━━
[정답 존재 검증 — 필수]
━━━━━━━━━━━━━━━━━━

출력 전 반드시 확인:

- 정답 번호를 수정 이전 원문과 비교했을 때
  실제 문법 위반이 발생했는가?

- "원문과 동일한 표현"이면 절대 정답으로 지정 금지.

- 반드시: 원문 ≠ modified_passage의 정답 위치 표현 이어야 한다.

만약 원문 == modified_passage의 정답 위치 표현 이면
→ 오류 생성 실패 → 다시 생성할 것.

━━━━━━━━━━━━━━━━━━
[출력 필드]
━━━━━━━━━━━━━━━━━━

- modified_passage
- question_text
- choices
- answer
- explanation

explanation에는:
- 왜 틀렸는지
- 어떤 문법 규칙 위반인지
- 올바른 형태는 무엇인지
- 원문 표현과 modified_passage의 정답 위치 표현 비교

를 반드시 한글로 상세 설명할 것.
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

- question_text 형식 (반드시 정확히 준수):
첫 번째 줄: "다음 글의 내용을 한 문장으로 요약하고자 한다. 빈칸 (A), (B)에 들어갈 말로 가장 적절한 것은?"
빈 줄 (\\n\\n 필수)
두 번째 부분: 완전한 영어 요약문. (A)와 (B)를 "_________"로 표시.

- 요약문 길이 기준:
  · 반드시 30단어 이상의 충분한 길이로 작성할 것.
  · 글의 핵심 논리 구조(전제 → 결론, 대조, 인과 등)를 문장 안에 담을 것.
  · 단순 주어+동사+목적어 구조가 아니라, 종속절·분사구문·관계절 등을 포함한 복문 형태 권장.
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

- question_text: "다음 글에서 전체 흐름과 관계 없는 문장은?" (이 문자열 고정, 변경 금지)

- modified_passage 형식 (반드시 준수):
  · 구조: [번호 없는 intro 2~3문장] + [①문장] + [②문장] + [③문장] + [④문장] + [⑤문장]
  · 전체를 하나의 연속된 단락으로 작성 — ①~⑤ 앞에 줄바꿈(\n) 절대 금지
  · ①~⑤ 는 각 문장 바로 앞에 공백 하나만 두고 붙임: "...intro. ①Sentence here. ②Sentence here."
  · intro는 원본 지문의 첫 2~3문장을 번호 없이 그대로 배치 (1문장 intro 금지)
  · ①~⑤ 5개 문장 중 1개가 흐름과 관계 없는 삽입 문장
  · 삽입 위치는 ①~⑤ 중 하나 (①과 ⑤에만 고정하지 말고 다양하게 배치)

[문장 길이 규칙 — 반드시 준수]
  · modified_passage 전체 길이는 반드시 1000자(character) 이상 — 1000자 미만 절대 금지
  · intro 각 문장: 반드시 25단어(word) 이상
  · ①~⑤ 각 문장: 반드시 30단어(word) 이상
  · 각 문장은 반드시 종속절(although, while, whereas, even though, given that 등), 관계절(which, that, whose 등), 분사구문(having+p.p., being+p.p. 등) 중 최소 1개 포함
  · 짧은 단문(단순 주어+동사+목적어) 절대 금지
  · 아래 예시 수준의 문장 길이를 반드시 달성할 것:
    예) "Although it is widely assumed that artistic skill depends primarily on technical mastery of perspective and composition, many critics have argued that the emotional resonance of a work — the ineffable quality that draws viewers into a sustained encounter with the image — ultimately determines its lasting significance in the history of art."

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
  · 각 선택지 text는 반드시 55자(character) 이상이어야 한다 — 55자 미만 선택지 절대 금지
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
  "modified_passage": "수정된 지문 (grammar/vocab_blank/fill_blank/vocab_paraphrase 유형만, 해당 없는 유형은 키 자체 생략)",
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
- 그 외 모든 유형(topic_title, fill_blank, phrase_meaning, summary, vocab_blank): choices text 필드에 반드시 완전한 영어 명사구/절/문장을 작성할 것. ①②③④⑤ 기호만 있는 선지 절대 금지.

반드시 요청된 유형 순서대로 questions 배열에 포함하라. 요청되지 않은 유형은 생성하지 마라.${targetAnswer != null ? `

[정답 위치 지정 — 절대 준수]
이번 문제의 정답(answer) 번호는 반드시 ${targetAnswer}번이어야 한다. 다른 번호는 정답이 될 수 없다.` : ''}`;
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
      grammar: 'gpt-5.1',
    };
    const DEFAULT_MODEL = 'gpt-5.1';

    // 유형별 개별 생성 + 검증 (난이도 파라미터 추가)
    const generateForType = async (questionType: string, difficulty: 'b1' | 'b2' | 'c1' | 'c2'): Promise<ExamQuestion | null> => {
      const MAX_RETRIES = 1;
      const targetAnswer = Math.floor(Math.random() * 5) + 1;
      const model = TYPE_MODEL_MAP[questionType] ?? DEFAULT_MODEL;
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        let q: ExamQuestion | undefined;
        try {
          const response = await client.chat.completions.create({
            model,
            max_completion_tokens: 2500,
            messages: [{ role: 'user', content: buildExamPrompt(text, [questionType], difficulty, targetAnswer) }],
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

        // targetAnswer 일치 검증 (모든 유형) — 마지막 시도는 그냥 허용
        if (q.answer !== targetAnswer && attempt < MAX_RETRIES) {
          console.warn(`[${questionType}] 정답 불일치: 요청=${targetAnswer} 실제=${q.answer} — 재시도 ${attempt + 1}`);
          continue;
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
          const gTexts = q!.choices.map((c: ExamChoice) => c.text.replace(/^[①②③④⑤]\s*/, '').trim().toLowerCase());
          if (new Set(gTexts).size < gTexts.length) {
            console.warn(`[grammar] 선지 중복 — 재시도 ${attempt + 1}`);
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
          const vpTexts = q!.choices.map((c: ExamChoice) => c.text.replace(/^[①②③④⑤]\s*/, '').trim().toLowerCase());
          if (new Set(vpTexts).size < vpTexts.length) {
            console.warn(`[vocab_paraphrase] 선지 중복 — 재시도 ${attempt + 1}`);
            if (attempt < MAX_RETRIES) continue;
            return null;
          }
          const passage = q!.modified_passage ?? '';
          const parts = passage.split(/(①|②|③|④|⑤)/g);
          let positionMismatch = false;
          for (let pi = 0; pi < parts.length; pi++) {
            if (!CIRCLES.includes(parts[pi])) continue;
            const circleIdx = CIRCLES.indexOf(parts[pi]);
            const afterCircle = (parts[pi + 1] ?? '').trimStart();
            const firstWord = afterCircle.match(/^(\S+)/)?.[1]?.toLowerCase().replace(/[^a-z]/g, '') ?? '';
            const choiceWord = vpTexts[circleIdx] ?? '';
            if (firstWord && choiceWord && firstWord !== choiceWord) {
              console.warn(`[vocab_paraphrase] 번호 위치 불일치 ${CIRCLES[circleIdx]}: 지문="${firstWord}" 선지="${choiceWord}" — 재시도 ${attempt + 1}`);
              positionMismatch = true;
              break;
            }
          }
          if (positionMismatch) {
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
        }

        return q;
      }
      return null;
    };

    // 유형 병렬 실행 + 유형 내 count도 병렬 실행 (순차 실행 시 타임아웃 방지)
    const allResults = await Promise.all(
      enabledConfigs.map(async (cfg) => {
        const count = Math.max(1, Math.min(3, cfg.count));
        const results = await Promise.all(
          Array.from({ length: count }, () => generateForType(cfg.type, cfg.difficulty))
        );
        return results.filter((q): q is ExamQuestion => q !== null);
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
