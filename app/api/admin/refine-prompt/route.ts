import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { currentPrompt, selectedTools } = await req.json();

    if (!currentPrompt || !selectedTools?.length) {
      return NextResponse.json(
        { error: 'Current prompt and selected tools are required' },
        { status: 400 },
      );
    }

    const toolsList = selectedTools
      .map((tool: any) => `${tool.name} (${tool.description})`)
      .join(', ');

    const { text } = await generateText({
      model: openai('gpt-4'),
      prompt: `You are an AI assistant helping to refine a specialist persona prompt. 

Current prompt: "${currentPrompt}"

Selected tools: ${toolsList}

Please enhance this prompt by:
1. Incorporating specific guidance on how to use the selected tools effectively
2. Adding personality traits that align with the tool capabilities
3. Including specific instructions for tool usage patterns
4. Maintaining the core mission while enhancing tool integration
5. Making the persona more engaging and professional

Respond with ONLY the improved prompt text, no explanations or formatting.`,
    });

    return NextResponse.json({ refinedPrompt: text });
  } catch (error) {
    console.error('Error refining prompt:', error);
    return NextResponse.json(
      { error: 'Failed to refine prompt' },
      { status: 500 },
    );
  }
}
