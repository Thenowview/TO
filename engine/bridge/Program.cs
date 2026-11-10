using System.Buffers.Binary;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace TheOrg.Bridge;

internal static class Program
{
    private const int MaxNativeMessageBytes = 1024 * 1024;
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        WriteIndented = false
    };

    private static int Main(string[] args)
    {
        if (args.Contains("--self-test", StringComparer.Ordinal))
            return SelfTest.Run();

        var dataRoot = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "TheOrg", "workspace");
        var controller = new Controller(dataRoot);

        using Stream input = Console.OpenStandardInput();
        using Stream output = Console.OpenStandardOutput();
        var header = new byte[4];

        while (ReadExactlyOrEof(input, header))
        {
            int payloadLength = BinaryPrimitives.ReadInt32LittleEndian(header);
            if (payloadLength <= 0 || payloadLength > MaxNativeMessageBytes)
            {
                Console.Error.WriteLine("Invalid Native Messaging message length");
                return 2;
            }

            var payload = new byte[payloadLength];
            try
            {
                input.ReadExactly(payload);
                using var request = JsonDocument.Parse(payload);
                var response = controller.Execute(request.RootElement);
                WriteResponse(output, response);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"Request rejected: {ex.GetType().Name}");
                WriteResponse(output, new { ok = false, error = "invalid_or_failed_request" });
            }
        }
        return 0;
    }

    private static bool ReadExactlyOrEof(Stream input, byte[] header)
    {
        int total = 0;
        while (total < header.Length)
        {
            int count = input.Read(header, total, header.Length - total);
            if (count == 0)
            {
                if (total != 0) throw new EndOfStreamException("Partial frame header");
                return false;
            }
            total += count;
        }
        return true;
    }

    private static void WriteResponse(Stream output, object reply)
    {
        byte[] data = JsonSerializer.SerializeToUtf8Bytes(reply, JsonOptions);
        if (data.Length > MaxNativeMessageBytes)
            data = JsonSerializer.SerializeToUtf8Bytes(
                new { ok = false, error = "response_too_large" }, JsonOptions);

        byte[] length = new byte[4];
        BinaryPrimitives.WriteInt32LittleEndian(length, data.Length);
        output.Write(length);
        output.Write(data);
        output.Flush();
    }
}

