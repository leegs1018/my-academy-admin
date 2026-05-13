import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getFeaturePrice, getConBalance } from '@/lib/credits';
import { createAdminClient } from '@/lib/supabase-admin';

export const maxDuration = 120;

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

function buildExamPrompt(text: string, questionTypes: string[], difficulty: 'b1' | 'b2' | 'c1' | 'c2' = 'c2'): string {
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
수능 및 평가원 스타일의 고난도 어법 문제를 생성한다.
문제는 단순 어색함 판단이 아니라, 학생이 문장 구조를 실제로 분석해야만 해결 가능해야 한다.
정답은 반드시 문법 규칙 위반이어야 하며, 직관이나 자연스러움만으로 풀 수 없어야 한다.

━━━━━━━━━━━━━━━━━━
[modified_passage 생성 규칙]
━━━━━━━━━━━━━━━━━━

- 원본 지문 전체를 그대로 사용한다.
- 원본 지문의 첫 문장부터 마지막 문장까지 모두 포함해야 한다.
- 지문 일부를 생략하거나 축약하지 말 것.
- modified_passage 안에 반드시 ①②③④⑤ 총 5개의 번호를 삽입할 것.
- 번호는 반드시 실제 존재하는 단어/구 바로 앞에 삽입해야 한다.

[절대 규칙]
- ①②③④⑤ 모두 modified_passage 안에 존재해야 한다. 하나라도 빠지면 안 된다.
- 각 번호는 서로 다른 문법 포인트여야 한다. 같은 구조 유형 반복 금지.
- choice의 단어/구는 modified_passage와 완전히 동일해야 한다.
- 지문에 없는 표현을 choice로 생성 금지.
- 반드시 1개만 문법적으로 틀려야 하며, 나머지 4개는 완전히 맞아야 한다.
- 5개의 선지 단어/구는 서로 완전히 달라야 한다. 동일한 단어/구 중복 절대 금지.
- 생성 후 ①②③④⑤가 모두 modified_passage에 있는지 반드시 확인할 것.

━━━━━━━━━━━━━━━━━━
[번호 삽입 형식]
━━━━━━━━━━━━━━━━━━

1. 단일 단어: 번호를 단어 바로 앞에 삽입.
   예) ①remains important

2. 다중 단어: 번호 뒤에 [ ] 로 전체 구를 감싼다.
   예) ②[not only reading] / ③[which was established]
   - 대괄호 안에는 실제 밑줄 대상 전체를 포함해야 한다. 부분만 자르지 말 것.

━━━━━━━━━━━━━━━━━━
[question_text]
━━━━━━━━━━━━━━━━━━

"다음 글의 밑줄 친 부분 중, 어법상 틀린 것은?" (고정 문자열, 변경 금지)

━━━━━━━━━━━━━━━━━━
[choices 생성 규칙]
━━━━━━━━━━━━━━━━━━

형식: "① 단어/구" — 원형 번호(①②③④⑤) + 공백 + 단어/구
예시: {"number":1,"text":"① which was established"}
- choice는 modified_passage 속 번호 뒤 표현과 완전히 동일해야 한다.
- 축약 금지, paraphrase 금지.

━━━━━━━━━━━━━━━━━━
[핵심 원칙]
━━━━━━━━━━━━━━━━━━

"밑줄 포인트는 문법 형태(grammar form)가 아니라 구조 충돌 가능 지점(structural conflict point)이어야 한다."

학생은 반드시 아래 중 하나를 분석해야만 정오 판단 가능해야 한다:
- clause boundary
- 병렬 구조
- modifier attachment
- 논리주어 (분사구문)
- 관계사-선행사 관계
- 준동사 구조

직관적 자연스러움만으로는 정답을 고를 수 없어야 한다.

━━━━━━━━━━━━━━━━━━
[좋은 밑줄 포인트 — 반드시 이 유형 중심으로 출제]
━━━━━━━━━━━━━━━━━━

