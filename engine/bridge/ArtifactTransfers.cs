using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace TheOrg.Bridge;

/// <summary>
/// Recoverable bounded transfer sessions over Chrome Native Messaging.
/// sendNativeMessage launches a new host per request, so state is stored on disk.
/// Stored files remain untrusted, never opened or executed by this class.
/// </summary>
internal sealed class ArtifactTransfers
{
    internal const int MaximumBytes = 32 * 1024 * 1024;
    internal const int ChunkBytes = 128 * 1024;
    private static readonly Regex Company = new("^[a-z0-9_-]{1,40}$", RegexOptions.Compiled);
    private static readonly Regex Id = new("^[a-f0-9]{32}$", RegexOptions.Compiled);
    private readonly string _root;
    private readonly ArtifactStore _store;
    private static readonly JsonSerializerOptions Options = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        WriteIndented = false
    };

    internal ArtifactTransfers(string root, ArtifactStore store)
    {
        _root = Path.GetFullPath(root);
        _store = store;
    }

    private string DirectoryFor(string companyId, string orderId)
    {
        if (!Company.IsMatch(companyId) || !Id.IsMatch(orderId))
            throw new ArgumentException("Invalid tenant or order");
        var order = Path.Combine(_root, "companies", companyId, "orders", orderId);
        if (!File.Exists(Path.Combine(order, "order.json")))
            throw new ArgumentException("Unknown order");
        return Path.Combine(order, "uploads");
    }

    private static string PartPath(string directory, string uploadId) =>
        Path.Combine(directory, uploadId + ".part");

    private static string StatePath(string directory, string uploadId) =>
        Path.Combine(directory, uploadId + ".json");

    internal object Begin(string companyId, string orderId, string agentId,
        string fileName, long declaredBytes, string sha256, string provider, string sourceReference)
    {
        if (declaredBytes is < 1 or > MaximumBytes) throw new ArgumentException("File too large");
        if (!Regex.IsMatch(agentId, "^[a-z][a-z0-9_-]{0,39}$") ||
            fileName.Length > 120 || fileName.Contains('/') || fileName.Contains('\\') ||
            fileName.Contains("..") || !Regex.IsMatch(sha256, "^[a-fA-F0-9]{64}$"))
            throw new ArgumentException("Invalid upload metadata");
        if (provider.Length > 60 || sourceReference.Length > 500)
            throw new ArgumentException("Invalid provenance");
        var dir = DirectoryFor(companyId, orderId);
        Directory.CreateDirectory(dir);
        if (Directory.EnumerateFiles(dir, "*.json").Take(11).Count() >= 10)
            throw new ArgumentException("Too many pending uploads");
        var state = new TransferState
        {
            UploadId = Guid.NewGuid().ToString("N"),
            AccessToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)),
            CompanyId = companyId,
            OrderId = orderId,
            AgentId = agentId,
            FileName = fileName,
            SizeBytes = declaredBytes,
            ExpectedSha256 = sha256.ToUpperInvariant(),
            SourceProvider = provider,
            SourceReference = sourceReference,
            BytesReceived = 0, NextIndex = 0,
            ExpiresUtc = DateTimeOffset.UtcNow.AddHours(24).ToString("O")
        };
        var part = PartPath(dir, state.UploadId);
        using (File.Create(part)) { }
        try { Persist(dir, state); }
        catch { File.Delete(part); throw; }
        return new {
            uploadId = state.UploadId, accessToken = state.AccessToken,
            maxChunkBytes = ChunkBytes, maxFileBytes = MaximumBytes,
            expiresUtc = state.ExpiresUtc, bytesReceived = 0
        };
    }

    internal object Append(string companyId, string orderId, string uploadId,
        string token, int index, string chunkBase64)
    {
        var (dir, state) = Load(companyId, orderId, uploadId, token);
        if (index != state.NextIndex)
            throw new ArgumentException("Chunk index out of order; use upload_status to resume");
        if (string.IsNullOrWhiteSpace(chunkBase64) || chunkBase64.Length > 180000)
            throw new ArgumentException("Invalid chunk length");
        byte[] chunk;
        try { chunk = Convert.FromBase64String(chunkBase64); }
        catch (FormatException) { throw new ArgumentException("Invalid chunk encoding"); }
        if (chunk.Length is < 1 or > ChunkBytes ||
            state.BytesReceived + chunk.Length > state.SizeBytes)
            throw new ArgumentException("Invalid chunk size");

        using (var stream = new FileStream(PartPath(dir, uploadId),
            FileMode.Open, FileAccess.ReadWrite, FileShare.None))
        {
            // Recover from a crash after writing data but before saving the manifest.
            if (stream.Length < state.BytesReceived)
                throw new IOException("Partial file is shorter than confirmed bytes");
            if (stream.Length > state.BytesReceived)
                stream.SetLength(state.BytesReceived);
            stream.Position = state.BytesReceived;
            stream.Write(chunk);
            stream.Flush(true);
        }
        state.BytesReceived += chunk.Length;
        state.NextIndex++;
        Persist(dir, state);
        return new {
            uploadId, bytesReceived = state.BytesReceived,
            nextIndex = state.NextIndex, done = state.BytesReceived == state.SizeBytes
        };
    }

    internal object Status(string companyId, string orderId, string uploadId, string token)
    {
        var (dir, state) = Load(companyId, orderId, uploadId, token);
        var length = new FileInfo(PartPath(dir, uploadId)).Length;
        if (length < state.BytesReceived) throw new IOException("Upload state is corrupted");
        return new {
            uploadId, bytesReceived = state.BytesReceived, nextIndex = state.NextIndex,
            expectedBytes = state.SizeBytes, expiresUtc = state.ExpiresUtc
        };
    }

    internal object Complete(string companyId, string orderId, string uploadId, string token)
    {
        var (dir, state) = Load(companyId, orderId, uploadId, token);
        var part = PartPath(dir, uploadId);
        var length = new FileInfo(part).Length;
        if (state.BytesReceived != state.SizeBytes || length < state.SizeBytes)
            throw new ArgumentException("Upload has missing chunks");
        if (length > state.SizeBytes)
        {
            using var stream = new FileStream(part, FileMode.Open, FileAccess.Write, FileShare.None);
            stream.SetLength(state.SizeBytes);
        }
        ArtifactRecord record = _store.ImportStaged(companyId, orderId,
            state.AgentId, state.FileName, part,
            state.SourceProvider, state.SourceReference, state.ExpectedSha256);
        File.Delete(StatePath(dir, uploadId));
        return new { artifact = record, uploadId, state = "received_unverified" };
    }

    internal object Cancel(string companyId, string orderId, string uploadId, string token)
    {
        var (dir, _) = Load(companyId, orderId, uploadId, token);
        File.Delete(PartPath(dir, uploadId));
        File.Delete(StatePath(dir, uploadId));
        return new { uploadId, cancelled = true };
    }

    private (string, TransferState) Load(string companyId, string orderId,
        string uploadId, string token)
    {
        if (!Id.IsMatch(uploadId) || !Regex.IsMatch(token, "^[A-F0-9]{64}$"))
            throw new ArgumentException("Invalid upload credentials");
        string dir = DirectoryFor(companyId, orderId);
        string manifest = StatePath(dir, uploadId);
        if (!File.Exists(manifest))
            throw new ArgumentException("Upload not found");
        var state = JsonSerializer.Deserialize<TransferState>(
            File.ReadAllText(manifest), Options);
        if (state is null || state.UploadId != uploadId ||
            state.CompanyId != companyId || state.OrderId != orderId ||
            !CryptographicOperations.FixedTimeEquals(
                Encoding.ASCII.GetBytes(token), Encoding.ASCII.GetBytes(state.AccessToken)))
            throw new ArgumentException("Upload not found");
        if (DateTimeOffset.Parse(state.ExpiresUtc) < DateTimeOffset.UtcNow)
            throw new ArgumentException("Upload expired");
        return (dir, state);
    }

    private static void Persist(string folder, TransferState state)
    {
        string final = StatePath(folder, state.UploadId);
        string temp = final + ".tmp";
        File.WriteAllText(temp, JsonSerializer.Serialize(state, Options), Encoding.UTF8);
        File.Move(temp, final, overwrite: true);
    }
}

internal sealed class TransferState
{
    public string UploadId { get; set; } = "";
    public string AccessToken { get; set; } = "";
    public string CompanyId { get; set; } = "";
    public string OrderId { get; set; } = "";
    public string AgentId { get; set; } = "";
    public string FileName { get; set; } = "";
    public long SizeBytes { get; set; }
    public string ExpectedSha256 { get; set; } = "";
    public string SourceProvider { get; set; } = "";
    public string SourceReference { get; set; } = "";
    public long BytesReceived { get; set; }
    public int NextIndex { get; set; }
    public string ExpiresUtc { get; set; } = "";
}
