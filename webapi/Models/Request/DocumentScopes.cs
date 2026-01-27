// Copyright (c) Microsoft. All rights reserved.

namespace CopilotChat.WebApi.Models.Request;

/// <summary>
/// Scope of the document. This determines the collection name in the document memory.
/// </summary>
internal enum DocumentScopes
{
    Global,
    Chat,
}