1. 관계사
   - 관계대명사 vs 관계부사 혼동 (that/which vs where/when/why)
   - 선행사의 격에 맞지 않는 관계사 사용
   - 수식어구·삽입절에 가려진 선행사-관계사 불일치로 난이도 높일 것
   - 예) the reason [where→why] / the city [which→where] he lived

2. 병렬구조
   - and / but / or / not only~but also / both~and / either~or
   - 오류 방식: 동명사↔부정사, 명사↔절, 형용사↔부사, parallel category mismatch
   - 예) not only working hard but also achieve success

3. 분사
   - 현재분사 vs 과거분사 (능동·수동 의미 혼동)
   - 분사구문의 논리주어 불일치
   - 감정분사 핵심 규칙:
     · 대상이 감정을 "유발(원인)"하면 → V-ing (현재분사)
     · 대상이 감정을 "경험(결과)"하면 → p.p. (과거분사)
     · 예) "The theory is ③[interesting]" → 이론이 흥미를 유발 → interesting 올바름 (distractor)
     · 예) "Students were ④[fascinated]" → 학생이 매혹을 경험 → fascinated 올바름 (distractor)
     · 오류 예) "The phenomenon is ①[confusing]" → "confused"로 교체하면 오류
   - 수식 분사: "the ③[developed] countries" vs "the ④[developing] countries" 혼동 출제 가능
   - 예) [Knowing→Known] for its beauty, the city…

4. 명사절 접속사
   - what / that / whether 혼동
   - show / believe / recognize / know 뒤 what vs that 오류
   - whether vs that 구분 (기출 빈도 매우 높음):
     · whether: "~인지 아닌지" 불확실한 명사절 (determine/learn/ask/wonder/question + whether)
     · that: "~라는 것" 확실한 사실 명사절 (show/prove/suggest/believe/find + that)
     · 오류 방식: whether → that (불확실 명제를 확실로 왜곡) 또는 반대
     · 예) "to determine ①[whether] the strategy is effective" → whether 올바름
     · 예) "research shows ②[that] sleep affects memory" → that 올바름 (distractor)

5. 수식 관계
   - which 수식 범위 / dangling modifier
   - 삽입구로 인한 수식 대상 혼동

6. 숨겨진 수일치
   - 긴 삽입구(전치사구·관계절·appositive)로 실제 주어를 숨길 것
   - 예) "Charles Darwin's approach to speciation, a highly complex and challenging problem, ①[exemplifies]" → 주어 "approach"와 동사 사이에 긴 동격구 삽입
   - 단: 단순 단수/복수 오류 절대 금지

7. it-가목적어 구조
   - S + make/find/consider/think + it + [형용사] + to V 패턴
   - 오류 방식: to V → bare infinitive (to 누락)
   - 예) "makes it possible ④amplify" → "makes it possible to amplify"가 올바름 (to 누락이 오류)
   - 학생이 "make it possible to V" 전체 구조를 정확히 알아야만 판단 가능
   - 비슷한 구조: "find it difficult to V", "consider it necessary to V"

8. 전치사 to + 동명사 구조 (Distractor 최적)
   - lead to / contribute to / be devoted to / be committed to / amount to + Ving
   - 주의: 이 구조에서 Ving는 올바름 → distractor로 활용 (학생이 "lead to + V"로 오해 유발)
   - 예) "lead to drastically ③reducing the work" → reducing이 올바름 (오류가 아님)
   - distractor로 배치하면 학생이 "lead to reduce vs lead to reducing" 혼동 → 고난도 함정 완성

9. 과거분사 형용사 vs 현재분사 형용사 (Distractor 최적)
   - 명사 앞/뒤에서 형용사로 쓰이는 분사 선택 문제
   - 예) "causing ⑤increased productivity" → increased(과거분사)가 productivity를 수식 → 올바름
   - distractor로 배치: 학생이 "increased vs increasing" 혼동 유발
   - 오류 생성 시: 수동 의미가 필요한 곳에 현재분사 배치