internal sealed class Controller
{
    private static readonly Regex SafeCompany = new("^[a-z0-9_-]{1,40}$", RegexOptions.Compiled);
    private static readonly Regex SafeOrder = new("^[a-f0-9]{32}$", RegexOptions.Compiled);
    private readonly string _root;
    private readonly ArtifactStore _artifactStore;
    private readonly ArtifactTransfers _transfers;
    private static readonly JsonSerializerOptions Options = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        WriteIndented = true
    };

    internal Controller(string root)
    {
        _root = Path.GetFullPath(root);
        Directory.CreateDirectory(_root);
        _artifactStore = new ArtifactStore(_root);
        _transfers = new ArtifactTransfers(_root, _artifactStore);
    }

    internal object Execute(JsonElement request)
    {
        if (request.ValueKind != JsonValueKind.Object)
            return Fail("invalid_request");

        string command = Text(request, "command");
        try
        {
            return command switch
            {
                "ping" => new
                {
                    ok = true, engine = "TheOrg.Bridge", protocolVersion = 1,
                    mode = "offline-deterministic-demo",
                    dataRoot = _root
                },
                "capabilities" => new
                {
                    ok = true,
                    commands = new[] { "ping", "capabilities", "submit_order", "get_order", "list_orders",
                        "import_artifact", "list_artifacts", "verify_artifact", "read_artifact", "preview_text_artifact",
                        "begin_artifact_upload", "append_artifact_chunk", "upload_status",
                        "complete_artifact_upload", "cancel_artifact_upload", "read_artifact_chunk" },
                    maxArtifactImportBytes = 256000,
                    importedArtifactsRequireContentQa = true,
                    liveAiProvider = false,
                    chromeDesktopAutomation = false,
                    offlineFiles = true
                },
                "submit_order" => Submit(request),
                "get_order" => Get(request),
                "list_orders" => List(request),
                "import_artifact" => ImportArtifact(request),
                "list_artifacts" => ListArtifacts(request),
                "verify_artifact" => VerifyArtifact(request),
                "read_artifact" => ReadArtifact(request),
                "preview_text_artifact" => PreviewTextArtifact(request),
                "begin_artifact_upload" => BeginArtifactUpload(request),
                "append_artifact_chunk" => AppendArtifactChunk(request),
                "upload_status" => UploadStatus(request),
                "complete_artifact_upload" => CompleteArtifactUpload(request),
                "cancel_artifact_upload" => CancelArtifactUpload(request),
                "read_artifact_chunk" => ReadArtifactChunk(request),
                _ => Fail("unsupported_command")
            };
        }
        catch (ArgumentException) { return Fail("invalid_input"); }
        catch (FormatException) { return Fail("invalid_artifact_metadata"); }
        catch (IOException) { return Fail("storage_error"); }
        catch (UnauthorizedAccessException) { return Fail("access_denied"); }
        catch (JsonException) { return Fail("invalid_stored_record"); }
    }

    private object ImportArtifact(JsonElement request)
    {
        string companyId = RequireCompany(Text(request, "companyId"));
        string orderId = RequireOrder(Text(request, "orderId"));
        var record = _artifactStore.Import(companyId, orderId, Text(request, "agentId"),
            Text(request, "fileName"), Text(request, "dataBase64"),
            Text(request, "sourceProvider"), Text(request, "sourceReference"));
        return new { ok = true, artifact = record };
    }

    private object ListArtifacts(JsonElement request)
    {
        string companyId = RequireCompany(Text(request, "companyId"));
        string orderId = RequireOrder(Text(request, "orderId"));
        return new { ok = true, artifacts = _artifactStore.List(companyId, orderId) };
    }

    private object VerifyArtifact(JsonElement request)
    {
        string companyId = RequireCompany(Text(request, "companyId"));
        string orderId = RequireOrder(Text(request, "orderId"));
        var record = _artifactStore.Verify(companyId, orderId, Text(request, "artifactId"));
        return new { ok = true, artifact = record };
    }

    private object PreviewTextArtifact(JsonElement request)
    {
        string companyId = RequireCompany(Text(request, "companyId"));
        string orderId = RequireOrder(Text(request, "orderId"));
        var preview = _artifactStore.PreviewText(companyId, orderId, Text(request, "artifactId"));
        return new { ok = true, preview };
    }

    private object ReadArtifact(JsonElement request)
    {
        string companyId = RequireCompany(Text(request, "companyId"));
        string orderId = RequireOrder(Text(request, "orderId"));
        var content = _artifactStore.Read(companyId, orderId, Text(request, "artifactId"));
        return new { ok = true, content };
    }

    private object BeginArtifactUpload(JsonElement request)
    {
        string companyId = RequireCompany(Text(request, "companyId"));
        string orderId = RequireOrder(Text(request, "orderId"));
        long declared = Number(request, "totalBytes");
        var transfer = _transfers.Begin(companyId, orderId,
            Text(request, "agentId"), Text(request, "fileName"), declared,
            Text(request, "sha256"), Text(request, "sourceProvider"),
            Text(request, "sourceReference"));
        return new { ok = true, transfer };
    }

    private object AppendArtifactChunk(JsonElement request)
    {
        var result = _transfers.Append(
            RequireCompany(Text(request, "companyId")),
            RequireOrder(Text(request, "orderId")),
            Text(request, "uploadId"), Text(request, "accessToken"),
            checked((int)Number(request, "index")), Text(request, "dataBase64"));
        return new { ok = true, result };
    }

    private object UploadStatus(JsonElement request)
    {
        var result = _transfers.Status(
            RequireCompany(Text(request, "companyId")),
            RequireOrder(Text(request, "orderId")),
            Text(request, "uploadId"), Text(request, "accessToken"));
        return new { ok = true, result };
    }

    private object CompleteArtifactUpload(JsonElement request)
    {
        var result = _transfers.Complete(
            RequireCompany(Text(request, "companyId")),
            RequireOrder(Text(request, "orderId")),
            Text(request, "uploadId"), Text(request, "accessToken"));
        return new { ok = true, result };
    }

    private object CancelArtifactUpload(JsonElement request)
    {
        var result = _transfers.Cancel(
            RequireCompany(Text(request, "companyId")),
            RequireOrder(Text(request, "orderId")),
            Text(request, "uploadId"), Text(request, "accessToken"));
        return new { ok = true, result };
    }

    private object ReadArtifactChunk(JsonElement request)
    {
        var result = _artifactStore.ReadChunk(
            RequireCompany(Text(request, "companyId")),
            RequireOrder(Text(request, "orderId")),
            Text(request, "artifactId"), Number(request, "offset"),
            checked((int)Number(request, "chunkBytes")));
        return new { ok = true, result };
    }

    private static long Number(JsonElement request, string name) =>
        request.TryGetProperty(name, out var value) &&
        value.ValueKind == JsonValueKind.Number &&
        value.TryGetInt64(out long result) ? result :
        throw new ArgumentException("Invalid numeric argument");

    private object Submit(JsonElement request)
    {
        string companyId = RequireCompany(Text(request, "companyId"));
        string instruction = Text(request, "instruction").Trim();
        if (instruction.Length is < 5 or > 5000 || instruction.IndexOf('\0') >= 0)
            return Fail("instruction_length_or_format");

        string id = Guid.NewGuid().ToString("N");
        string folder = OrderFolder(companyId, id);
        Directory.CreateDirectory(folder);
        var order = new WorkOrder
        {
            OrderId = id,
            CompanyId = companyId,
            Instruction = instruction,
            CreatedUtc = DateTimeOffset.UtcNow.ToString("O"),
            Status = "local_demo_verified",
            AiMode = "deterministic_demo_no_external_provider",
            Agents = new List<string> { "Planner", "Draft Specialist", "Integrity Reviewer" }
        };

        string safeInstruction = instruction.Replace("\r", " ").Replace("\n", " ");
        WriteArtifact(order, folder, "plan.md",
            $"# TheOrg local demonstration plan\n\nOwner order: {safeInstruction}\n\n" +
            "1. Planner: break the request into a bounded local exercise.\n" +
            "2. Draft Specialist: write a draft to the company workspace.\n" +
            "3. Integrity Reviewer: reopen files and verify SHA-256 and non-empty contents.\n\n" +
            "**No external AI, browser actions or business execution were performed.**\n");

        WriteArtifact(order, folder, "work-product.md",
            $"# TheOrg draft work product — local demonstration\n\n" +
            $"**Owner instruction:** {safeInstruction}\n\n" +
            "## Output\n\nThis is a locally produced workflow proof, not a completed AI research " +
            "or real-world execution of the instruction. A human or approved live model " +
            "must supply substantive task-specific work.\n\n" +
            "## Agent handoffs\n\n- Planner: prepared the local task plan.\n" +
            "- Draft Specialist: wrote this file.\n" +
            "- Integrity Reviewer: verified the recorded file bytes.\n");

        bool verified = order.Artifacts.All(a =>
        {
            byte[] data = File.ReadAllBytes(Path.Combine(folder, a.FileName));
            return data.Length > 0
                && data.Length == a.Bytes
                && Convert.ToHexString(SHA256.HashData(data)).Equals(a.Sha256, StringComparison.Ordinal);
        });
        order.IntegrityVerified = verified;
        order.Review = verified
            ? "File existence, non-empty content and SHA-256 verified; semantic quality NOT verified."
            : "Artifact integrity failed.";
        order.Status = verified ? "local_demo_verified" : "integrity_failed";

        var recordFile = Path.Combine(folder, "order.json");
        File.WriteAllText(recordFile, JsonSerializer.Serialize(order, Options), Encoding.UTF8);
        File.WriteAllText(Path.Combine(folder, "audit.json"), JsonSerializer.Serialize(new
        {
            orderId = id, order.CreatedUtc, order.AiMode, order.Agents,
            artifactChecksums = order.Artifacts, order.IntegrityVerified,
            note = "No external model, desktop control, login or network operation occurred."
        }, Options), Encoding.UTF8);

        return new { ok = true, order };
    }

    private object Get(JsonElement request)
    {
        string companyId = RequireCompany(Text(request, "companyId"));
        string orderId = RequireOrder(Text(request, "orderId"));
        string folder = OrderFolder(companyId, orderId);
        string path = Path.Combine(folder, "order.json");
        if (!File.Exists(path)) return Fail("order_not_found");
        var order = JsonSerializer.Deserialize<WorkOrder>(File.ReadAllText(path), Options);
        if (order is null || order.CompanyId != companyId || order.OrderId != orderId)
            return Fail("order_not_found");
        string previewPath = Path.Combine(folder, "work-product.md");
        string preview = "";
        if (File.Exists(previewPath))
        {
            string draft = File.ReadAllText(previewPath);
            preview = draft[..Math.Min(16000, draft.Length)];
        }
        return new { ok = true, order, preview };
    }

    private object List(JsonElement request)
    {
        string companyId = RequireCompany(Text(request, "companyId"));
        string companyFolder = Path.Combine(_root, "companies", companyId, "orders");
        if (!Directory.Exists(companyFolder))
            return new { ok = true, orders = Array.Empty<WorkOrder>() };

        var records = Directory.EnumerateFiles(companyFolder, "order.json", SearchOption.AllDirectories)
            .Take(101)
            .Select(path =>
            {
                try { return JsonSerializer.Deserialize<WorkOrder>(File.ReadAllText(path), Options); }
                catch { return null; }
            })
            .Where(order => order != null && order.CompanyId == companyId)
            .OrderByDescending(order => order!.CreatedUtc)
            .Take(100)
            .ToArray();

        return new { ok = true, orders = records };
    }

    private void WriteArtifact(WorkOrder order, string folder, string fileName, string text)
    {
        string path = Path.Combine(folder, fileName);
        byte[] bytes = Encoding.UTF8.GetBytes(text);
        File.WriteAllBytes(path, bytes);
        order.Artifacts.Add(new Artifact
        {
            FileName = fileName,
            Bytes = bytes.Length,
            Sha256 = Convert.ToHexString(SHA256.HashData(bytes))
        });
    }

    private string OrderFolder(string companyId, string orderId) =>
        Path.Combine(_root, "companies", companyId, "orders", orderId);

    private static string RequireCompany(string id) =>
        SafeCompany.IsMatch(id) ? id : throw new ArgumentException("Invalid company");

    private static string RequireOrder(string id) =>
        SafeOrder.IsMatch(id) ? id : throw new ArgumentException("Invalid order");

    private static string Text(JsonElement obj, string name) =>
        obj.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString() ?? "" : "";

    private static object Fail(string code) => new { ok = false, error = code };
}

