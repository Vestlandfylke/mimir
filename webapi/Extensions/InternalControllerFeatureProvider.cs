// Copyright (c) Microsoft. All rights reserved.

using System.Reflection;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Controllers;

namespace CopilotChat.WebApi.Extensions;

/// <summary>
/// Custom controller feature provider that discovers internal controllers.
/// ASP.NET Core's default ControllerFeatureProvider only discovers public controllers.
/// This provider extends that to also discover internal controllers in the same assembly.
/// </summary>
internal sealed class InternalControllerFeatureProvider : ControllerFeatureProvider
{
    protected override bool IsController(TypeInfo typeInfo)
    {
        // Check standard controller criteria first
        if (!typeInfo.IsClass)
        {
            return false;
        }

        if (typeInfo.IsAbstract)
        {
            return false;
        }

        if (typeInfo.ContainsGenericParameters)
        {
            return false;
        }

        if (typeInfo.IsDefined(typeof(NonControllerAttribute)))
        {
            return false;
        }

        // Allow both public and internal (non-public) classes
        // Standard provider only allows public, we extend to allow internal too
        if (!typeInfo.IsPublic && !typeInfo.IsNotPublic && !typeInfo.IsNestedAssembly)
        {
            // For nested types, check if it's internal (assembly)
            if (typeInfo.IsNested && !typeInfo.IsNestedAssembly)
            {
                return false;
            }
        }

        // Must end with "Controller" or have [Controller] attribute
        if (!typeInfo.Name.EndsWith("Controller", StringComparison.OrdinalIgnoreCase) &&
            !typeInfo.IsDefined(typeof(ControllerAttribute)))
        {
            return false;
        }

        return true;
    }
}