10. 재귀대명사 (Reflexive Pronoun) — 기출 빈도 매우 높음
   - 주어와 목적어가 동일 대상일 때 재귀대명사 필수 (themselves/itself/himself/herself/ourselves)
   - 오류 방식: themselves→them / itself→it / herself→her 로 교체
   - 예) "plants use lectins to defend ①themselves" → themselves 올바름 (plants=목적어)
   - 예) "individuals ②[express themselves] through art" → themselves 필수
   - distractor 활용: 올바른 재귀대명사에 밑줄 → 학생이 "them이 맞지 않나?" 혼동
   - 오류 출제 시: 주어와 목적어가 동일한데 themselves→them 교체
   - 주의: "they protect them" (다른 대상 보호) vs "they protect themselves" (자신 보호) 의미 차이 활용

11. 사역·허용 동사 + 목적어 + to V (Causative/Permissive) — 기출 빈도 높음
   - allow / enable / permit / force / cause / require / encourage + 목적어 + to V
   - help + 목적어 + (to) V (to 생략 가능하므로 distractor로만 활용)
   - 오류 방식: to V → Ving 또는 bare infinitive로 교체
   - 예) "enabling them ③[to hold] on to their prey" → to hold 올바름 (distractor)
   - 예) "allowing organisms ④[to survive] in extreme conditions" → to survive 올바름
   - 예) "forces the brain ①[to process]" → to process 올바름 (distractor)
   - 오류 출제 시: "enables students ②[learning]" → learning이 오류, to learn이 올바름

━━━━━━━━━━━━━━━━━━
[5개 밑줄 포인트 다양성 원칙]
━━━━━━━━━━━━━━━━━━

5개의 밑줄 포인트는 반드시 서로 다른 문법 카테고리에서 선정할 것:
  (A) 준동사 구조 — to V / Ving / bare V 선택 (it-가목적어, lead to, 사역허용동사 등)
  (B) 수식·일치 관계 — 주어-동사 수일치 (appositive·관계절로 주어 숨김)
  (C) 관계사·접속사 — 관계대명사/관계부사, what/that/whether 구분
  (D) 분사 구조 — 감정분사(V-ing vs p.p.), 분사구문 논리주어, 수식 분사
  (E) 병렬·수식 — 병렬구조 일관성, 부사·형용사 수식 관계
  (F) 대명사 구조 — 재귀대명사 vs 인칭대명사 (themselves/itself/himself)

같은 카테고리의 포인트를 3개 이상 사용하는 것을 금지한다.
가능하면 (A)~(F) 중 5개를 각각 하나씩 선정하는 것이 이상적이다.

━━━━━━━━━━━━━━━━━━
[실전 예시 — 이 수준을 목표로 출제]
━━━━━━━━━━━━━━━━━━

아래는 실제 수능 스타일 어법 문제 구조 예시다. 이 수준과 유형 다양성을 반드시 달성할 것:

지문 구조 예시:
"Creativity can have an effect on productivity. Charles Darwin's approach to speciation,
a highly complex and challenging problem, ①exemplifies how the choice of a difficult
research question can result in prolonged data collection and deliberation, rather than
allowing for quick or simple experimentation. Such a choice of problem does not permit
quick or simple experimentation; in these cases, creativity may actually undermine
productivity, as measured by publication output, since effort is directed toward
②inherently difficult problems. For others, whose creativity is more focused on methods
and technique, creativity may lead to drastically ③reducing the work necessary to solve
a problem. We can see an example in the development of the polymerase chain reaction
(PCR), which makes it possible ④amplify small pieces of DNA in a short time. This type
of creativity might reduce the number of steps or substitute steps that are less likely
to fail, thus causing ⑤increased productivity."

분석:
  ① exemplifies — appositive로 숨겨진 수일치 (distractor: 올바름)
  ② inherently — 부사가 형용사 수식 (distractor: 올바름)
  ③ reducing — "lead to + Ving" 전치사 패턴 (distractor: 올바름)
  ④ amplify → 오류: "make it possible to V"에서 to 누락 (정답)
  ⑤ increased — 과거분사 형용사로 명사 수식 (distractor: 올바름)

