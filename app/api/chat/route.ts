import { openai } from '@ai-sdk/openai';
import { streamText, generateText } from 'ai';
import { auth } from '@/app/(auth)/auth';
import { artifactTools } from '@/lib/ai/tools/artifacts';
import { saveDocument, getDocumentById } from '@/lib/db/queries';

// Generate content prompts based on artifact type
function getContentPrompt(kind: string, title: string, contentPrompt?: string) {
  const basePrompt =
    contentPrompt || `Create a ${kind} artifact with the title: ${title}`;

  switch (kind) {
    case 'text':
      return `Write a comprehensive, well-structured document about: ${basePrompt}. 
      Use markdown formatting with headers (## ### ####), bullet points (- or *), and proper structure. 
      Make it informative and engaging. Include multiple sections with clear headings.
      DO NOT include the main title "${title}" as the first header - start with section headers.`;

    case 'code':
      return `Write clean, well-commented code for: ${basePrompt}. 
      Include appropriate imports, error handling, and follow best practices. 
      Return only the code without explanations.`;

    case 'sheet':
      return `Create a well-structured CSV data sheet for: ${basePrompt}. 
      Include clear headers and realistic sample data. 
      Use proper CSV formatting with commas as separators.`;

    case 'image':
      return `Create a detailed description of an image: ${basePrompt}`;

    default:
      return basePrompt;
  }
}

export async function POST(req: Request) {
  // This route is deprecated - all requests should go through /api/brain
  return new Response(
    JSON.stringify({
      error: 'This endpoint is deprecated. Please use /api/brain instead.',
      redirectTo: '/api/brain',
    }),
    {
      status: 410, // Gone
      headers: { 'Content-Type': 'application/json' },
    },
  );
}
