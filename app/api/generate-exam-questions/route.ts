import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export const maxDuration = 60;

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

- choices:
5개의 영어 명사구/동명사구/절 형태 선지

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
`,

  grammar: `
--- grammar (어법 유형) ---

- modified_passage:
원본 지문 전체를 그대로 사용하되, 5곳에 ①②③④⑤ 번호를 삽입한 수정 지문.
원본 지문의 첫 문장부터 마지막 문장까지 모두 포함해야 한다. 지문을 잘라 쓰지 말 것.

[절대 규칙 - 위반 금지]
· ①②③④⑤ 5개 번호 모두 반드시 modified_passage 안에 삽입되어야 한다. 하나라도 빠지면 안 된다.
· 각 번호는 반드시 원본 지문에 실제로 존재하는 단어/구 앞에만 삽입할 것.
· choice의 단어/구는 modified_passage에 해당 번호 뒤에 등장하는 단어/구와 완전히 동일해야 한다.
· 지문에 없는 단어(예: "human cognition", 원문에 없는 표현)를 choice로 사용 금지.
· 5개의 선지 단어/구는 서로 완전히 달라야 한다. 동일한 단어/구가 두 개 이상의 선지에 포함되는 것을 절대 금지한다.
· 생성 후 ①②③④⑤가 모두 modified_passage에 있는지 반드시 확인할 것.

- 번호 삽입 형식 (반드시 준수):
  · 단일 단어 대상: 번호를 단어 바로 앞에 삽입. 예) ①always eventually
  · 다중 단어 대상: 번호 뒤에 [대괄호]로 구를 감쌀 것. 예) ③[such as] wanting, ②[the reasons] have
  · 대괄호 안에 밑줄 칠 단어/구 전체를 넣을 것.

- 반드시 1개만 어법상 틀리게 수정하고 나머지 4개는 완전히 올바른 어법이어야 한다.

- question_text:
"다음 글의 밑줄 친 부분 중, 어법상 틀린 것은?"

- choices text 형식 (반드시 준수):
"① 단어" 형식 — 원형 번호(①②③④⑤) + 공백 + 단어/구. 원형 번호를 text 필드 맨 앞에 포함할 것.
예시: {"number": 1, "text": "① underlined"}, {"number": 2, "text": "② reviewed"}
각 번호 뒤의 단어/구는 지문 modified_passage와 완전히 일치해야 한다.

- answer:
틀린 번호 1개

- explanation:
왜 틀렸는지 + 올바른 형태를 한글로 상세 설명

[오류 포인트 — 난이도별 의무 적용]
난이도 B1~B2(중등·고등 중): 아래 1~8번 중 자유 선택.
난이도 C1~C2(고등 중상·고등 최상): 반드시 1~3번(관계사·병렬구조·분사) 중 하나로 출제할 것.
  → 수일치(7)·시제(6)·수동태(4) 단독 오류는 C1 이상에서 절대 금지.

1. 관계사
   - 관계대명사 vs 관계부사 혼동 (that/which vs where/when/why)
   - 선행사의 격에 맞지 않는 관계사 사용
   - 예) the reason [where→why] / the city [that→where] he lived
   - 수식어구·삽입절에 가려진 선행사와 관계사 간 격 불일치로 난이도 높일 것

2. 병렬구조
   - 등위접속사(and/but/or)/상관접속사(both~and, not only~but also) 앞뒤 품사·형식 불일치
   - 예) not only [worked→working] hard but also achieving / both [to read→reading] and writing
   - 동명사↔부정사, 명사↔절, 형용사↔부사 등 품사 범주 교차 오류로 출제

3. 분사
   - 현재분사 vs 과거분사 오용 (능동·수동 의미 혼동)
   - 분사구문의 의미상 주어와 주절 주어 불일치
   - 감정동사 분사형 혼동 (interested vs interesting)
   - 예) The result was [surprising→surprised] / [Knowing→Known] for its beauty, the city…
   - 분사구가 긴 명사구 뒤에 배치되어 구조 분석이 어려운 형태로 출제

4. 수동태: 3/4/5형식 수동 전환 오류, by 이하 생략 시 능동·수동 혼동
5. 대명사 참조: 지시대명사 수·격 불일치, 재귀대명사 오용
6. 시제: 시제 일치 위반, 완료시제 vs 단순시제 혼동
7. 수일치: 주어-동사 수 불일치 (단, 수식어구에 가려진 경우만 허용. 단순 단수/복수 오류 금지)
8. 형용사/부사 구분

[오류 자연스러움 조건 — 필수]
- 오류 단어/구는 수정 전 형태가 표면상 문법적으로 보여야 한다.
- 빠르게 읽으면 맞는 것처럼 느껴지고, 전체 문장 구조를 끝까지 분석해야만 발견 가능해야 한다.
- 의미가 완전히 달라지거나 문장이 말이 안 되는 수준의 오류 절대 금지.
- 오답 포인트는 상위권 학생도 1차 독해에서 지나치기 쉬운 구조에 배치할 것.
- 나머지 4개 선지도 모두 의심스럽게 느껴지도록 설계하여 함정 역할을 해야 한다.
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
· 각 번호는 밑줄 칠 대상 단어 바로 앞에 붙인다. 관사(a, an, the), 전치사, 대명사, 접속사 앞에 삽입하는 것을 절대 금지한다.
  올바른 예: "leads to a ②feeling" / 잘못된 예: "leads to ②a feeling"
  올바른 예: "incorrect ①assumption" / 잘못된 예: "①an incorrect assumption"