핵심: 정답은 구조를 알아야 발견 가능, 나머지 4개는 모두 틀려 보이지만 실제로는 맞음

[기출 5개 포인트 조합 패턴 — 이 다양성을 반드시 구현]

조합 예시 1 (재귀대명사 + 수일치 + whether + 분사 + 사역동사):
  ① themselves — 재귀대명사 (distractor: 올바름)
  ② whether — 불확실 명사절 접속사 (distractor: 올바름)
  ③ [which have been] — 관계절 수일치 (distractor: 올바름)
  ④ [to survive] → 오류: "enabling them surviving"에서 to V 필수 (정답)
  ⑤ fascinating — 감정분사 현재분사 (distractor: 올바름)

조합 예시 2 (병렬 + 재귀대명사 + that + 분사구문 + 수일치):
  ① [not only reading but also comprehending] — 병렬구조 (distractor: 올바름)
  ② [themselves] — 재귀대명사 (distractor: 올바름)
  ③ [that] → 오류: determine 뒤에 that이 오면 오류, whether가 올바름 (정답)
  ④ [Having considered] — 분사구문 (distractor: 올바름)
  ⑤ [remains] — appositive 사이 수일치 (distractor: 올바름)

→ 이처럼 5개가 모두 다른 카테고리를 대표해야 한다.

━━━━━━━━━━━━━━━━━━
[C1~C2 난이도 규칙]
━━━━━━━━━━━━━━━━━━

고난도(C1~C2)에서는 반드시 아래 중 하나를 실제 정답 오류로 사용할 것:
  - 관계사 (where/when/why↔which/that 혼동)
  - 병렬구조 (동명사↔부정사, 형용사↔부사 mismatch)
  - 분사 (감정분사 또는 논리주어 불일치)
  - it-가목적어 구조의 to 누락
  - 재귀대명사 → 인칭대명사 교체 (themselves→them)
  - 사역동사 + O + to V → Ving 교체
  - whether → that 교체 (불확실 명사절 왜곡)

다음 단독 오류 유형은 C1 이상에서 금지: 단순 수일치 / 단순 시제 / 단순 수동태

━━━━━━━━━━━━━━━━━━
[절대 금지 포인트]
━━━━━━━━━━━━━━━━━━

다음은 밑줄 포인트로 절대 사용 금지:
- 단독 전치사 (in / on / at / of / during / over / up / off / between 등)
- 단독 관사 (a / an / the)
- 단독 접속사 (and / but / or — 병렬 오류 없이 단순 연결만 하는 경우)
- 단독 명사 / 단독 형용사 / 의미만 있는 content word
- 단위 명사, 고유 명사 (숫자 단위, 사람·동식물 이름 등)
- 단순 일반동사 (shows / suggests / indicates 등 — 구조 분석 불필요한 경우)
- 문맥상 명백한 수동태 (구조 분석 없이 자명한 경우)
- 구조 분석 없이 직관으로 판단 가능한 부분

[전치사 누락·삽입을 오류로 사용하는 것 절대 금지]
- "X% of Y"에서 of 누락 → 금지 (전치사 오류)
- "a number of" / "a variety of" 등 관용 전치사구 누락 → 금지
- "at the age of" / "in spite of" 같은 구 전치사 누락 → 금지
- 어떤 형태로든 "전치사 하나가 있어야 한다/없어야 한다"가 핵심인 오류 → 전부 금지
- 이 유형의 오류는 설명이 "~때문에 of/in/at 이 필요합니다"로 끝나는 모든 경우를 포함한다.

금지 예시:
❌ acres  ❌ refuge  ❌ adults  ❌ in  ❌ and  ❌ shows  ❌ suggests  ❌ was known
❌ "89.4% right handers" → "89.4% of right handers" (of 누락 오류) — 전치사 관련 오류이므로 절대 금지

좋은 포인트 예시:
✅ [not only A but also B]  ✅ [which was established]  ✅ [what researchers observed]
✅ [movements of children in the womb are]  ✅ Using this technique, ...

