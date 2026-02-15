// Copyright (c) Microsoft. All rights reserved.

using System.ComponentModel.DataAnnotations;
using CopilotChat.WebApi.Models.Request;

namespace CopilotChat.WebApi.Options;

/// <summary>
/// Configuration options for the chat
/// </summary>
internal sealed class PromptsOptions
{
    public const string PropertyName = "Prompts";

    /// <summary>
    /// Token limit of the chat model.
    /// </summary>
    /// <remarks>https://platform.openai.com/docs/models/overview for token limits.</remarks>
    [Required, Range(0, int.MaxValue)] public int CompletionTokenLimit { get; set; }

    /// <summary>
    /// The token count left for the model to generate text after the prompt.
    /// </summary>
    [Required, Range(0, int.MaxValue)] public int ResponseTokenLimit { get; set; }

    /// <summary>
    /// The token count allowed for function calling responses.
    /// </summary>
    [Required, Range(0, int.MaxValue)] public int FunctionCallingTokenLimit { get; set; }

    /// <summary>
    /// Weight of memories in the contextual part of the final prompt.
    /// Contextual prompt excludes all the system commands and user intent.
    /// </summary>
    internal double MemoriesResponseContextWeight { get; } = 0.6;

    /// <summary>
    /// Upper bound of relevance score of a kernel memory to be included in the final prompt.
    /// The actual relevancy score is determined by the memory balance.
    /// </summary>
    internal float KernelMemoryRelevanceUpper { get; } = 0.9F;

    /// <summary>
    /// Lower bound of relevance score of a kernel memory to be included in the final prompt.
    /// The actual relevancy score is determined by the memory balance.
    /// </summary>
    internal float KernelMemoryRelevanceLower { get; } = 0.6F;

    /// <summary>
    /// Minimum relevance of a document memory to be included in the final prompt.
    /// The higher the value, the answer will be more relevant to the user intent.
    /// </summary>
    internal float DocumentMemoryMinRelevance { get; } = 0.66F;

    // System
    [Required, NotEmptyOrWhitespace] public string KnowledgeCutoffDate { get; set; } = string.Empty;
    [Required, NotEmptyOrWhitespace] public string InitialBotMessage { get; set; } = string.Empty;
    [Required, NotEmptyOrWhitespace] public string SystemDescription { get; set; } = string.Empty;
    [Required, NotEmptyOrWhitespace] public string SystemResponse { get; set; } = string.Empty;

    /// <summary>
    /// A short, lean description of the bot used for intent extraction and memory extraction prompts.
    /// Unlike SystemDescription (which contains full instructions for chat responses),
    /// this should be a brief identity description (~50-100 tokens) similar to Microsoft's original
    /// Chat Copilot SystemDescription. This avoids sending thousands of irrelevant tokens
    /// (Mermaid rules, file generation, tool instructions, etc.) to intent/memory extraction calls.
    /// Falls back to SystemDescription if not set.
    /// </summary>
    public string SystemIntentDescription { get; set; } = string.Empty;

    /// <summary>
    /// Returns the lean intent description if set, otherwise falls back to SystemDescription.
    /// </summary>
    internal string EffectiveIntentDescription =>
        !string.IsNullOrWhiteSpace(this.SystemIntentDescription)
            ? this.SystemIntentDescription
            : this.SystemDescription;

    /// <summary>
    /// Static cache prefix for Azure OpenAI prompt caching optimization.
    /// This content is placed at the very beginning of the prompt and should be >1024 tokens.
    /// Azure OpenAI automatically caches prompts where the first 1024+ tokens are identical,
    /// reducing input token costs by 90% ($1.75 → $0.175 per million tokens for GPT-5.2).
    /// </summary>
    public string SystemCachePrefix { get; set; } = string.Empty;

    // Templates for specialized chat types
    public Dictionary<string, ChatTemplate>? Templates { get; set; }

