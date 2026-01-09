// Copyright (c) Microsoft. All rights reserved.

using Azure.Identity;
using CopilotChat.WebApi.Storage;
using Microsoft.AspNetCore.Authorization;

namespace CopilotChat.WebApi.Auth;

/// <summary>
/// Class implementing "authorization" that validates the user has access to a chat.
/// </summary>
public class ChatParticipantAuthorizationHandler : AuthorizationHandler<ChatParticipantRequirement, HttpContext>
{
    private readonly IAuthInfo _authInfo;
    private readonly ChatSessionRepository _chatSessionRepository;
    private readonly ChatParticipantRepository _chatParticipantRepository;

    /// <summary>
    /// Constructor
    /// </summary>
    public ChatParticipantAuthorizationHandler(
        IAuthInfo authInfo,
        ChatSessionRepository chatSessionRepository,
        ChatParticipantRepository chatParticipantRepository) : base()
    {
        this._authInfo = authInfo;
        this._chatSessionRepository = chatSessionRepository;
        this._chatParticipantRepository = chatParticipantRepository;
    }

    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        ChatParticipantRequirement requirement,
        HttpContext resource)
    {
        try
        {
            string? chatId = resource.GetRouteValue("chatId")?.ToString();
            if (chatId == null)
            {
                // delegate to downstream validation
                context.Succeed(requirement);
                return;
            }

            // Use TryFindByIdAsync to avoid exception when chat doesn't exist
            // (common after backend restart with volatile storage)
            bool chatExists = await this._chatSessionRepository.TryFindByIdAsync(chatId);
            if (!chatExists)
            {
                // Chat doesn't exist - delegate to downstream validation which will return 404
                context.Succeed(requirement);
                return;
            }

            bool isUserInChat = await this._chatParticipantRepository.IsUserInChatAsync(this._authInfo.UserId, chatId);
            if (!isUserInChat)
            {
                context.Fail(new AuthorizationFailureReason(this, "User does not have access to the requested chat."));
            }

            context.Succeed(requirement);
        }
        catch (CredentialUnavailableException ex)
        {
            context.Fail(new AuthorizationFailureReason(this, ex.Message));
        }
        catch (KeyNotFoundException)
        {
            // Chat or participant not found - common after backend restart
            // Delegate to downstream validation which will return appropriate error
            context.Succeed(requirement);
        }
    }
}
