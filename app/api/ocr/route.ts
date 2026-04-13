import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export const maxDuration = 30;

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const image = formData.get('image') as File | null;

    if (!image) {
      return NextResponse.json({ error: '이미지 파일이 필요합니다.' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(image.type)) {
      return NextResponse.json(
        { error: 'JPG, PNG, GIF, WebP 형식만 지원합니다.' },
        { status: 400 }
      );
    }

    if (image.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: '이미지 파일이 너무 큽니다. (최대 10MB)' },
        { status: 400 }
      );
    }

    const arrayBuffer = await image.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = image.type;

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${base64}`, detail: 'high' },
            },
            {
              type: 'text',
              text: `이 이미지에서 영어 텍스트를 정확하게 추출해주세요.

규칙:
- 원문의 단어, 철자, 구두점을 그대로 유지하세요
- 줄바꿈은 자연스럽게 처리하세요
- 이미지에 있는 텍스트만 출력하고 설명, 코멘트, 번역은 절대 추가하지 마세요
- 한국어 텍스트가 있어도 영어 텍스트 위주로 추출하세요`,
            },
          ],
        },
      ],
    });

    const text = response.choices[0]?.message?.content ?? '';

    if (!text.trim()) {
      return NextResponse.json(
        { error: '이미지에서 텍스트를 추출할 수 없습니다. 선명한 이미지를 사용해주세요.' },
        { status: 422 }
      );
    }

    return NextResponse.json({ success: true, text });
  } catch (error: unknown) {
    console.error('[ocr] 오류:', error);
    let message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

    if (message.includes('401') || message.includes('authentication')) {
      message = 'API 키가 올바르지 않습니다. .env.local의 OPENAI_API_KEY를 확인해주세요.';
    } else if (message.includes('429')) {
      message = 'API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.';
    } else if (message.includes('529') || message.includes('overloaded')) {
      message = 'AI 서버가 혼잡합니다. 잠시 후 다시 시도해주세요.';
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
