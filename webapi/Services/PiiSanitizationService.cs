// Copyright (c) Microsoft. All rights reserved.

using System.Text.RegularExpressions;

namespace CopilotChat.WebApi.Services;

/// <summary>
/// Result of PII sanitization on a text input.
/// </summary>
public sealed class SanitizeResult
{
    /// <summary>
    /// The sanitized text with PII masked.
    /// </summary>
    public required string SanitizedText { get; init; }

    /// <summary>
    /// Whether any PII was detected and masked.
    /// </summary>
    public bool ContainsPii => this.Warnings.Count > 0;

    /// <summary>
    /// Human-readable warnings describing what was detected and removed (in nynorsk).
    /// </summary>
    public List<string> Warnings { get; init; } = [];
}

/// <summary>
/// Service that detects and masks Norwegian PII (personally identifiable information)
/// from text content before it is sent to the AI model.
///
/// Detects:
/// - Norwegian fødselsnummer / personnummer (11 digits, Modulus 11 validated)
/// - D-nummer (11 digits, first digit +4, Modulus 11 validated)
/// - Norwegian bank account numbers (11 digits, MOD11 validated)
/// - Credit card numbers (13-19 digits, Luhn validated)
///
/// Handles common formatting variations including spaces, dashes, and dots as separators.
///
/// This service is stateless and safe to register as a singleton.
/// </summary>
public sealed partial class PiiSanitizationService
{
    private readonly ILogger<PiiSanitizationService> _logger;

    public PiiSanitizationService(ILogger<PiiSanitizationService> logger)
    {
        this._logger = logger;
    }

    /// <summary>
    /// Sanitize the given text by detecting and masking PII.
    /// </summary>
    /// <param name="text">The user input text to sanitize.</param>
    /// <returns>A result containing the sanitized text and any warnings.</returns>
    public SanitizeResult Sanitize(string text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return new SanitizeResult { SanitizedText = text };
        }

        var warnings = new List<string>();
        var sanitized = text;

        // Order matters: check credit cards first (longer digit sequences) before 11-digit patterns
        // to avoid partial matches on credit card numbers.
        sanitized = MaskCreditCardNumbers(sanitized, warnings);
        sanitized = MaskPersonnummer(sanitized, warnings);
        sanitized = MaskBankAccountNumbers(sanitized, warnings);

        if (warnings.Count > 0)
        {
            this._logger.LogWarning("PII detected and masked in user input. Types: {PiiTypes}",
                string.Join(", ", warnings));
        }

