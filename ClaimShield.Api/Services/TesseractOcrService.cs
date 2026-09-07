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
    // fixed Indian plate format). Owner-name/chassis-number extraction
    // are best-effort line heuristics over free-form RC layouts - there
    // is no structured RC template to key off, so these two fields are
    // genuinely lower-confidence than the registration number by
    // design, not by omission.
    //
    // License number/DOB/validity extraction (added for the staff
    // Register Claim flow's driving-license upload) follows the same
    // philosophy - there is no single fixed DL number format across
    // Indian states (unlike the vehicle plate format), so
    // LicenseNumberPattern is deliberately permissive rather than
    // exact, and DOB/validity are found via the same labeled-line
    // heuristic already used for owner name, just matched against a
    // date shape instead of "everything after the colon".
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

        // e.g. "TN37 20230001234", "TN-37/2023/0001234", "TN3720230001234"
        // - state code, RTO code, issuing year, serial, with optional
        // separators throughout since layouts vary by state/printer.
        private static readonly Regex LicenseNumberPattern =
            new(
                @"[A-Z]{2}[\s-]?[0-9]{2}[\s/-]?(?:19|20)[0-9]{2}[\s/-]?[0-9]{6,7}",
                RegexOptions.Compiled);

        // DD-MM-YYYY, DD/MM/YYYY, or DD-MON-YYYY (e.g. 15-Aug-1990) -
        // deliberately permissive on the separator and month token
        // since OCR output for punctuation is unreliable.
        private static readonly Regex DatePattern =
            new(
                @"\b[0-9]{1,2}[\s./-][A-Za-z0-9]{1,4}[\s./-][0-9]{2,4}\b",
                RegexOptions.Compiled);

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
                    LicenseNumber = ExtractLicenseNumber(rawText),
                    DateOfBirth =
                        ExtractLabeledDate(
                            rawText,
                            new[] { "DOB", "D.O.B", "Date of Birth", "Birth" }),
                    ValidUntil =
                        ExtractLabeledDate(
                            rawText,
                            new[]
                            {
                                "Valid Till", "Valid Upto", "Valid Up to", "Validity", "Valid",
                                // OCR frequently misreads "Validity" (e.g. as "Vahaity")
                                // on real license photos - "Date of issue" is the
                                // adjacent label on the same printed row and reads
                                // reliably, so it doubles as a fallback anchor.
                                // preferLastMatch below picks the later of the two
                                // dates that then appear on the value line (issue
                                // date, then validity date), rather than the earlier
                                // issue date.
                                "Date of issue",
                            },
                            preferLastMatch: true),
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

        // Two strategies, tried in order:
        //
        // 1. RC-style "Owner: X" / "Name: X" colon-value line (the
        //    original heuristic, still the primary path for RC
        //    documents).
        // 2. License-style fallback - Indian driving licenses commonly
        //    print the holder's own name on its own line with no
        //    label at all, immediately above a "Father's Name" (or
        //    S/O, D/O, W/O) line. When strategy 1 finds nothing, the
        //    non-blank line right before the first such relation
        //    label is taken as the name instead.
        private static readonly string[] RelationToGuardianLabels =
        {
            "Father's Name", "S/O", "D/O", "W/O", "Son of", "Daughter of", "Wife of"
        };

        private static string? ExtractOwnerName(
            string rawText)
        {
            var lines = rawText.Split('\n');

            foreach (var line in lines)
            {
                var trimmed = line.Trim();

                if (trimmed.StartsWith("Owner", StringComparison.OrdinalIgnoreCase) ||
                    trimmed.StartsWith("Name", StringComparison.OrdinalIgnoreCase))
                {
                    var colonIndex = trimmed.IndexOf(':');

                    if (colonIndex >= 0 && colonIndex < trimmed.Length - 1)
                    {
                        var value = trimmed[(colonIndex + 1)..].Trim();

                        if (!string.IsNullOrWhiteSpace(value))
                        {
                            return value;
                        }
                    }
                }
            }

            for (var i = 0; i < lines.Length; i++)
            {
                var trimmed = lines[i].Trim();

                var isRelationLabel =
                    RelationToGuardianLabels.Any(
                        label =>
                            trimmed.StartsWith(
                                label,
                                StringComparison.OrdinalIgnoreCase));

                if (!isRelationLabel)
                {
                    continue;
                }

                for (var j = i - 1; j >= 0; j--)
                {
                    var candidate = lines[j].Trim();

                    if (candidate.Length == 0)
                    {
                        continue;
                    }

                    return candidate;
                }
            }

            return null;
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

        private static string? ExtractLicenseNumber(
            string rawText)
        {
            var match = LicenseNumberPattern.Match(rawText.ToUpperInvariant());

            if (!match.Success)
            {
                return null;
            }

            return Regex.Replace(match.Value, @"[\s/-]", string.Empty);
        }

        // Looks for a line starting with any of the given labels (e.g.
        // "DOB", "Valid Till"), then searches that same line for a
        // date-shaped substring - not just "everything after the
        // colon" like ExtractOwnerName, since a date needs to actually
        // look like a date rather than picking up trailing OCR noise.
        // Checks the label's own line first, then falls back to the
        // next line down - many real ID layouts print a row of labels
        // (e.g. "Date of Birth   Blood Group") with the actual values
        // on the following row, not inline after each label the way
        // ExtractOwnerName's "Name: John" style assumes. When
        // preferLastMatch is set, and a line has more than one date on
        // it (e.g. "Date of issue   Validity" printed as one combined
        // label with both dates below it), the later date is taken -
        // used for validity/expiry, where the issue date would
        // otherwise be picked up by mistake as it comes first.
        private static string? ExtractLabeledDate(
            string rawText,
            string[] labels,
            bool preferLastMatch = false)
        {
            var lines = rawText.Split('\n');

            for (var i = 0; i < lines.Length; i++)
            {
                var trimmed = lines[i].Trim();

                var matchesLabel =
                    labels.Any(
                        label =>
                            trimmed.StartsWith(
                                label,
                                StringComparison.OrdinalIgnoreCase));

                if (!matchesLabel)
                {
                    continue;
                }

                var sameLineDate =
                    TryGetDateFromLine(trimmed, preferLastMatch);

                if (sameLineDate != null)
                {
                    return sameLineDate;
                }

                if (i + 1 < lines.Length)
                {
                    var nextLineDate =
                        TryGetDateFromLine(lines[i + 1].Trim(), preferLastMatch);

                    if (nextLineDate != null)
                    {
                        return nextLineDate;
                    }
                }
            }

            return null;
        }

        private static string? TryGetDateFromLine(
            string line,
            bool preferLastMatch)
        {
            var matches = DatePattern.Matches(line);

            if (matches.Count == 0)
            {
                return null;
            }

            var chosen =
                preferLastMatch
                    ? matches[^1]
                    : matches[0];

            return chosen.Value.Trim();
        }
    }
}