    internal string[] SystemAudiencePromptComponents => new string[]
    {
        this.SystemAudience,
        "{{ChatPlugin.ExtractChatHistory}}",
        this.SystemAudienceContinuation
    };

    internal string SystemAudienceExtraction => string.Join("\n", this.SystemAudiencePromptComponents);

    internal string[] SystemIntentPromptComponents => new string[]
    {
        this.SystemDescription,
        this.SystemIntent,
        "{{ChatPlugin.ExtractChatHistory}}",
        this.SystemIntentContinuation
    };

    internal string SystemIntentExtraction => string.Join("\n", this.SystemIntentPromptComponents);

    // Intent extraction
    [Required, NotEmptyOrWhitespace] public string SystemIntent { get; set; } = string.Empty;
    [Required, NotEmptyOrWhitespace] public string SystemIntentContinuation { get; set; } = string.Empty;

    // Audience extraction
    [Required, NotEmptyOrWhitespace] public string SystemAudience { get; set; } = string.Empty;
    [Required, NotEmptyOrWhitespace] public string SystemAudienceContinuation { get; set; } = string.Empty;

    // Memory storage
    [Required, NotEmptyOrWhitespace] public string MemoryIndexName { get; set; } = string.Empty;

    // Document memory
    [Required, NotEmptyOrWhitespace] public string DocumentMemoryName { get; set; } = string.Empty;

    // Memory extraction
    [Required, NotEmptyOrWhitespace] public string SystemCognitive { get; set; } = string.Empty;
    [Required, NotEmptyOrWhitespace] public string MemoryFormat { get; set; } = string.Empty;
    [Required, NotEmptyOrWhitespace] public string MemoryAntiHallucination { get; set; } = string.Empty;
    [Required, NotEmptyOrWhitespace] public string MemoryContinuation { get; set; } = string.Empty;

    // Long-term memory
    [Required, NotEmptyOrWhitespace] public string LongTermMemoryName { get; set; } = string.Empty;
    [Required, NotEmptyOrWhitespace] public string LongTermMemoryExtraction { get; set; } = string.Empty;

    internal string[] LongTermMemoryPromptComponents => new string[]
    {
        this.SystemCognitive,
        $"{this.LongTermMemoryName} Description:\n{this.LongTermMemoryExtraction}",
        this.MemoryAntiHallucination,
        $"Chat Description:\n{this.EffectiveIntentDescription}",
        "{{ChatPlugin.ExtractChatHistory}}",
        this.MemoryContinuation
    };

    internal string LongTermMemory => string.Join("\n", this.LongTermMemoryPromptComponents);

    // Working memory
    [Required, NotEmptyOrWhitespace] public string WorkingMemoryName { get; set; } = string.Empty;
    [Required, NotEmptyOrWhitespace] public string WorkingMemoryExtraction { get; set; } = string.Empty;

    internal string[] WorkingMemoryPromptComponents => new string[]
    {
        this.SystemCognitive,
        $"{this.WorkingMemoryName} Description:\n{this.WorkingMemoryExtraction}",
        this.MemoryAntiHallucination,
        $"Chat Description:\n{this.EffectiveIntentDescription}",
        "{{ChatPlugin.ExtractChatHistory}}",
        this.MemoryContinuation
    };

    internal string WorkingMemory => string.Join("\n", this.WorkingMemoryPromptComponents);

    // Memory map
    internal IDictionary<string, string> MemoryMap => new Dictionary<string, string>()
    {
        { this.LongTermMemoryName, this.LongTermMemory },
        { this.WorkingMemoryName, this.WorkingMemory }
    };

    // Chat commands
    internal string[] SystemPersonaComponents => new string[]
    {
        this.SystemDescription,
        this.SystemResponse,
    };

    internal string SystemPersona => string.Join("\n\n", this.SystemPersonaComponents);

    internal double ResponseTemperature { get; } = 0.7;
    internal double ResponseTopP { get; } = 1;
    internal double ResponsePresencePenalty { get; } = 0.5;
    internal double ResponseFrequencyPenalty { get; } = 0.5;