━━━━━━━━━━━━━━━━━━
[오류 생성 규칙]
━━━━━━━━━━━━━━━━━━

- 오류는 반드시 "선정된 구조 포인트 내부에서만" 생성할 것. 새로운 문법 요소를 임의 추가하지 말 것.
- 빠르게 읽으면 자연스러워 보여야 하지만, 실제로는 명확한 문법 위반이어야 한다.
- 의미 자체가 붕괴되면 안 된다.
- 오답 포인트는 상위권 학생도 1차 독해에서 지나치기 쉬운 구조에 배치할 것.

━━━━━━━━━━━━━━━━━━
[Distractor 설계 규칙]
━━━━━━━━━━━━━━━━━━

나머지 4개 정답 선택지는 실제로 완전히 맞아야 하지만, 충분히 의심스럽게 보여야 한다.

각 distractor는 아래 중 하나의 방식으로 "틀려 보이게" 설계할 것:
  · appositive / 관계절로 숨겨진 수일치 → 학생이 가짜 주어에 혼동
  · "lead to / contribute to + Ving" → 학생이 "to + V"(부정사)로 오해
  · 과거분사 형용사(increased/reduced/established) → 현재분사와 혼동 유발
  · 관계사(which/that/who/where) → 선행사와 격 혼동 유발
  · it-가목적어 구조에서 to V → 다른 맥락에서 정상으로 보이게 배치

좋은 distractor 유형: participial adjective / complex relative clause / lead to + Ving / interrupted agreement / nested clause / it+adj+to V

━━━━━━━━━━━━━━━━━━
[정답 자기검증 — 생성 전 반드시 수행]
━━━━━━━━━━━━━━━━━━

정답으로 선정한 번호에 대해 아래를 단계별로 확인할 것:

STEP 1. 해당 구조가 실제 문법 오류인가?
- "어색하게 느껴진다"는 이유만으로 오류 선정 금지.
- 반드시 구체적인 문법 규칙 이름을 댈 수 있어야 한다.
  예) "5형식 동사 + O + to V 구조에서 to 누락" / "병렬구조 불일치" / "재귀대명사 필수 환경"
- 규칙 이름을 댈 수 없으면 그 위치는 오류가 아니다 — 다른 위치를 선택할 것.

STEP 2. 흔한 잘못 레이블링 패턴 체크 (다음 중 하나라도 해당되면 정답 재선정):
- "It was thought/believed/shown/found/known that + 절" → 완전히 맞는 구조, 오류 아님
- "lead to / contribute to + Ving" → Ving가 올바름, 오류 아님
- 감정분사(interesting/interested, fascinating/fascinated)를 임의로 오류로 지정 → 반드시 능동·수동 의미를 검토 후 결정
- 단순히 긴 삽입구 뒤에 있어서 "어색해 보이는" 수일치 → 실제 주어를 확인 후 결정
- "사역·허용동사 + O + to V" 에서 to V가 올바른데 Ving로 바꾸지 않은 경우 → 오류 아님

STEP 3. 나머지 4개 distractor가 실제로 모두 맞는가?
- 각각에 대해 "왜 맞는지" 설명할 수 있어야 한다.
- 설명이 불가능하면 distractor 설계를 수정할 것.

━━━━━━━━━━━━━━━━━━
[품질 검수 — 생성 후 반드시 확인]
━━━━━━━━━━━━━━━━━━

1. ①②③④⑤ 모두 modified_passage 안에 존재하는가?
2. choice와 지문 표현이 완전히 동일한가?
3. 실제 오류는 정확히 1개인가?
4. 나머지 4개는 완전히 문법적으로 맞는가?
5. 밑줄 포인트가 isolated vocabulary가 아닌 grammatical relation인가?
6. 학생이 구조 분석 없이 직관만으로 풀 수 없는가?
7. clause boundary 분석이 필요한가?
8. 오류가 문법 규칙 위반인가, 단순 어색함이 아닌가?
9. 단독 전치사·명사·형용사를 밑줄치지 않았는가?
10. 평가원 스타일의 구조 기반 함정이 존재하는가?

