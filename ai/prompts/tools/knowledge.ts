// lib/ai/prompts/tools/knowledge.ts

/**
 * Instructions for using tools that interact with the internal knowledge base
 * (e.g., searchInternalKnowledgeBase, getFileContents, listDocuments).
 */
export const knowledgeToolInstructions = `
## Knowledge Base Tool Usage
- Use listDocuments first to discover available documents before retrieving specific content
- When using getDocumentContents, prefer document IDs over titles for maximum precision
- When using internal knowledge tools, cite the document title or ID in your response
- Base answers strictly on the retrieved document content unless explicitly asked to supplement
- If retrieved content is insufficient, state that clearly
- For semantic searches across all content, use searchInternalKnowledgeBase
- Follow the workflow: listDocuments → getDocumentContents → cite source in response`;
