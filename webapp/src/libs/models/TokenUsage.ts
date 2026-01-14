/// Information about token usage used to generate bot response.
export type TokenUsage = Record<string, number | undefined>;

export type TokenUsageView = Record<string, TokenUsageViewDetails>;

export interface TokenUsageViewDetails {
    usageCount: number;
    legendLabel: string;
    color: string;
}

export interface FunctionDetails {
    usageCount: number;
    legendLabel: string;
    color?: string;
}

export const TokenUsageFunctionNameMap: Record<string, string> = {
    audienceExtraction: 'Målgruppeanalyse',
    userIntentExtraction: 'Forståing av spørsmål',
    metaPromptTemplate: 'Systeminstruksjonar',
    responseCompletion: 'KI-svar',
    workingMemoryExtraction: 'Samtalehistorikk',
    longTermMemoryExtraction: 'Dokument og minne',
};
