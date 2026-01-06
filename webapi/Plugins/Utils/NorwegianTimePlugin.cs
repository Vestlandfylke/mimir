// Copyright (c) Microsoft. All rights reserved.

using System.ComponentModel;
using System.Globalization;
using Microsoft.SemanticKernel;

namespace CopilotChat.WebApi.Plugins.Utils;

/// <summary>
/// Time plugin that returns dates and times in Norwegian format and timezone.
/// </summary>
public class NorwegianTimePlugin
{
    private static readonly TimeZoneInfo NorwegianTimeZone = TimeZoneInfo.FindSystemTimeZoneById("Central European Standard Time");
    private static readonly CultureInfo NorwegianCulture = new("nb-NO");

    /// <summary>
    /// Get the current date and time in Norwegian timezone.
    /// </summary>
    [KernelFunction, Description("Get the current date and time in Norwegian timezone (Europe/Oslo)")]
    public string Now()
    {
        var norwegianTime = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, NorwegianTimeZone);
        return norwegianTime.ToString("dddd d. MMMM yyyy 'kl.' HH:mm", NorwegianCulture);
    }

    /// <summary>
    /// Get the current date in Norwegian format.
    /// </summary>
    [KernelFunction, Description("Get the current date in Norwegian format")]
    public string Today()
    {
        var norwegianTime = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, NorwegianTimeZone);
        return norwegianTime.ToString("dddd d. MMMM yyyy", NorwegianCulture);
    }

    /// <summary>
    /// Get the current time in Norwegian 24-hour format.
    /// </summary>
    [KernelFunction, Description("Get the current time in Norwegian 24-hour format")]
    public string Time()
    {
        var norwegianTime = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, NorwegianTimeZone);
        return norwegianTime.ToString("HH:mm", NorwegianCulture);
    }

    /// <summary>
    /// Get the current year.
    /// </summary>
    [KernelFunction, Description("Get the current year")]
    public string Year()
    {
        var norwegianTime = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, NorwegianTimeZone);
        return norwegianTime.Year.ToString(CultureInfo.InvariantCulture);
    }

    /// <summary>
    /// Get the current month name in Norwegian.
    /// </summary>
    [KernelFunction, Description("Get the current month name in Norwegian")]
    public string Month()
    {
        var norwegianTime = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, NorwegianTimeZone);
        return norwegianTime.ToString("MMMM", NorwegianCulture);
    }

    /// <summary>
    /// Get the current day of the month.
    /// </summary>
    [KernelFunction, Description("Get the current day of the month")]
    public string Day()
    {
        var norwegianTime = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, NorwegianTimeZone);
        return norwegianTime.Day.ToString(CultureInfo.InvariantCulture);
    }

    /// <summary>
    /// Get the current day of the week in Norwegian.
    /// </summary>
    [KernelFunction, Description("Get the current day of the week in Norwegian")]
    public string DayOfWeek()
    {
        var norwegianTime = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, NorwegianTimeZone);
        return norwegianTime.ToString("dddd", NorwegianCulture);
    }

    /// <summary>
    /// Get the current hour (24-hour format).
    /// </summary>
    [KernelFunction, Description("Get the current hour in 24-hour format")]
    public string Hour()
    {
        var norwegianTime = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, NorwegianTimeZone);
        return norwegianTime.Hour.ToString("00", CultureInfo.InvariantCulture);
    }

    /// <summary>
    /// Get the current minute.
    /// </summary>
    [KernelFunction, Description("Get the current minute")]
    public string Minute()
    {
        var norwegianTime = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, NorwegianTimeZone);
        return norwegianTime.Minute.ToString("00", CultureInfo.InvariantCulture);
    }

    /// <summary>
    /// Get the current second.
    /// </summary>
    [KernelFunction, Description("Get the current second")]
    public string Second()
    {
        var norwegianTime = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, NorwegianTimeZone);
        return norwegianTime.Second.ToString("00", CultureInfo.InvariantCulture);
    }

    /// <summary>
    /// Get the timezone name.
    /// </summary>
    [KernelFunction, Description("Get the timezone name (Norwegian timezone)")]
    public string TimeZoneName()
    {
        return "Norsk tid (Europe/Oslo)";
    }

    /// <summary>
    /// Get the UTC offset for Norwegian timezone.
    /// </summary>
    [KernelFunction, Description("Get the UTC offset for Norwegian timezone")]
    public string TimeZoneOffset()
    {
        var offset = NorwegianTimeZone.GetUtcOffset(DateTime.UtcNow);
        return offset.Hours >= 0 ? $"+{offset.Hours:00}:00" : $"{offset.Hours:00}:00";
    }
}