internal sealed class WorkOrder
{
    public string OrderId { get; set; } = "";
    public string CompanyId { get; set; } = "";
    public string Instruction { get; set; } = "";
    public string CreatedUtc { get; set; } = "";
    public string Status { get; set; } = "";
    public string AiMode { get; set; } = "";
    public List<string> Agents { get; set; } = new();
    public List<Artifact> Artifacts { get; set; } = new();
    public bool IntegrityVerified { get; set; }
    public string Review { get; set; } = "";
}

internal sealed class Artifact
{
    public string FileName { get; set; } = "";
    public int Bytes { get; set; }
    public string Sha256 { get; set; } = "";
}

internal static class SelfTest
{
    internal static int Run()
    {
        string root = Path.Combine(Path.GetTempPath(), "TheOrgBridgeTest-" + Guid.NewGuid().ToString("N"));
        try
        {
            var c = new Controller(root);
            var pong = Call(c, new { command = "ping" });
            Check(pong.GetProperty("ok").GetBoolean(), "ping");

            var capabilities = Call(c, new { command = "capabilities" });
            Check(!capabilities.GetProperty("liveAiProvider").GetBoolean(), "capability honesty");

            var bad = Call(c, new { command = "submit_order", companyId = "../escape", instruction = "Create a sample" });
            Check(!bad.GetProperty("ok").GetBoolean(), "company traversal rejection");

            var invalid = Call(c, new { command = "submit_order", companyId = "demo", instruction = "bad" });
            Check(!invalid.GetProperty("ok").GetBoolean(), "short instruction rejection");

            var made = Call(c, new
            {
                command = "submit_order", companyId = "demo",
                instruction = "Prepare a supervised project kickoff demonstration."
            });
            Check(made.GetProperty("ok").GetBoolean(), "order creation");
            var order = made.GetProperty("order");
            Check(order.GetProperty("integrityVerified").GetBoolean(), "sha256 review");
            Check(order.GetProperty("artifacts").GetArrayLength() == 2, "two files");
            string id = order.GetProperty("orderId").GetString()!;
            string folder = Path.Combine(root, "companies", "demo", "orders", id);
            Check(File.Exists(Path.Combine(folder, "plan.md")), "plan exists");
            Check(File.Exists(Path.Combine(folder, "work-product.md")), "draft exists");

            var fetched = Call(c, new { command = "get_order", companyId = "demo", orderId = id });
            Check(fetched.GetProperty("ok").GetBoolean(), "read order");
            Check(fetched.GetProperty("preview").GetString()!.Contains("local demonstration"), "preview");

            var listing = Call(c, new { command = "list_orders", companyId = "demo" });
            Check(listing.GetProperty("orders").GetArrayLength() == 1, "list company orders");

            var isolation = Call(c, new { command = "get_order", companyId = "other", orderId = id });
            Check(!isolation.GetProperty("ok").GetBoolean(), "company isolation");

            byte[] sample = Encoding.UTF8.GetBytes("# AI-generated draft\nSource content is untrusted.\n");
            var imported = Call(c, new {
                command = "import_artifact", companyId = "demo", orderId = id,
                agentId = "research1", fileName = "agent-report.md",
                dataBase64 = Convert.ToBase64String(sample),
                sourceProvider = "manual_import", sourceReference = "test_chat"
            });
            Check(imported.GetProperty("ok").GetBoolean(), "artifact intake");
            string artifactId = imported.GetProperty("artifact").GetProperty("artifactId").GetString()!;
            Check(imported.GetProperty("artifact").GetProperty("version").GetInt32() == 1,
                "first artifact version");
            Check(imported.GetProperty("artifact").GetProperty("intakeStatus").GetString() == "received_unverified",
                "intake stays unverified");

            var verified = Call(c, new {
                command = "verify_artifact", companyId = "demo", orderId = id, artifactId
            });
            Check(verified.GetProperty("ok").GetBoolean() &&
                verified.GetProperty("artifact").GetProperty("integrityValid").GetBoolean(),
                "artifact checksum verification");
            Check(verified.GetProperty("artifact").GetProperty("intakeStatus").GetString() ==
                "structure_verified_content_qa_pending", "semantic QA remains pending");

            // Actual safe preview must be plain text, bounded, unapproved and company-scoped.
            var preview = Call(c, new {
                command = "preview_text_artifact", companyId = "demo", orderId = id, artifactId
            });
            Check(preview.GetProperty("ok").GetBoolean(), "text preview response");
            var previewData = preview.GetProperty("preview");
            Check(previewData.GetProperty("text").GetString() ==
                Encoding.UTF8.GetString(sample), "preview content is plain text");
            Check(previewData.GetProperty("renderMode").GetString() == "textContent_only" &&
                !previewData.GetProperty("contentApproved").GetBoolean(),
                "preview does not confer content approval");
            var foreignPreview = Call(c, new {
                command = "preview_text_artifact", companyId = "another", orderId = id, artifactId
            });
            Check(!foreignPreview.GetProperty("ok").GetBoolean(),
                "cross-company preview rejected");

            var disallowed = Call(c, new {
                command = "import_artifact", companyId = "demo", orderId = id,
                agentId = "research1", fileName = "untrusted.html",
                dataBase64 = Convert.ToBase64String(Encoding.UTF8.GetBytes(
                    "<script>alert(1)</script>")),
                sourceProvider = "manual_import", sourceReference = "test"
            });
            Check(disallowed.GetProperty("ok").GetBoolean(), "HTML intake for QA");
            string htmlId = disallowed.GetProperty("artifact")
                .GetProperty("artifactId").GetString()!;
            var refusedHtml = Call(c, new {
                command = "preview_text_artifact", companyId = "demo", orderId = id,
                artifactId = htmlId
            });
            Check(!refusedHtml.GetProperty("ok").GetBoolean(),
                "browser-executable HTML never previewed");

            var oversizedText = Call(c, new {
                command = "import_artifact", companyId = "demo", orderId = id,
                agentId = "research1", fileName = "oversized.txt",
                dataBase64 = Convert.ToBase64String(Encoding.UTF8.GetBytes(new string('x', 33000))),
                sourceProvider = "manual_import", sourceReference = "test"
            });
            Check(oversizedText.GetProperty("ok").GetBoolean(), "oversize preview fixture imported");
            var tooLargePreview = Call(c, new {
                command = "preview_text_artifact", companyId = "demo", orderId = id,
                artifactId = oversizedText.GetProperty("artifact").GetProperty("artifactId").GetString()!
            });
            Check(!tooLargePreview.GetProperty("ok").GetBoolean(), "preview refuses files above 32 KiB");

            var malformedJson = Call(c, new {
                command = "import_artifact", companyId = "demo", orderId = id,
                agentId = "research1", fileName = "broken.json",
                dataBase64 = Convert.ToBase64String(Encoding.UTF8.GetBytes("{not-valid-json}")),
                sourceProvider = "manual_import", sourceReference = "test"
            });
            Check(malformedJson.GetProperty("ok").GetBoolean(), "malformed JSON kept for review");
            var invalidJsonPreview = Call(c, new {
                command = "preview_text_artifact", companyId = "demo", orderId = id,
                artifactId = malformedJson.GetProperty("artifact").GetProperty("artifactId").GetString()!
            });
            Check(!invalidJsonPreview.GetProperty("ok").GetBoolean(),
                "malformed JSON rejected by structural preview validation");


            var downloaded = Call(c, new {
                command = "read_artifact", companyId = "demo", orderId = id, artifactId
            });
            string echoed = downloaded.GetProperty("content").GetProperty("dataBase64").GetString()!;
            Check(Convert.FromBase64String(echoed).SequenceEqual(sample), "file byte roundtrip");
            Check(verified.GetProperty("artifact").GetProperty("formatValid").GetBoolean(),
                "UTF-8 markdown structural check passes");

            var second = Call(c, new {
                command = "import_artifact", companyId = "demo", orderId = id,
                agentId = "research1", fileName = "agent-report.md",
                dataBase64 = Convert.ToBase64String(sample),
                sourceProvider = "manual_import", sourceReference = "revised_test_chat"
            });
            Check(second.GetProperty("artifact").GetProperty("version").GetInt32() == 2,
                "new revision preserves earlier artifact");
            var artifacts = Call(c, new {
                command = "list_artifacts", companyId = "demo", orderId = id
            });
            var listed = artifacts.GetProperty("artifacts");
            Check(listed.GetArrayLength() == 5, "list five QA and version fixtures");
            Check(listed.EnumerateArray().Count(item =>
                item.GetProperty("fileName").GetString() == "agent-report.md") == 2,
                "both historical report versions still listed");

            var badFilename = Call(c, new {
                command = "import_artifact", companyId = "demo", orderId = id,
                agentId = "research1", fileName = "../secret.txt",
                dataBase64 = Convert.ToBase64String(sample),
                sourceProvider = "manual_import", sourceReference = ""
            });
            Check(!badFilename.GetProperty("ok").GetBoolean(), "reject filename traversal");

            var otherCompany = Call(c, new {
                command = "read_artifact", companyId = "another", orderId = id, artifactId
            });
            Check(!otherCompany.GetProperty("ok").GetBoolean(), "cross-company artifact blocked");

            string filePath = Path.Combine(folder, "agent_artifacts", artifactId + ".blob");
            File.AppendAllText(filePath, "tampered");
            var compromised = Call(c, new {
                command = "verify_artifact", companyId = "demo", orderId = id, artifactId
            });
            Check(compromised.GetProperty("ok").GetBoolean() &&
                !compromised.GetProperty("artifact").GetProperty("integrityValid").GetBoolean(),
                "tampered content detected");
            var tamperedPreview = Call(c, new {
                command = "preview_text_artifact", companyId = "demo", orderId = id, artifactId
            });
            Check(!tamperedPreview.GetProperty("ok").GetBoolean(),
                "tampered content rejected from text preview");



            // Multi-message transfer: explicitly test a file above the legacy 250 KiB cap.
            byte[] large = new byte[420_000];
            for (int i = 0; i < large.Length; i++) large[i] = (byte)(i % 251);
            string fullHash = Convert.ToHexString(SHA256.HashData(large));
            var begun = Call(c, new {
                command = "begin_artifact_upload", companyId = "demo", orderId = id,
                agentId = "research1", fileName = "large-report.pdf",
                totalBytes = large.Length, sha256 = fullHash,
                sourceProvider = "manual_download", sourceReference = "local-test"
            });
            Check(begun.GetProperty("ok").GetBoolean(), "begin large-file upload");
            var transfer = begun.GetProperty("transfer");
            string uploadId = transfer.GetProperty("uploadId").GetString()!;
            string accessToken = transfer.GetProperty("accessToken").GetString()!;
            var rejectedOrder = Call(c, new {
                command = "append_artifact_chunk", companyId = "demo", orderId = id,
                uploadId, accessToken, index = 1,
                dataBase64 = Convert.ToBase64String(large[..100])
            });
            Check(!rejectedOrder.GetProperty("ok").GetBoolean(), "reject out-of-order chunk");

            int index = 0;
            int offset = 0;
            while (offset < large.Length)
            {
                int count = Math.Min(ArtifactTransfers.ChunkBytes, large.Length - offset);
                var next = Call(c, new {
                    command = "append_artifact_chunk", companyId = "demo", orderId = id,
                    uploadId, accessToken, index,
                    dataBase64 = Convert.ToBase64String(large, offset, count)
                });
                Check(next.GetProperty("ok").GetBoolean(), "append chunk");
                offset += count;
                index++;
                // A new Controller instance emulates Chrome launching a new Native Messaging process.
                var resumed = Call(new Controller(root), new {
                    command = "upload_status", companyId = "demo", orderId = id,
                    uploadId, accessToken
                });
                Check(resumed.GetProperty("result").GetProperty("bytesReceived").GetInt64() == offset,
                    "resume transfer from stored state");
            }

            var finish = Call(new Controller(root), new {
                command = "complete_artifact_upload", companyId = "demo", orderId = id,
                uploadId, accessToken
            });
            Check(finish.GetProperty("ok").GetBoolean(), "finalize verified transfer");
            string bigArtifactId = finish.GetProperty("result").GetProperty("artifact")
                .GetProperty("artifactId").GetString()!;
            Check(finish.GetProperty("result").GetProperty("artifact").GetProperty("intakeStatus")
                .GetString() == "received_unverified", "large file still requires content QA");

            var bigVerify = Call(c, new {
                command = "verify_artifact", companyId = "demo", orderId = id,
                artifactId = bigArtifactId
            });
            Check(bigVerify.GetProperty("artifact").GetProperty("integrityValid").GetBoolean(),
                "large-file SHA-256 check");
            Check(!bigVerify.GetProperty("artifact").GetProperty("formatValid").GetBoolean(),
                "mislabelled PDF is flagged as malformed");
            Check(bigVerify.GetProperty("artifact").GetProperty("intakeStatus").GetString()
                == "format_invalid", "invalid format cannot reach content review");

            using var recovered = new MemoryStream();
            long cursor = 0;
            while (cursor < large.Length)
            {
                var part = Call(c, new {
                    command = "read_artifact_chunk", companyId = "demo", orderId = id,
                    artifactId = bigArtifactId, offset = cursor, chunkBytes = 64000
                }).GetProperty("result");
                byte[] next = Convert.FromBase64String(part.GetProperty("dataBase64").GetString()!);
                recovered.Write(next);
                cursor += next.Length;
            }
            Check(recovered.ToArray().SequenceEqual(large),
                "large-file download byte-for-byte roundtrip");

            var wrongHash = Call(c, new {
                command = "begin_artifact_upload", companyId = "demo", orderId = id,
                agentId = "research1", fileName = "wrong-hash.txt", totalBytes = 4,
                sha256 = new string('0', 64),
                sourceProvider = "test", sourceReference = ""
            });
            string badId = wrongHash.GetProperty("transfer").GetProperty("uploadId").GetString()!;
            string badToken = wrongHash.GetProperty("transfer").GetProperty("accessToken").GetString()!;
            Call(c, new {
                command = "append_artifact_chunk", companyId = "demo", orderId = id,
                uploadId = badId, accessToken = badToken, index = 0,
                dataBase64 = Convert.ToBase64String(new byte[] { 1, 2, 3, 4 })
            });
            var rejectedHash = Call(c, new {
                command = "complete_artifact_upload", companyId = "demo", orderId = id,
                uploadId = badId, accessToken = badToken
            });
            Check(!rejectedHash.GetProperty("ok").GetBoolean(),
                "cannot finalize file with incorrect checksum");
            var cancelled = Call(c, new {
                command = "cancel_artifact_upload", companyId = "demo", orderId = id,
                uploadId = badId, accessToken = badToken
            });
            Check(cancelled.GetProperty("ok").GetBoolean(), "cancel and clean staged upload");

            Console.WriteLine("PASS: native controller, artifact versioning, isolation and integrity self-tests");
            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine("FAIL: " + ex);
            return 1;
        }
        finally
        {
            try { if (Directory.Exists(root)) Directory.Delete(root, recursive: true); } catch { }
        }
    }

    private static JsonElement Call(Controller controller, object req)
    {
        var input = JsonSerializer.SerializeToElement(req);
        var response = controller.Execute(input);
        return JsonSerializer.SerializeToElement(response, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });
    }

    private static void Check(bool condition, string label)
    {
        if (!condition) throw new Exception("Failed check: " + label);
    }
}
