using System.IO.Compression;
using System.Text;
using System.Text.Json;

namespace TheOrg.Bridge;

/// <summary>
/// Bounded *structural* checks only. Does not run content, scan for malware,
/// prove AI provenance, or establish substantive task correctness.
/// </summary>
internal static class ArtifactInspection
{
    private const long MaxExtractedSize = 512L * 1024 * 1024;
    internal static InspectionResult Inspect(string path, string name)
    {
        string ext = Path.GetExtension(name).ToLowerInvariant();
        try
        {
            switch (ext)
            {
                case ".gaiz":
                case ".gize":
                    // Deliberately structural only; signature and tenant authorization
                    // require a trusted verifier and cannot be inferred from the magic bytes.
                    using (var stream = File.OpenRead(path))
                    {
                        if (stream.Length < 16 || stream.Length > 8 * 1024 * 1024)
                            return new(false, "gaiz_size_invalid");
                        byte[] header = new byte[6];
                        stream.ReadExactly(header);
                        string magic = Encoding.ASCII.GetString(header);
                        if (magic != "GAIZ1\n" && magic != "GAIZ2\n")
                            return new(false, "gaiz_magic_invalid");
                        // Minimal bounded JSON-shape check only; cryptographic verification
                        // MUST be performed by a separately trusted GAIZ verifier.
                        using var envelope = JsonDocument.Parse(stream, new JsonDocumentOptions
                        {
                            MaxDepth = 24,
                            AllowTrailingCommas = false,
                            CommentHandling = JsonCommentHandling.Disallow
                        });
                        var root = envelope.RootElement;
                        if (root.ValueKind != JsonValueKind.Object ||
                            !root.TryGetProperty("manifest", out var manifest) ||
                            manifest.ValueKind != JsonValueKind.Object ||
                            !root.TryGetProperty("signature", out var signature) ||
                            signature.ValueKind != JsonValueKind.String ||
                            !root.TryGetProperty("ciphertext", out var ciphertext) ||
                            ciphertext.ValueKind != JsonValueKind.String)
                            return new(false, "gaiz_envelope_shape_invalid");
                        // Preserve the untrusted status: format checks do not approve content.
                        return new(true, "gaiz_structure_only_unverified_signature");
                    }
                case ".png":
                    using (var stream = File.OpenRead(path))
                    {
                        byte[] header = new byte[8];
                        if (stream.Length < 24 || stream.Read(header) != 8 ||
                            !header.AsSpan().SequenceEqual(new byte[] {137,80,78,71,13,10,26,10}))
                            return new(false, "invalid_png_signature");
                        byte[] sizeAndTag = new byte[8];
                        stream.ReadExactly(sizeAndTag);
                        return sizeAndTag.AsSpan(0,4).SequenceEqual(new byte[] {0,0,0,13}) &&
                            Encoding.ASCII.GetString(sizeAndTag,4,4) == "IHDR"
                            ? new(true, "png_signature_and_header_only")
                            : new(false, "invalid_png_header");
                    }
                case ".jpg":
                case ".jpeg":
                    using (var stream = File.OpenRead(path))
                    {
                        if (stream.Length < 4) return new(false,"jpeg_too_short");
                        int a = stream.ReadByte(), b = stream.ReadByte();
                        return a == 0xFF && b == 0xD8
                            ? new(true,"jpeg_signature_only")
                            : new(false,"invalid_jpeg_signature");
                    }
                case ".webp":
                    using (var stream = File.OpenRead(path))
                    {
                        byte[] header = new byte[12];
                        if (stream.Length < 12 || stream.Read(header) != 12)
                            return new(false,"webp_too_short");
                        return Encoding.ASCII.GetString(header,0,4) == "RIFF" &&
                            Encoding.ASCII.GetString(header,8,4) == "WEBP"
                            ? new(true,"webp_signature_only")
                            : new(false,"invalid_webp_signature");
                    }
                case ".pdf":
                    using (var stream = File.OpenRead(path))
                    {
                        if (stream.Length < 12) return new(false,"pdf_too_short");
                        byte[] header = new byte[5];
                        stream.ReadExactly(header);
                        if (Encoding.ASCII.GetString(header)!="%PDF-")
                            return new(false,"invalid_pdf_header");
                        stream.Seek(Math.Max(0,stream.Length-4096),SeekOrigin.Begin);
                        byte[] footer = new byte[(int)(stream.Length-stream.Position)];
                        stream.ReadExactly(footer);
                        return Encoding.Latin1.GetString(footer).Contains("%%EOF",StringComparison.Ordinal)
                            ? new(true,"pdf_header_and_eof_only")
                            : new(false,"missing_pdf_eof");
                    }
                case ".zip":
                case ".docx":
                case ".xlsx":
                case ".pptx":
                    return InspectArchive(path,ext);
                case ".txt":
                case ".md":
                case ".json":
                case ".csv":
                case ".py":
                case ".js":
                case ".ts":
                case ".css":
                case ".html":
                case ".xml":
                    byte[] bytes = File.ReadAllBytes(path);
                    string decoded = new UTF8Encoding(false,true).GetString(bytes);
                    if (decoded.Contains('\0'))
                        return new(false,"text_contains_nul");
                    if (ext == ".json")
                    {
                        using var json = JsonDocument.Parse(decoded);
                        return new(true,"valid_json_structure");
                    }
                    return new(true,"valid_utf8_text_only");
                default:
                    return new(false,"unsupported_extension");
            }
        }
        catch (InvalidDataException) { return new(false,"malformed_container_or_text"); }
        catch (DecoderFallbackException) { return new(false,"invalid_utf8"); }
        catch (JsonException) { return new(false,"invalid_json"); }
        catch (EndOfStreamException) { return new(false,"truncated_file"); }
        catch (IOException) { return new(false,"file_read_error"); }
    }

    private static InspectionResult InspectArchive(string path,string extension)
    {
        using var zip = ZipFile.OpenRead(path);
        if (zip.Entries.Count is < 1 or > 5000)
            return new(false,"archive_entry_count_out_of_bounds");
        long total = 0;
        bool contentTypes = false, expectedPart = false;
        string requiredPart = extension switch
        {
            ".docx" => "word/document.xml",
            ".xlsx" => "xl/workbook.xml",
            ".pptx" => "ppt/presentation.xml",
            _ => ""
        };
        foreach(var entry in zip.Entries)
        {
            if (entry.FullName.StartsWith("/",StringComparison.Ordinal) ||
                entry.FullName.Replace('\\','/').Split('/').Contains(".."))
                return new(false,"archive_has_unsafe_entry_path");
            if (entry.FullName.EndsWith("vbaProject.bin",StringComparison.OrdinalIgnoreCase))
                return new(false,"archive_contains_macro_payload");
            total += entry.Length;
            if (total > MaxExtractedSize)
                return new(false,"archive_expansion_limit_exceeded");
            if (entry.Length > 10_000_000 && entry.CompressedLength < entry.Length/1000)
                return new(false,"possible_zip_bomb");
            if (entry.FullName=="[Content_Types].xml") contentTypes=true;
            if (entry.FullName==requiredPart) expectedPart=true;
        }
        if ((extension is ".docx" or ".xlsx" or ".pptx") &&
            (!contentTypes || !expectedPart))
            return new(false,"office_container_missing_required_parts");
        return new(true,"archive_structure_only_not_malware_scanned");
    }
}

internal readonly record struct InspectionResult(bool Valid,string Code);