· choices의 단어는 modified_passage에서 해당 번호 바로 뒤에 오는 첫 번째 단어와 반드시 완전히 일치해야 한다.
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

[고난도 조건]
- 교체된 단어가 표면적으로는 자연스러워 보여야 함 (단순 happy→sad 교체 금지)
- 학생이 글 전체 논리를 이해해야만 오류를 발견할 수 있어야 함
- 나머지 4개 단어도 C2~C2+ 고난도 어휘로 선정하여 학생이 모든 선지를 검토하도록 만들 것
- 교체 어휘는 해당 문장 내에서는 문법적으로 올바르지만 글 전체 맥락에서 논리적으로 틀려야 함
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
    const { text, questionTypes, difficulty = 'c2' } = await request.json() as { text: string; questionTypes: string[]; difficulty?: 'b1' | 'b2' | 'c1' | 'c2' };

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

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    const CIRCLES = ['①','②','③','④','⑤'];

    const callAI = async () => {
      const response = await client.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 4096,
        messages: [{ role: 'user', content: buildExamPrompt(text, questionTypes, difficulty) }],
      });
      const rawText = response.choices[0]?.message?.content ?? '';
      return JSON.parse(extractJson(rawText)) as { questions: ExamQuestion[] };
    };

    let parsed: { questions: ExamQuestion[] };
    const MAX_RETRIES = 3;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        parsed = await callAI();
      } catch {
        if (attempt === MAX_RETRIES) {
          console.error('[generate-exam-questions] JSON 파싱 최종 실패');
          return NextResponse.json({ error: '다시 생성해주세요.' }, { status: 500 });
        }
        continue;
      }

      // 어법 유형 검증: ①~⑤ 모두 있는지 + 선지 중복 없는지 확인
      const grammarQ = parsed!.questions.find(q => q.type === 'grammar');
      if (grammarQ) {
        const missing = CIRCLES.filter(c => !grammarQ.modified_passage?.includes(c));
        if (missing.length > 0) {
          console.warn(`[generate-exam-questions] 어법 지문 누락 번호 ${missing.join('')} — 재시도 ${attempt + 1}/${MAX_RETRIES}`);
          if (attempt < MAX_RETRIES) continue;
          return NextResponse.json({ error: '다시 생성해주세요.' }, { status: 500 });
        }
        const gTexts = grammarQ.choices.map((c: ExamChoice) => c.text.replace(/^[①②③④⑤]\s*/, '').trim().toLowerCase());
        if (new Set(gTexts).size < gTexts.length) {
          console.warn(`[generate-exam-questions] 어법 선지 중복 — 재시도 ${attempt + 1}/${MAX_RETRIES}`);
          if (attempt < MAX_RETRIES) continue;
          return NextResponse.json({ error: '다시 생성해주세요.' }, { status: 500 });
        }
      }

      // 낱말 쓰임 유형 검증: ①~⑤ 모두 있는지 + 선지 중복 없는지 확인
      const vocabParaphraseQ = parsed!.questions.find(q => q.type === 'vocab_paraphrase');
      if (vocabParaphraseQ) {
        const missing = CIRCLES.filter(c => !vocabParaphraseQ.modified_passage?.includes(c));
        if (missing.length > 0) {
          console.warn(`[generate-exam-questions] 낱말쓰임 지문 누락 번호 ${missing.join('')} — 재시도 ${attempt + 1}/${MAX_RETRIES}`);
          if (attempt < MAX_RETRIES) continue;
          return NextResponse.json({ error: '다시 생성해주세요.' }, { status: 500 });
        }
        const vpTexts = vocabParaphraseQ.choices.map((c: ExamChoice) => c.text.replace(/^[①②③④⑤]\s*/, '').trim().toLowerCase());
        if (new Set(vpTexts).size < vpTexts.length) {
          console.warn(`[generate-exam-questions] 낱말쓰임 선지 중복 — 재시도 ${attempt + 1}/${MAX_RETRIES}`);
          if (attempt < MAX_RETRIES) continue;
          return NextResponse.json({ error: '다시 생성해주세요.' }, { status: 500 });
        }
      }

      // vocab_blank 검증: (a), (b) 모두 modified_passage에 있는지 확인
      const vocabBlankQ = parsed!.questions.find(q => q.type === 'vocab_blank');
      if (vocabBlankQ) {
        const passage = vocabBlankQ.modified_passage ?? '';
        const missingBlanks = ['(a)', '(b)'].filter(b => !passage.toLowerCase().includes(b));
        if (missingBlanks.length > 0) {
          console.warn(`[generate-exam-questions] vocab_blank 누락 빈칸 ${missingBlanks.join(',')} — 재시도 ${attempt + 1}/${MAX_RETRIES}`);
          if (attempt < MAX_RETRIES) continue;
          return NextResponse.json({ error: '다시 생성해주세요.' }, { status: 500 });
        }
      }

      break;
    }

    return NextResponse.json({ success: true, questions: parsed!.questions });
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