        return new SanitizeResult
        {
            SanitizedText = sanitized,
            Warnings = warnings,
        };
    }

    #region Shared Helpers

    /// <summary>
    /// Extract only digit characters from a string.
    /// </summary>
    private static string ExtractDigits(string value)
    {
        return new string(value.Where(char.IsDigit).ToArray());
    }

    /// <summary>
    /// Replace all digit characters with asterisks, preserving separators (dots, spaces, dashes).
    /// </summary>
    private static string MaskPreservingSeparators(string value)
    {
        return new string(value.Select(c => char.IsDigit(c) ? '*' : c).ToArray());
    }

    #endregion

    #region Norwegian Personnummer / D-nummer

    // ──────────────────────────────────────────────────────────────────────
    // Personnummer formats to catch:
    //   12345678901         (plain 11 consecutive digits)
    //   123456 78901        (6+5 with space)
    //   123456-78901        (6+5 with dash)
    //   12.03.45 67890      (DD.MM.YY + space + 5 digits)
    //   12.03.45-67890      (DD.MM.YY + dash + 5 digits)
    //   12 03 45 678 90     (fully spaced - less common)
    // ──────────────────────────────────────────────────────────────────────

    // Pattern 1: Plain 11 consecutive digits
    [GeneratedRegex(@"(?<!\d)\d{11}(?!\d)", RegexOptions.Compiled)]
    private static partial Regex ElevenDigitPlainRegex();

    // Pattern 2: 6 digits + separator + 5 digits (e.g. "123456 78901" or "123456-78901")
    [GeneratedRegex(@"(?<!\d)\d{6}[\s\-]\d{5}(?!\d)", RegexOptions.Compiled)]
    private static partial Regex PersonnummerSixFiveRegex();

    // Pattern 3: DD.MM.YY + separator + 5 digits (e.g. "12.03.45 67890" or "12.03.45-67890")
    [GeneratedRegex(@"(?<!\d)\d{2}\.\d{2}\.\d{2}[\s\-]\d{5}(?!\d)", RegexOptions.Compiled)]
    private static partial Regex PersonnummerDateFormattedRegex();

    /// <summary>
    /// Detect and mask Norwegian fødselsnummer and D-nummer in all common formats.
    /// Format: DDMMYYIIIKK (11 digits)
    /// - DD: day (01-31 for fødselsnummer, 41-71 for D-nummer)
    /// - MM: month (01-12)
    /// - YY: year
    /// - III: individual number
    /// - KK: two control digits (Modulus 11)
    /// </summary>
    private static string MaskPersonnummer(string text, List<string> warnings)
    {
        bool found = false;

        // Pass 1: Formatted with dots in date part (DD.MM.YY IIIKK / DD.MM.YY-IIIKK)
        // Must run before other patterns to avoid partial matches.
        var result = PersonnummerDateFormattedRegex().Replace(text, match =>
        {
            var digits = ExtractDigits(match.Value);
            if (digits.Length == 11 && IsValidPersonnummer(digits))
            {
                found = true;
                return MaskPreservingSeparators(match.Value);
            }
            return match.Value;
        });

        // Pass 2: 6+5 format (DDMMYY IIIKK / DDMMYY-IIIKK)
        result = PersonnummerSixFiveRegex().Replace(result, match =>
        {
            var digits = ExtractDigits(match.Value);
            if (digits.Length == 11 && IsValidPersonnummer(digits))
            {
                found = true;
                return MaskPreservingSeparators(match.Value);
            }
            return match.Value;
        });

        // Pass 3: Plain 11 consecutive digits
        result = ElevenDigitPlainRegex().Replace(result, match =>
        {
            if (IsValidPersonnummer(match.Value))
            {
                found = true;
                return new string('*', 11);
            }
            return match.Value;
        });

        if (found)
        {
            warnings.Add("Fødselsnummer/personnummer vart fjerna frå meldinga.");
        }

        return result;
    }

    /// <summary>
    /// Validates a Norwegian fødselsnummer or D-nummer using the Modulus 11 algorithm.
    /// </summary>
    private static bool IsValidPersonnummer(string digits)
    {
        if (digits.Length != 11 || !digits.All(char.IsDigit))
        {
            return false;
        }

        int[] d = digits.Select(c => c - '0').ToArray();

        // Extract date components
        int day = d[0] * 10 + d[1];
        int month = d[2] * 10 + d[3];

        // D-nummer: first digit is increased by 4 (day range 41-71)
        bool isDnummer = day >= 41 && day <= 71;
        int actualDay = isDnummer ? day - 40 : day;

        // Basic date validation
        if (actualDay < 1 || actualDay > 31)
        {
            return false;
        }
        if (month < 1 || month > 12)
        {
            return false;
        }

        // Modulus 11 check for control digit 1 (k1)
        int[] weights1 = [3, 7, 6, 1, 8, 9, 4, 5, 2];
        int sum1 = 0;
        for (int i = 0; i < 9; i++)
        {
            sum1 += d[i] * weights1[i];
        }
        int remainder1 = sum1 % 11;
        int k1 = remainder1 == 0 ? 0 : 11 - remainder1;
        if (k1 == 11)
        {
            k1 = 0;
        }
        if (k1 == 10 || d[9] != k1)
        {
            return false;
        }

        // Modulus 11 check for control digit 2 (k2)
        int[] weights2 = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
        int sum2 = 0;
        for (int i = 0; i < 10; i++)
        {
            sum2 += d[i] * weights2[i];
        }
        int remainder2 = sum2 % 11;
        int k2 = remainder2 == 0 ? 0 : 11 - remainder2;
        if (k2 == 11)
        {
            k2 = 0;
        }
        if (k2 == 10 || d[10] != k2)
        {
            return false;
        }

        return true;
    }

    #endregion

    #region Norwegian Bank Account Number

    // ──────────────────────────────────────────────────────────────────────
    // Bank account formats to catch:
    //   35301386611           (plain 11 consecutive digits)
    //   3530.13.86611         (dots - official Norwegian format: XXXX.XX.XXXXX)
    //   3530 13 86611         (spaces)
    //   3530-13-86611         (dashes)
    //   3530 1386611          (various partial groupings)
    // ──────────────────────────────────────────────────────────────────────

    // Match formatted bank account: 4 digits + separator + 2 digits + separator + 5 digits
    // Separators can be dots, spaces, or dashes.
    [GeneratedRegex(@"(?<!\d)\d{4}[\.\s\-]\d{2}[\.\s\-]\d{5}(?!\d)", RegexOptions.Compiled)]
    private static partial Regex BankAccountFormattedRegex();

    /// <summary>
    /// Detect and mask Norwegian bank account numbers in all common formats.
    /// Format: 11 digits, validated with MOD11 checksum.
    /// The last digit is the check digit.
    /// </summary>
    private static string MaskBankAccountNumbers(string text, List<string> warnings)
    {
        bool found = false;

        // Pass 1: Formatted bank account numbers (XXXX.XX.XXXXX, XXXX XX XXXXX, XXXX-XX-XXXXX)
        var result = BankAccountFormattedRegex().Replace(text, match =>
        {
            var digits = ExtractDigits(match.Value);
            if (digits.Length == 11 && IsValidBankAccount(digits) && !IsValidPersonnummer(digits))
            {
                found = true;
                return MaskPreservingSeparators(match.Value);
            }
            return match.Value;
        });

        // Pass 2: Plain 11-digit bank account numbers (no separators).
        // MaskPersonnummer already ran over these, but only checked personnummer validity.
        // We need to check for bank account validity on the remaining unmasked 11-digit sequences.
        result = ElevenDigitPlainRegex().Replace(result, match =>
        {
            var digits = match.Value;
            if (IsValidBankAccount(digits) && !IsValidPersonnummer(digits))
            {
                found = true;
                return new string('*', 11);
            }
            return digits;
        });

        if (found)
        {
            warnings.Add("Bankkontonummer vart fjerna frå meldinga.");
        }

        return result;
    }

    /// <summary>
    /// Validates a Norwegian bank account number using MOD11 checksum.
    /// Weights: 5, 4, 3, 2, 7, 6, 5, 4, 3, 2 (for digits 1-10, digit 11 is check digit).
    /// </summary>
    private static bool IsValidBankAccount(string digits)
    {
        if (digits.Length != 11 || !digits.All(char.IsDigit))
        {
            return false;
        }

        int[] d = digits.Select(c => c - '0').ToArray();
        int[] weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

        int sum = 0;
        for (int i = 0; i < 10; i++)
        {
            sum += d[i] * weights[i];
        }

        int remainder = sum % 11;
        int checkDigit = remainder == 0 ? 0 : 11 - remainder;

        // If check digit is 10, the account number is invalid
        if (checkDigit == 10)
        {
            return false;
        }

        return d[10] == checkDigit;
    }

    #endregion

    #region Credit Card Numbers

    // ──────────────────────────────────────────────────────────────────────
    // Credit card formats to catch:
    //   4111111111111111              (plain 16 digits)
    //   4111 1111 1111 1111          (groups of 4 with spaces)
    //   4111-1111-1111-1111          (groups of 4 with dashes)
    //   4111.1111.1111.1111          (groups of 4 with dots)
    //   Also handles 13-19 digit cards (e.g. Visa 13-digit, Amex 15-digit)
    // ──────────────────────────────────────────────────────────────────────

    // Match 13-19 digits with optional separators (spaces, dashes, dots) between groups of 4.
    [GeneratedRegex(@"(?<!\d)\d{4}[\s\-\.]?\d{4}[\s\-\.]?\d{4}[\s\-\.]?\d{1,7}(?!\d)", RegexOptions.Compiled)]
    private static partial Regex CreditCardRegex();

    /// <summary>
    /// Detect and mask credit card numbers (13-19 digits, Luhn validated).
    /// Matches digits with optional spaces, dashes, or dots as separators.
    /// </summary>
    private static string MaskCreditCardNumbers(string text, List<string> warnings)
    {
        bool found = false;

        var result = CreditCardRegex().Replace(text, match =>
        {
            var digits = ExtractDigits(match.Value);
            if (digits.Length >= 13 && digits.Length <= 19 && IsValidLuhn(digits))
            {
                found = true;
                return MaskPreservingSeparators(match.Value);
            }
            return match.Value;
        });

        if (found)
        {
            warnings.Add("Kredittkortnummer vart fjerna frå meldinga.");
        }

        return result;
    }

    /// <summary>
    /// Validates a number using the Luhn algorithm.
    /// </summary>
    private static bool IsValidLuhn(string digits)
    {
        int sum = 0;
        bool alternate = false;

        for (int i = digits.Length - 1; i >= 0; i--)
        {
            int n = digits[i] - '0';
            if (alternate)
            {
                n *= 2;
                if (n > 9)
                {
                    n -= 9;
                }
            }
            sum += n;
            alternate = !alternate;
        }

        return sum % 10 == 0;
    }

    #endregion
}
