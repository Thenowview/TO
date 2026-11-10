using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace TheOrg.Bridge;

/// <summary>
/// Bounded, company-scoped intake for files the user explicitly imports from an AI chat.
/// It does not inspect a user's Chrome downloads folder or automatically access AI sessions.
/// All imported files are untrusted until independent content QA.
/// </summary>
internal sealed class ArtifactStore
{
    private const int MaxBytes = 250 * 1024; // Native Messaging v1: one bounded message
    private static readonly Regex SafeId = new("^[a-f0-9]{32}$", RegexOptions.Compiled);
    private static readonly Regex SafeCompany = new("^[a-z0-9_-]{1,40}$", RegexOptions.Compiled);
    private static readonly Regex SafeAgent = new("^[a-z][a-z0-9_-]{0,39}$", RegexOptions.Compiled);
    private static readonly Regex SafeFile = new("^[\\p{L}\\p{N}][\\p{L}\\p{N} ._()-]{0,119}$", RegexOptions.Compiled);
    private static readonly HashSet<string> AllowedTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        ".txt", ".md", ".json", ".csv", ".py", ".js", ".ts", ".css",
        ".html", ".xml", ".pdf", ".docx", ".xlsx", ".pptx",
        ".png", ".jpg", ".jpeg", ".webp", ".zip"
    };
    private readonly string _root;
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        WriteIndented = true
    };

    internal ArtifactStore(string workspaceRoot) => _root = Path.GetFullPath(workspaceRoot);

    private string Folder(string companyId, string orderId)
    {
        if (!SafeCompany.IsMatch(companyId) || !SafeId.IsMatch(orderId))
            throw new ArgumentException("Invalid company or order");
        string orderRoot = Path.Combine(_root, "companies", companyId, "orders", orderId);
        if (!File.Exists(Path.Combine(orderRoot, "order.json")))
            throw new ArgumentException("Order is not registered");
        return Path.Combine(orderRoot, "agent_artifacts");
    }

    private string MetadataPath(string folder, string artifactId)
    {
        if (!SafeId.IsMatch(artifactId)) throw new ArgumentException("Invalid artifact ID");
        return Path.Combine(folder, artifactId + ".json");
    }

    internal ArtifactRecord Import(string companyId, string orderId, string agentId,
        string fileName, string dataBase64, string provider, string sourceReference)
    {
        if (!SafeAgent.IsMatch(agentId)) throw new ArgumentException("Invalid agent ID");
        if (!SafeFile.IsMatch(fileName) || fileName.Contains("..", StringComparison.Ordinal) ||
            !AllowedTypes.Contains(Path.GetExtension(fileName)))
            throw new ArgumentException("Unsafe or unsupported file name");
        if (provider.Length > 60 || sourceReference.Length > 500 ||
            provider.Contains('\0') || sourceReference.Contains('\0'))
            throw new ArgumentException("Invalid provenance");

        string folder = Folder(companyId, orderId);
        if (string.IsNullOrWhiteSpace(dataBase64) || dataBase64.Length > 350_000)
            throw new ArgumentException("File must be 1–250 KiB for this import method");

        byte[] bytes;
        try { bytes = Convert.FromBase64String(dataBase64); }
        catch (FormatException) { throw new ArgumentException("Invalid base64 artifact"); }

        if (bytes.Length < 1 || bytes.Length > MaxBytes)
            throw new ArgumentException("Artifact outside allowed size");
        Directory.CreateDirectory(folder);
        var existing = ReadAll(folder);
        int version = existing.Where(a => a.AgentId == agentId &&
                a.FileName.Equals(fileName, StringComparison.OrdinalIgnoreCase))
            .Select(a => a.Version).DefaultIfEmpty(0).Max() + 1;

        string id = Guid.NewGuid().ToString("N");
        string target = Path.Combine(folder, id + ".blob");
        // Never use an untrusted filename as the storage path.
        using (var output = new FileStream(target, FileMode.CreateNew, FileAccess.Write, FileShare.None))
            output.Write(bytes);

        var record = new ArtifactRecord
        {
            ArtifactId = id, CompanyId = companyId, OrderId = orderId, AgentId = agentId,
            FileName = fileName, Version = version, Bytes = bytes.Length,
            Sha256 = Convert.ToHexString(SHA256.HashData(bytes)),
            CreatedUtc = DateTimeOffset.UtcNow.ToString("O"),
            SourceProvider = provider, SourceReference = sourceReference,
            IntakeStatus = "received_unverified", IntegrityValid = false
        };
        try
        {
            File.WriteAllText(MetadataPath(folder, id),
                JsonSerializer.Serialize(record, JsonOptions), Encoding.UTF8);
        }
        catch
        {
            File.Delete(target);
            throw;
        }
        return record;
    }


    // Persist a completed, verified staged upload without buffering the full file in Native Messaging.
    internal ArtifactRecord ImportStaged(string companyId, string orderId, string agentId,
        string fileName, string stagingPath, string provider, string sourceReference,
        string expectedSha256)
    {
        if (!SafeAgent.IsMatch(agentId) ||
            !SafeFile.IsMatch(fileName) || fileName.Contains("..", StringComparison.Ordinal) ||
            !AllowedTypes.Contains(Path.GetExtension(fileName)))
            throw new ArgumentException("Invalid agent or file name");
        if (provider.Length > 60 || sourceReference.Length > 500 ||
            provider.Contains('\0') || sourceReference.Contains('\0'))
            throw new ArgumentException("Invalid source metadata");
        if (!Regex.IsMatch(expectedSha256, "^[0-9a-fA-F]{64}$"))
            throw new ArgumentException("Invalid expected SHA-256");

        string folder = Folder(companyId, orderId);
        var staging = new FileInfo(stagingPath);
        if (!staging.Exists || staging.Length is < 1 or > 33554432)
            throw new ArgumentException("Incomplete or oversized staged artifact");
        string sha;
        using (var input = File.OpenRead(stagingPath))
            sha = Convert.ToHexString(SHA256.HashData(input));
        if (!sha.Equals(expectedSha256, StringComparison.OrdinalIgnoreCase))
            throw new ArgumentException("Staged file SHA-256 mismatch");

        Directory.CreateDirectory(folder);
        int version = ReadAll(folder).Where(a => a.AgentId == agentId &&
                a.FileName.Equals(fileName, StringComparison.OrdinalIgnoreCase))
            .Select(a => a.Version).DefaultIfEmpty(0).Max() + 1;
        string id = Guid.NewGuid().ToString("N");
        string blob = Path.Combine(folder, id + ".blob");
        File.Move(stagingPath, blob);
        var record = new ArtifactRecord
        {
            ArtifactId = id, CompanyId = companyId, OrderId = orderId, AgentId = agentId,
            FileName = fileName, Version = version, Bytes = checked((int)staging.Length),
            Sha256 = sha, CreatedUtc = DateTimeOffset.UtcNow.ToString("O"),
            SourceProvider = provider, SourceReference = sourceReference,
            IntakeStatus = "received_unverified", IntegrityValid = false
        };
        try
        {
            File.WriteAllText(MetadataPath(folder, id),
                JsonSerializer.Serialize(record, JsonOptions), Encoding.UTF8);
        }
        catch
        {
            File.Delete(blob);
            throw;
        }
        return record;
    }

    internal object ReadChunk(string companyId, string orderId, string artifactId,
        long offset, int chunkSize)
    {
        if (chunkSize is < 1 or > 131072 || offset < 0)
            throw new ArgumentException("Invalid read range");
        string folder = Folder(companyId, orderId);
        var record = Load(folder, artifactId, companyId, orderId);
        string path = Path.Combine(folder, artifactId + ".blob");
        using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
        if (stream.Length != record.Bytes || offset > stream.Length)
            throw new ArgumentException("Artifact size does not match metadata");
        if (offset == 0 && !Verify(companyId, orderId, artifactId).IntegrityValid)
            throw new ArgumentException("Artifact hash verification failed");
        stream.Position = offset;
        byte[] bytes = new byte[Math.Min(chunkSize, checked((int)(stream.Length - offset)))];
        stream.ReadExactly(bytes);
        return new {
            artifactId, fileName = record.FileName, record.Sha256,
            offset, totalBytes = record.Bytes, dataBase64 = Convert.ToBase64String(bytes),
            done = (offset + bytes.Length == stream.Length),
            contentApproved = false
        };
    }

    internal ArtifactRecord[] List(string companyId, string orderId)
    {
        string folder = Folder(companyId, orderId);
        if (!Directory.Exists(folder)) return Array.Empty<ArtifactRecord>();
        return ReadAll(folder)
            .OrderByDescending(item => item.CreatedUtc)
            .Take(200).ToArray();
    }

    internal ArtifactRecord Verify(string companyId, string orderId, string artifactId)
    {
        string folder = Folder(companyId, orderId);
        var record = Load(folder, artifactId, companyId, orderId);
        string blob = Path.Combine(folder, artifactId + ".blob");
        bool valid = File.Exists(blob);
        if (valid)
        {
            byte[] bytes = File.ReadAllBytes(blob);
            valid = bytes.Length == record.Bytes &&
                CryptographicOperations.FixedTimeEquals(
                    SHA256.HashData(bytes), Convert.FromHexString(record.Sha256));
        }
        record.IntegrityValid = valid;
        record.LastIntegrityCheckUtc = DateTimeOffset.UtcNow.ToString("O");
        var structural = valid
            ? ArtifactInspection.Inspect(blob, record.FileName)
            : new InspectionResult(false, "integrity_failed");
        record.FormatValid = structural.Valid;
        record.StructuralReview = structural.Code;
        record.IntakeStatus = !valid ? "integrity_failed" :
            !structural.Valid ? "format_invalid" :
            "structure_verified_content_qa_pending";
        File.WriteAllText(MetadataPath(folder, artifactId),
            JsonSerializer.Serialize(record, JsonOptions), Encoding.UTF8);
        return record;
    }

    // Strictly plain-text, bounded, read-only preview for independent artifact QA.
    // Never render as HTML, Markdown or execute content. Does not certify safety.
    internal object PreviewText(string companyId, string orderId, string artifactId)
    {
        string folder = Folder(companyId, orderId);
        var record = Load(folder, artifactId, companyId, orderId);
        string extension = Path.GetExtension(record.FileName).ToLowerInvariant();
        if (extension is not (".txt" or ".md" or ".json" or ".csv"))
            throw new ArgumentException("Preview is limited to plain-text file types");
        if (record.Bytes is < 1 or > 32768)
            throw new ArgumentException("Preview text file exceeds 32 KiB limit");

        record = Verify(companyId, orderId, artifactId);
        if (!record.IntegrityValid || !record.FormatValid)
            throw new ArgumentException("File failed integrity or structural verification");

        string source = Path.Combine(folder, artifactId + ".blob");
        byte[] bytes = File.ReadAllBytes(source);
        if (bytes.Length != record.Bytes ||
            !CryptographicOperations.FixedTimeEquals(
                SHA256.HashData(bytes), Convert.FromHexString(record.Sha256)))
            throw new ArgumentException("Preview content changed after verification");
        string content = new UTF8Encoding(false, true).GetString(bytes);
        if (content.Contains('\0')) throw new ArgumentException("Unsafe text preview");
        bool truncated = content.Length > 8000;
        return new
        {
            artifactId = record.ArtifactId, fileName = record.FileName,
            text = truncated ? content[..8000] : content, truncated,
            renderMode = "textContent_only", contentApproved = false,
            malwareScanStatus = record.MalwareScanStatus,
            note = "Safe plain-text display only; untrusted content. No independent QA or malware scan completed."
        };
    }

    internal object Read(string companyId, string orderId, string artifactId)
    {
        string folder = Folder(companyId, orderId);
        ArtifactRecord record = Verify(companyId, orderId, artifactId);
        if (!record.IntegrityValid)
            throw new ArgumentException("Artifact integrity validation failed");

        byte[] bytes = File.ReadAllBytes(Path.Combine(folder, artifactId + ".blob"));
        return new { artifact = record, dataBase64 = Convert.ToBase64String(bytes),
            note = "File was integrity-verified; contents were NOT independently approved." };
    }

    private ArtifactRecord Load(string folder, string artifactId, string companyId, string orderId)
    {
        string path = MetadataPath(folder, artifactId);
        if (!File.Exists(path)) throw new ArgumentException("Artifact not found");
        ArtifactRecord? r = JsonSerializer.Deserialize<ArtifactRecord>(
            File.ReadAllText(path), JsonOptions);
        if (r is null || r.ArtifactId != artifactId || r.CompanyId != companyId ||
            r.OrderId != orderId) throw new ArgumentException("Artifact identity mismatch");
        return r;
    }

    private static List<ArtifactRecord> ReadAll(string folder)
    {
        var output = new List<ArtifactRecord>();
        if (!Directory.Exists(folder)) return output;
        foreach (string path in Directory.EnumerateFiles(folder, "*.json").Take(1001))
        {
            if (!SafeId.IsMatch(Path.GetFileNameWithoutExtension(path))) continue;
            try
            {
                ArtifactRecord? record = JsonSerializer.Deserialize<ArtifactRecord>(
                    File.ReadAllText(path), JsonOptions);
                if (record is not null &&
                    record.ArtifactId == Path.GetFileNameWithoutExtension(path))
                    output.Add(record);
            }
            catch (JsonException) { /* Broken metadata is not treated as a valid file. */ }
        }
        return output;
    }
}

internal sealed class ArtifactRecord
{
    public string ArtifactId { get; set; } = "";
    public string CompanyId { get; set; } = "";
    public string OrderId { get; set; } = "";
    public string AgentId { get; set; } = "";
    public string FileName { get; set; } = "";
    public int Version { get; set; }
    public int Bytes { get; set; }
    public string Sha256 { get; set; } = "";
    public string CreatedUtc { get; set; } = "";
    public string SourceProvider { get; set; } = "";
    public string SourceReference { get; set; } = "";
    public string IntakeStatus { get; set; } = "";
    public bool IntegrityValid { get; set; }
    public bool FormatValid { get; set; }
    public string StructuralReview { get; set; } = "not_inspected";
    public string MalwareScanStatus { get; set; } = "not_scanned";
    public string ContentQaStatus { get; set; } = "pending_independent_review";
    public string LastIntegrityCheckUtc { get; set; } = "";
}