    internal double IntentTemperature { get; } = 0.7;
    internal double IntentTopP { get; } = 1;
    internal double IntentPresencePenalty { get; } = 0.5;
    internal double IntentFrequencyPenalty { get; } = 0.5;

    // Reasoning prompts for models that support reasoning/thinking mode
    /// <summary>
    /// Reasoning instruction for LOW effort - brief thinking (Nynorsk).
    /// </summary>
    public string ReasoningInstructionLow { get; set; } = "[OBLIGATORISK] Du MÅ inkludere ein kort tankeprosess i <thinking></thinking>-taggar før svaret ditt.\n\nFORMAT:\n<thinking>\n[Kort oppsummering av vurderingane dine - 2-3 setningar]\n</thinking>\n\n[Svaret ditt her]";

    /// <summary>
    /// Reasoning instruction for MEDIUM effort - balanced thinking (Nynorsk, default).
    /// </summary>
    public string ReasoningInstructionMedium { get; set; } = "### OBLIGATORISK FORMAT ###\nDIN FØRSTE OUTPUT MÅ VERE: <thinking>\n\nDu MÅ starte KVART svar med <thinking>-taggar. Dette er ikkje valfritt.\n\nEKSAKT FORMAT:\n<thinking>\nHer skriv du tankeprosessen din på nynorsk.\nAnalyser spørsmålet, vurder ulike tilnærmingar, forklar resonnementet.\n</thinking>\n\nDeretter kjem svaret ditt til brukaren.\n\n### VIKTIG ###\n- Start ALLTID med <thinking>\n- Hopp ALDRI over thinking-seksjonen\n- Avslut thinking med </thinking> før svaret";

    /// <summary>
    /// Reasoning instruction for HIGH effort - detailed analysis (Nynorsk).
    /// </summary>
    public string ReasoningInstructionHigh { get; set; } = "[OBLIGATORISK INSTRUKS - DU MÅ FØLGJE DETTE]\nDu MÅ gje ei detaljert tankeprosess i <thinking></thinking>-taggar før svaret ditt.\n\nFORMATKRAV:\n<thinking>\n## Forståing av problemet\n- Kva blir spurt om?\n- Kva er dei viktige aspekta?\n\n## Analyse av tilnærmingar\n1. Første tilnærming: fordelar og ulemper\n2. Andre tilnærming: fordelar og ulemper\n\n## Vurdering\n- Samanlikning av tilnærmingar\n- Kvifor er ein betre\n\n## Konklusjon\n- Valt tilnærming og grunngjeving\n</thinking>\n\n[Det fullstendige, velformaterte svaret ditt til brukaren her]\n\nKRITISKE REGLAR:\n1. Start ALLTID med detaljerte <thinking>-taggar\n2. Ver grundig og systematisk i resonnementet ditt\n3. Det endelege svaret kjem ETTER den avsluttande </thinking>-taggen\n4. Hopp ALDRI over <thinking>-seksjonen - den er obligatorisk";

    /// <summary>
    /// Copy the options in case they need to be modified per chat.
    /// </summary>
    /// <returns>A shallow copy of the options.</returns>
    internal PromptsOptions Copy() => (PromptsOptions)this.MemberwiseClone();

    /// <summary>
    /// Tries to retrieve the memoryContainerName associated with the specified memory type.
    /// </summary>
    internal bool TryGetMemoryContainerName(string memoryType, out string memoryContainerName)
    {
        memoryContainerName = "";
        if (!Enum.TryParse<SemanticMemoryType>(memoryType, true, out SemanticMemoryType semanticMemoryType))
        {
            return false;
        }

        switch (semanticMemoryType)
        {
            case SemanticMemoryType.LongTermMemory:
                memoryContainerName = this.LongTermMemoryName;
                return true;

            case SemanticMemoryType.WorkingMemory:
                memoryContainerName = this.WorkingMemoryName;
                return true;

            default: return false;
        }
    }
}
