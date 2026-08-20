using System.Linq;
using System.Text.RegularExpressions;

using ClaimShield.Api.Interfaces.Services;
using ClaimShield.Api.Models.DTOs.Ocr;

using Tesseract;

namespace ClaimShield.Api.Services
{
    // =================================================================
    // Real local OCR via the open-source Tesseract engine (no paid API,
    // per the Phase 12 locked architecture) - verified working
    // standalone before this service was written (native win-x64
    // binaries load correctly, eng.traineddata present under
    // ClaimShield.Api/tessdata/).
    //
    // Registration-number extraction is regex-based (fairly reliable,
    // fixed Indian plate format). Owner-name/chassis-number/engine-
    // number/DL-number extraction are best-effort line heuristics over
    // free-form card layouts - there is no structured template to key
    // off, and real Indian DL/RC cards frequently print two columns of
    // labels/values that Tesseract linearizes onto the same OCR line
    // (e.g. "Engine No." and "Owner" side by side become one line of
    // text). These fields are genuinely lower-confidence than the
    // registration number by design, not by omission - see the label
    // heuristics below for how each failure mode is specifically
    // handled.
    // =================================================================

    public class TesseractOcrService : IOcrService
    {
        private static readonly Regex RegNumberPattern =
            new(
                @"[A-Z]{2}[\s-]?[0-9]{1,2}[\s-]?[A-Z]{1,3}[\s-]?[0-9]{4}",
                RegexOptions.Compiled);

        private static readonly Regex ChassisPattern =
            new(
                @"\b[A-HJ-NPR-Z0-9]{11,17}\b",
                RegexOptions.Compiled);

        // Indian DL numbers generally follow StateCode(2) + RTO(2) +
        // Year(4) + Serial(6-7). Matched loosely (digit run allowed
        // 9-13 chars with internal whitespace) since Tesseract spacing
        // around real card numbers is inconsistent - the state-code
        // whitelist check in ExtractDrivingLicenceNumber is what keeps
        // this from matching unrelated digit runs elsewhere on the
        // card (dates, etc.), not the regex shape itself.
        private static readonly Regex DlNumberPattern =
            new(
                @"[A-Z]{2}[\s-]?[0-9]{2}[\s-]{0,2}[0-9\s-]{9,13}",
                RegexOptions.Compiled);

        private static readonly Regex LeadingAlphaNumericToken =
            new(@"^[A-Z0-9]+", RegexOptions.Compiled);

        // Real Indian state/UT registration codes - used to reject
        // false-positive DL-number matches (e.g. a garbled "CS" picked
        // up from an unrelated line) rather than confidently returning
        // a wrong value.
        private static readonly HashSet<string> IndianStateCodes = new(StringComparer.Ordinal)
        {
            "AN", "AP", "AR", "AS", "BR", "CH", "CG", "DN", "DD", "DL",
            "GA", "GJ", "HR", "HP", "JK", "JH", "KA", "KL", "LD", "MP",
            "MH", "MN", "ML", "MZ", "NL", "OD", "OR", "PY", "PB", "RJ",
            "SK", "TN", "TS", "TR", "UP", "UK", "WB", "LA",
        };

        private readonly string _tessDataPath;

        public TesseractOcrService(
            IWebHostEnvironment environment)
        {
            _tessDataPath =
                Path.Combine(environment.ContentRootPath, "tessdata");
        }

        public Task<OcrExtractionResult> ExtractAsync(
            byte[] imageBytes)
        {
            return Task.Run(() =>
            {
                using var engine =
                    new TesseractEngine(
                        _tessDataPath,
                        "eng",
                        EngineMode.Default);

                using var img = Pix.LoadFromMemory(imageBytes);
                using var page = engine.Process(img);

                var rawText = page.GetText();
                var confidence = (decimal)page.GetMeanConfidence();

                return new OcrExtractionResult
                {
                    RawText = rawText,
                    RegistrationNumber = ExtractRegistrationNumber(rawText),
                    OwnerName = ExtractOwnerName(rawText),
                    ChassisNumber = ExtractChassisNumber(rawText),
                    EngineNumber = ExtractEngineNumber(rawText),
                    DrivingLicenceNumber = ExtractDrivingLicenceNumber(rawText),
                    Confidence = confidence
                };
            });
        }

        private static string? ExtractRegistrationNumber(
            string rawText)
        {
            var match = RegNumberPattern.Match(rawText.ToUpperInvariant());

            if (!match.Success)
            {
                return null;
            }

            return Regex.Replace(match.Value, @"[\s-]", string.Empty);
        }

        private static string? ExtractOwnerName(
            string rawText)
        {
            // "Owner Name" must be checked as a combined label before
            // "Owner" or "Name" alone - otherwise a line that reads
            // "Owner Name" gets short-circuited by the shorter "Owner"
            // match, leaving the literal word "Name" to be mistaken
            // for the value.
            return ExtractLabelledTextValue(
                rawText.Split('\n'),
                "Owner Name", "Owner", "Name");
        }

        private static string? ExtractChassisNumber(
            string rawText)
        {
            foreach (Match match in ChassisPattern.Matches(rawText.ToUpperInvariant()))
            {
                // A chassis number is alphanumeric with at least one
                // digit and one letter - filters out pure-digit runs
                // (dates, phone numbers) the pattern would otherwise
                // also match.
                if (match.Value.Any(char.IsDigit) && match.Value.Any(char.IsLetter))
                {
                    return match.Value;
                }
            }

            return null;
        }

        private static string? ExtractEngineNumber(
            string rawText)
        {
            return ExtractLabelledNumericValue(
                rawText.Split('\n'),
                minDigitCount: 5,
                "Engine No", "Engine");
        }

