import type { AsanaClientWrapper } from './asana-client-wrapper.js';
export interface MCPPrompt {
    name: string;
    description: string;
    arguments?: Array<{
        name: string;
        description: string;
        required?: boolean;
    }>;
}
export declare const prompts: Record<string, MCPPrompt>;
export declare function createPromptHandler(client: AsanaClientWrapper): {
    listPrompts: () => Promise<{
        prompts: MCPPrompt[];
    }>;
    getPrompt: (request: {
        params: {
            name: string;
            arguments?: Record<string, any>;
        };
    }) => Promise<any>;
};