- answer: 틀린 번호 1개
- explanation: 왜 틀렸는지 + 올바른 형태를 한글로 상세 설명
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
- 오류 위치는 ②③ 중앙 위치를 우선으로 배치할 것 — ①과 ⑤ 위치는 가장 눈에 띄므로 가능하면 피할 것
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
  · 지문 속 핵심 추상/비유/함축/일반화 표현을 [대괄호]로 감싸 밑줄 대상 표시
  · 예시: "...In fact, [every man has a horizon of his own], and he will expect..."
  · 표현 길이: 단어 2개 이상 ~ 절 수준 가능, 지문 원문 그대로 사용
  · 대괄호는 하나만 사용할 것 (여러 곳 금지)

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

반드시 요청된 유형 순서대로 questions 배열에 포함하라. 요청되지 않은 유형은 생성하지 마라.`;
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
    const { text, questionTypes, difficulty = 'c2', academy_id } = await request.json() as { text: string; questionTypes: string[]; difficulty?: 'b1' | 'b2' | 'c1' | 'c2'; academy_id?: string };

    if (!text || text.trim().length < 50) {
      return NextResponse.json({ error: '지문 텍스트가 너무 짧습니다.' }, { status: 400 });
    }
    if (!Array.isArray(questionTypes) || questionTypes.length === 0) {
      return NextResponse.json({ error: '문제 유형을 최소 1개 선택해주세요.' }, { status: 400 });
    }
    const invalid = questionTypes.filter(t => !VALID_TYPES.has(t));
    if (invalid.length > 0) {
      return NextResponse.json({ error: `유효하지 않은 문제 유형: ${invalid.join(', ')}` }, { status: 400 });
    }

    // CON 잔액 확인 및 차감
    if (academy_id) {
      const price = await getFeaturePrice('ai_question');
      if (price > 0) {
        const balance = await getConBalance(academy_id);
        if (balance < price) {
          return NextResponse.json({
            error: 'INSUFFICIENT_CON',
            required: price,
            balance,
          }, { status: 402 });
        }
        const supabaseAdmin = createAdminClient();
        const { error: deductError } = await supabaseAdmin.rpc('deduct_con', {
          p_academy_id: academy_id,
          p_amount: price,
          p_feature_key: 'ai_question',
          p_description: `AI 문제 생성 (${questionTypes.length}유형)`,
        });
        if (deductError) {
          if (deductError.message?.includes('INSUFFICIENT_CON')) {
            return NextResponse.json({ error: 'INSUFFICIENT_CON', required: price, balance }, { status: 402 });
          }
          return NextResponse.json({ error: 'CON 차감 중 오류가 발생했습니다.' }, { status: 500 });
        }
      }
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    const CIRCLES = ['①','②','③','④','⑤'];

    // 유형별 개별 생성 + 검증 (병렬 실행으로 토큰 한계 우회)
    const generateForType = async (questionType: string): Promise<ExamQuestion | null> => {
      const MAX_RETRIES = 3;
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        let q: ExamQuestion | undefined;
        try {
          const response = await client.chat.completions.create({
            model: 'gpt-4o',
            max_tokens: 4000,
            messages: [{ role: 'user', content: buildExamPrompt(text, [questionType], difficulty) }],
          });
          const rawText = response.choices[0]?.message?.content ?? '';
          const parsed = JSON.parse(extractJson(rawText)) as { questions: ExamQuestion[] };
          q = parsed.questions[0];
        } catch {
          if (attempt < MAX_RETRIES) continue;
          return null;
        }

        if (!q) {
          if (attempt < MAX_RETRIES) continue;
          return null;
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

    // 모든 유형을 병렬로 동시 생성
    const results = await Promise.all(questionTypes.map(t => generateForType(t)));
    const questions = results.filter((q): q is ExamQuestion => q !== null);

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