        // =========================================================
        // Shared label-based line heuristics
        // =========================================================
        //
        // Real-world card layouts (DL, RC) print a label and its value
        // several different ways:
        //   - same line:   "Name: GOWDHAM G"
        //   - stacked:     "Name:"
        //                  "GOWDHAM G"
        //   - two columns merged onto one OCR line:
        //                  "Engine No.   Owner"       (headers)
        //                  "65492081113164   Sr: No." (values)
        //
        // The two-column case is why a naive "take whatever follows
        // the label on the same line" approach fails: for "Engine
        // No. Owner", the text after "Engine No" is "Owner" - a real
        // word, not the value, which actually sits on the next line
        // mixed in with more column noise ("65492081113164 Sr: No.").
        //
        // ExtractLabelledNumericValue is for ID-number-shaped fields
        // (engine no, DL no): it requires a minimum digit count and
        // only keeps the LEADING alphanumeric token of whichever line
        // it lands on, discarding trailing noise like " Sr: No. n\"".
        //
        // ExtractLabelledTextValue is for prose fields (a person's
        // name): it rejects any candidate containing a digit, since a
        // real name never does - this at least turns obviously garbled
        // OCR output into an honest "not detected" instead of a
        // confidently wrong value, though it can't invent characters
        // Tesseract never read correctly in the first place.
        // =========================================================

        private static string? FindLabelledLine(
            string[] lines,
            string[] labelPrefixes,
            out string afterLabelOnSameLine,
            out int lineIndex)
        {
            for (var i = 0; i < lines.Length; i++)
            {
                var trimmed = lines[i].Trim();

                var matchedLabel = labelPrefixes
                    .Where(prefix => trimmed.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                    .OrderByDescending(prefix => prefix.Length)
                    .FirstOrDefault();

                if (matchedLabel == null)
                {
                    continue;
                }

                afterLabelOnSameLine =
                    trimmed[matchedLabel.Length..]
                        .TrimStart(':', '-', '.', ' ')
                        .Trim();

                lineIndex = i;
                return matchedLabel;
            }

            afterLabelOnSameLine = string.Empty;
            lineIndex = -1;
            return null;
        }

        private static string? ExtractLabelledNumericValue(
            string[] lines,
            int minDigitCount,
            params string[] labelPrefixes)
        {
            var matchedLabel = FindLabelledLine(
                lines, labelPrefixes, out var sameLine, out var lineIndex);

            if (matchedLabel == null)
            {
                return null;
            }

            var candidate = TryLeadingNumericToken(sameLine, minDigitCount);

            if (candidate != null)
            {
                return candidate;
            }

            // Only the immediate next non-blank line is considered -
            // going further risks pulling in an unrelated field.
            for (var j = lineIndex + 1; j < lines.Length; j++)
            {
                var next = lines[j].Trim();

                if (string.IsNullOrWhiteSpace(next))
                {
                    continue;
                }

                return TryLeadingNumericToken(next, minDigitCount);
            }

            return null;
        }

        private static string? TryLeadingNumericToken(
            string text,
            int minDigitCount)
        {
            var match = LeadingAlphaNumericToken.Match(text.ToUpperInvariant());

            if (!match.Success)
            {
                return null;
            }

            var token = match.Value;

            return token.Count(char.IsDigit) >= minDigitCount ? token : null;
        }

        private static string? ExtractLabelledTextValue(
            string[] lines,
            params string[] labelPrefixes)
        {
            var matchedLabel = FindLabelledLine(
                lines, labelPrefixes, out var sameLine, out var lineIndex);

            if (matchedLabel == null)
            {
                return null;
            }

            if (IsPlausibleTextValue(sameLine))
            {
                return sameLine;
            }

            for (var j = lineIndex + 1; j < lines.Length; j++)
            {
                var next = lines[j].Trim();

                if (string.IsNullOrWhiteSpace(next))
                {
                    continue;
                }

                return IsPlausibleTextValue(next) ? next : null;
            }

            return null;
        }

        private static bool IsPlausibleTextValue(
            string value)
        {
            // A real name/text field is letters (and spaces) only - no
            // digits. This won't recover text Tesseract genuinely
            // misread, but it stops obviously-garbled output (that
            // happens to contain a stray digit) from being returned as
            // if it were a confident result.
            return !string.IsNullOrWhiteSpace(value) &&
                   value.Any(char.IsLetter) &&
                   !value.Any(char.IsDigit);
        }

        private static string? ExtractDrivingLicenceNumber(
            string rawText)
        {
            var upper = rawText.ToUpperInvariant();
            var lines = upper.Split('\n');

            // Prefer an explicitly labelled line ("DL No", "Licence
            // No", etc.) when the card actually has one - not every
            // DL layout prints an explicit label (some just print the
            // number as a standalone bold line near the top), which
            // is why the positional pattern below still runs as a
            // fallback either way.
            var labelled = ExtractLabelledNumericValue(
                lines,
                minDigitCount: 9,
                "DL NO", "DLNO", "LICENCE NO", "LICENSE NO");

            if (labelled != null && IsValidStateCodePrefix(labelled))
            {
                return labelled;
            }

            // Scan every positional match (not just the first) and
            // only accept one whose 2-letter prefix is a real Indian
            // state/UT code - otherwise an unrelated digit run
            // elsewhere on the card (dates, validity numbers) can
            // masquerade as a DL number.
            foreach (Match match in DlNumberPattern.Matches(upper))
            {
                var candidate = Regex.Replace(match.Value, @"[\s-]", string.Empty);

                if (IsValidStateCodePrefix(candidate))
                {
                    return candidate;
                }
            }

            return null;
        }

        private static bool IsValidStateCodePrefix(
            string value)
        {
            return value.Length >= 2 && IndianStateCodes.Contains(value[..2]);
        }
    }
}