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
    private readonly LocalAgentEngine _agents;
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
        _agents = new LocalAgentEngine(_root);
    }

    internal object Execute(JsonElement request)
    {
        if (request.ValueKind != JsonValueKind.Object)
            return Fail("invalid_request");

        try
        {
            RequireUnambiguousJson(request);
            if (!request.TryGetProperty("command", out var commandValue) ||
                commandValue.ValueKind != JsonValueKind.String)
                return Fail("invalid_request");
            string command = commandValue.GetString() ?? "";
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
                    commands = new[] { "ping", "capabilities", "ao_capabilities", "submit_order", "get_order", "list_orders",
                        "import_artifact", "list_artifacts", "verify_artifact", "read_artifact", "preview_text_artifact",
                        "begin_artifact_upload", "append_artifact_chunk", "upload_status",
                        "complete_artifact_upload", "cancel_artifact_upload", "read_artifact_chunk",
                        "agent_create", "agent_get", "agent_list", "agent_approve", "agent_run_next", "agent_run_safe_batch",
                        "agent_complete_browser", "agent_review", "agent_cancel", "agent_recover",
                        "agent_memory_put", "agent_memory_list", "agent_tools" },
                    maxArtifactImportBytes = 256000,
                    importedArtifactsRequireContentQa = true,
                    liveAiProvider = false,
                    chromeDesktopAutomation = false,
                    localAgentExecutionPreview = true,
                    localOllamaOptional = true,
                    sqliteAgentQueue = true,
                    browserNavigationOnly = true,
                    desktopOperation = "notepad-launch-only",
                    offlineFiles = true
                },
                "ao_capabilities" => new
                {
                    ok = true,
                    protocolVersion = 1,
                    integration = "AO",
                    enabled = false,
                    status = "disabled_pending_authorization_and_contract_tests",
                    tools = Array.Empty<object>(),
                    executionSupported = false,
                    note = "Discovery handshake only. No MCP servers, commands or external tools are launched."
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
                _ when command.StartsWith("agent_", StringComparison.Ordinal) => _agents.Execute(request),
                _ => Fail("unsupported_command")
            };
        }
        catch (ArgumentException) { return Fail("invalid_input"); }
        catch (FormatException) { return Fail("invalid_artifact_metadata"); }
        catch (IOException) { return Fail("storage_error"); }
        catch (UnauthorizedAccessException) { return Fail("access_denied"); }
        catch (JsonException) { return Fail("invalid_stored_record"); }
    }


    private static void RequireUnambiguousJson(JsonElement value)
    {
        if(value.ValueKind==JsonValueKind.Object)
        {
            var names=new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach(var property in value.EnumerateObject())
            {
                if(!names.Add(property.Name))throw new ArgumentException("Duplicate JSON property");
                RequireUnambiguousJson(property.Value);
            }
        }
        else if(value.ValueKind==JsonValueKind.Array)
            foreach(var item in value.EnumerateArray())RequireUnambiguousJson(item);
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


            foreach(string raw in new[]{
                "{\"command\":\"ping\",\"command\":\"agent_run_next\"}",
                "{\"command\":\"ping\",\"COMMAND\":\"agent_run_next\"}",
                "{\"command\":\"ping\",\"scope\":{\"companyId\":\"demo\",\"companyId\":\"other\"}}",
                "{\"command\":null}", "{\"command\":3}"})
            {
                using var ambiguous=JsonDocument.Parse(raw);
                var denied=JsonSerializer.SerializeToElement(c.Execute(ambiguous.RootElement));
                Check(!denied.GetProperty("ok").GetBoolean(),"ambiguous or non-string native command rejected");
            }


            // Synthetic transport decoder tests. These are not local-model inference acceptance.
            using(var reply=new HttpResponseMessage(System.Net.HttpStatusCode.OK) {
                Content=new StringContent("{\"message\":{\"content\":\"valid synthetic plan\"}}")})
                Check(LocalAgentEngine.ReadLocalModelReply(reply,CancellationToken.None)=="valid synthetic plan",
                    "bounded model decoder accepts a valid reply");
            foreach(string body in new[]{"{}", "[]", "{\"message\":null}",
                "{\"message\":{\"content\":null}}", "{\"message\":{\"content\":\" \"}}", "{broken"})
            {
                using var reply=new HttpResponseMessage(System.Net.HttpStatusCode.OK) {Content=new StringContent(body)};
                bool rejected=false;
                try {LocalAgentEngine.ReadLocalModelReply(reply,CancellationToken.None);}
                catch(JsonException){rejected=true;}
                Check(rejected,"malformed local-model envelope rejected");
            }
            using(var redirect=new HttpResponseMessage(System.Net.HttpStatusCode.Redirect))
            {
                redirect.Headers.Location=new Uri("https://example.com/never-follow");
                bool rejected=false;
                try {LocalAgentEngine.ReadLocalModelReply(redirect,CancellationToken.None);}
                catch(HttpRequestException){rejected=true;}
                Check(rejected,"model decoder rejects redirect response");
            }
            using(var oversized=new HttpResponseMessage(System.Net.HttpStatusCode.OK) {
                Content=new ByteArrayContent(new byte[LocalAgentEngine.MaxModelResponseBytes+1])})
            {
                bool rejected=false;
                try {LocalAgentEngine.ReadLocalModelReply(oversized,CancellationToken.None);}
                catch(HttpRequestException){rejected=true;}
                Check(rejected,"declared oversized model response rejected");
            }
            using(var unknownLength=new SyntheticModelStream(LocalAgentEngine.MaxModelResponseBytes+100))
            using(var oversized=new HttpResponseMessage(System.Net.HttpStatusCode.OK) {
                Content=new StreamContent(unknownLength)})
            {
                bool rejected=false;
                try {LocalAgentEngine.ReadLocalModelReply(oversized,CancellationToken.None);}
                catch(HttpRequestException){rejected=true;}
                Check(rejected && unknownLength.BytesRead==LocalAgentEngine.MaxModelResponseBytes+1,
                    "unknown-length model body stops after one overflow byte");
            }
            using(var modelDeadlineFixture=new CancellationTokenSource())
            using(var reply=new HttpResponseMessage(System.Net.HttpStatusCode.OK) {
                Content=new StringContent("{\"message\":{\"content\":\"never read\"}}")})
            {
                modelDeadlineFixture.Cancel();
                bool rejected=false;
                try {LocalAgentEngine.ReadLocalModelReply(reply,modelDeadlineFixture.Token);}
                catch(OperationCanceledException){rejected=true;}
                Check(rejected,"model decoding honors deadline cancellation");
            }


            if(OperatingSystem.IsWindows())
            {
                string? notepadPathEnvFixture=Environment.GetEnvironmentVariable("PATH");
                try
                {
                    string expectedNotepadPath=Path.Combine(
                        Environment.GetFolderPath(Environment.SpecialFolder.System),"notepad.exe");
                    Environment.SetEnvironmentVariable("PATH",root);
                    string resolvedNotepadPath=LocalAgentEngine.NotepadExecutablePath();
                    Check(Path.IsPathFullyQualified(resolvedNotepadPath),"Notepad launch uses an absolute path");
                    Check(File.Exists(resolvedNotepadPath),"Notepad launch requires an existing system executable");
                    Check(string.Equals(resolvedNotepadPath,expectedNotepadPath,StringComparison.OrdinalIgnoreCase),
                        "Notepad launch is pinned to Windows system directory despite hostile PATH");
                }
                finally {Environment.SetEnvironmentVariable("PATH",notepadPathEnvFixture);}
            }

            var capabilities = Call(c, new { command = "capabilities" });
            Check(!capabilities.GetProperty("liveAiProvider").GetBoolean(), "capability honesty");
            var aoPolicy = Call(c, new { command = "agent_tools" });
            Check(aoPolicy.GetProperty("ok").GetBoolean(), "AO local tool catalog available");
            Check(aoPolicy.GetProperty("catalogVersion").GetString()=="ao.local.tools.v1",
                "versioned AO local tool capability contract");
            Check(!aoPolicy.GetProperty("mcpEnabled").GetBoolean() &&
                  !aoPolicy.GetProperty("remoteToolExecutionEnabled").GetBoolean(),
                "AO remote MCP and privileged tool execution remain disabled");
            var aoDescriptors=aoPolicy.GetProperty("toolDescriptors");
            Check(aoDescriptors.GetArrayLength()==6,"AO tool catalog is closed and bounded");
            foreach(var descriptor in aoDescriptors.EnumerateArray())
            {
                Check(descriptor.GetProperty("requiresOwnerApproval").GetBoolean(),
                    "AO tool cannot auto approve");
                Check(descriptor.GetProperty("version").GetInt32()==1,
                    "AO tool descriptor version must be explicit");
                string aoToolId=descriptor.GetProperty("id").GetString()!;
                bool safeBatch=descriptor.GetProperty("safeBatch").GetBoolean();
                if(aoToolId=="browser_open"||aoToolId=="windows_open_notepad")
                    Check(!safeBatch,"AO consequential actions excluded from safe batch");
                else
                    Check(safeBatch,"AO closed local actions remain eligible only after approval");
            }




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

            // Local agent runtime is real SQLite state and real restricted local tools.
            // Synthetic mode is expressly not a language model.
            var agentCreated=Call(c,new {
                command="agent_create",companyId="demo",orderId=id,
                instruction="Create a synthetic report demonstrating local agent execution.",
                mode="demo",model="qwen3:4b",approvedHosts=""
            });
            Check(agentCreated.GetProperty("ok").GetBoolean(),"agent demo plan created");
            string jobId=agentCreated.GetProperty("jobId").GetString()!;
            Check(agentCreated.GetProperty("status").GetString()=="awaiting_approval",
                "agent cannot auto approve");
            var noApproval=Call(c,new {command="agent_approve",companyId="demo",jobId,approved=false});
            Check(!noApproval.GetProperty("ok").GetBoolean(),"agent approval is explicit");
            var approvedJob=Call(c,new {command="agent_approve",companyId="demo",jobId,approved=true});
            Check(approvedJob.GetProperty("ok").GetBoolean(),"agent plan approval");

            // Approval binds exact plan and host scope across fresh native processes.
            var boundPlan=Call(c,new {command="agent_create",companyId="demo",orderId=id,
                instruction="Write a bounded synthetic approval binding note.",mode="demo",model="qwen3:4b",approvedHosts=""});
            string boundId=boundPlan.GetProperty("jobId").GetString()!;
            Call(c,new {command="agent_approve",companyId="demo",jobId=boundId,approved=true});
            string originalPlan=boundPlan.GetProperty("plan").GetRawText();
            foreach(string changedPlan in new[]{
                originalPlan.Replace("Demo request:","Changed request:"),
                originalPlan.Replace("write_note","shell"),
                originalPlan.Replace("\"summary\":","\"permissions\":[\"*\"],\"summary\":"),
                originalPlan.Replace("\"summary\":","\"summary\":\"duplicate\",\"summary\":"),
                originalPlan.Replace("\"tool\":\"write_note\"","\"tool\":null"),
                originalPlan.Replace("\"tool\":\"write_note\"","\"tool\":123"),
                originalPlan.Replace("\"tool\":\"write_note\"","\"tool\":\"write_note\",\"command\":\"cmd.exe\"")})
            {
                Check(changedPlan!=originalPlan,"negative fixture changed plan");
                SetJobField(root,boundId,"plan_json",changedPlan);
                var denied=Call(new Controller(root),new {command="agent_run_next",companyId="demo",jobId=boundId});
                Check(!denied.GetProperty("ok").GetBoolean(),"changed, unsupported or malformed native plan rejected");
            }
            SetJobField(root,boundId,"plan_json",originalPlan);
            SetJobField(root,boundId,"approved_hosts","example.com");
            Check(!Call(c,new {command="agent_run_safe_batch",companyId="demo",jobId=boundId})
                .GetProperty("ok").GetBoolean(),"expanded native host scope requires fresh approval");
            SetJobField(root,boundId,"approved_hosts","");
            var boundOutput=Path.Combine(folder,"agent_outputs","agent-"+boundId+"-01.md");
            Check(!File.Exists(boundOutput),"denied plans have no file side effect");
            Check(Call(new Controller(root),new {command="agent_run_next",companyId="demo",jobId=boundId})
                .GetProperty("ok").GetBoolean(),"exact approved plan survives process restart");

            var step1=Call(c,new {command="agent_run_next",companyId="demo",jobId});
            Check(step1.GetProperty("ok").GetBoolean(),"agent executes local file tool");
            var outInfo=step1.GetProperty("result");
            string name=outInfo.GetProperty("fileName").GetString()!;
            string savedNote=Path.Combine(folder,"agent_outputs",name);
            Check(File.Exists(savedNote) && File.ReadAllText(savedNote).Contains("Demo request"),
                "agent actually produced expected local file");
            var durable=Call(new Controller(root),new {command="agent_get",companyId="demo",jobId});
            Check(durable.GetProperty("status").GetString()=="queued"&&
                durable.GetProperty("stepIndex").GetInt32()==1,
                "SQLite queue resumes across native host processes");
            var step2=Call(new Controller(root),new {command="agent_run_next",companyId="demo",jobId});
            Check(step2.GetProperty("ok").GetBoolean(),"agent runs second local tool");
            var pending=Call(c,new {command="agent_get",companyId="demo",jobId});
            Check(pending.GetProperty("status").GetString()=="completed_pending_review",
                "completed task is not automatically certified");
            var qa=Call(c,new {command="agent_review",companyId="demo",jobId});
            Check(qa.GetProperty("qa").GetProperty("verdict").GetString()=="human_review_required"&&
                !qa.GetProperty("qa").GetProperty("semanticQualityApproved").GetBoolean(),
                "independent checksum QA does not certify content quality");
            // One-click safe batch cannot bypass approval or launch external applications.
            var batchPlan=Call(c,new {
                command="agent_create",companyId="demo",orderId=id,
                instruction="Produce a second synthetic local note and list it.",
                mode="demo",model="qwen3:4b",approvedHosts=""
            });
            string batchId=batchPlan.GetProperty("jobId").GetString()!;
            var unapprovedBatch=Call(c,new {command="agent_run_safe_batch",companyId="demo",jobId=batchId});
            Check(!unapprovedBatch.GetProperty("ok").GetBoolean(),"batch cannot bypass owner approval");
            Call(c,new {command="agent_approve",companyId="demo",jobId=batchId,approved=true});
            var batchResult=Call(new Controller(root),new {command="agent_run_safe_batch",companyId="demo",jobId=batchId});
            Check(batchResult.GetProperty("ok").GetBoolean()&&
                  batchResult.GetProperty("executedSteps").GetInt32()==2&&
                  batchResult.GetProperty("status").GetString()=="completed_pending_review",
                  "approved local batch runs both safe steps and preserves review gate");
            var batchAudit=Call(c,new {command="agent_review",companyId="demo",jobId=batchId});
            Check(batchAudit.GetProperty("qa").GetProperty("verdict").GetString()=="human_review_required",
                "safe batch does not self-certify");
            var foreignJob=Call(c,new {command="agent_get",companyId="other",jobId});
            Check(!foreignJob.GetProperty("ok").GetBoolean(),"agent jobs isolated by company");
            var beforeForeignBatch=Call(c,new {command="agent_get",companyId="demo",jobId=batchId});
            string beforeForeignStatus=beforeForeignBatch.GetProperty("status").GetString()!;
            int beforeForeignIndex=beforeForeignBatch.GetProperty("stepIndex").GetInt32();
            // A foreign workspace cannot mutate, execute, recover or certify a known job.
            foreach(string foreignCommand in new[]{
                "agent_approve","agent_run_next","agent_run_safe_batch","agent_cancel",
                "agent_recover","agent_review","agent_complete_browser"})
            {
                var deniedForeign=Call(new Controller(root),new {
                    command=foreignCommand,companyId="other",jobId=batchId,
                    approved=true,token=new string('0',32),url="https://example.com/",tabId=123});
                Check(!deniedForeign.GetProperty("ok").GetBoolean(),
                    "Foreign workspace denied: "+foreignCommand);
            }
            var unchangedBatch=Call(c,new {command="agent_get",companyId="demo",jobId=batchId});
            Check(unchangedBatch.GetProperty("status").GetString()==beforeForeignStatus &&
                  unchangedBatch.GetProperty("stepIndex").GetInt32()==beforeForeignIndex,
                "Foreign commands cannot alter owner job state");
            var put=Call(c,new {command="agent_memory_put",companyId="demo",key="project",
                value="Synthetic memory for test only"});
            Check(put.GetProperty("ok").GetBoolean(),"local persistent memory write");
            var memory=Call(new Controller(root),new {command="agent_memory_list",companyId="demo"});
            Check(memory.GetProperty("memories").GetArrayLength()==1,"memory survives process restart");
            var foreignMemory=Call(c,new {command="agent_memory_list",companyId="other"});
            Check(foreignMemory.GetProperty("memories").GetArrayLength()==0,"memory company isolation");

            // A malformed, local-only or special-use hostname must never grant a navigation scope.
            foreach(string invalidHost in new[]{
                "localhost","127.0.0.1","127.1","10.0.0.2",
                "service.local","service.localhost","service.internal","server.lan",
                "service.home.arpa","home.arpa","demo.test","demo.invalid",
                "demo.example","demo.onion","test..example.com",
                "-bad.example.com","bad-.example.com","good.com,",
                "good.com, ,other.com","good.com.","http://good.com"})
            {
                var deniedHost=Call(c,new {command="agent_create",companyId="demo",orderId=id,
                    instruction="Open a synthetic website for scoped security verification.",
                    mode="demo-browser",model="qwen3:4b",approvedHosts=invalidHost});
                Check(!deniedHost.GetProperty("ok").GetBoolean(),
                    "Local, reserved or malformed host scope rejected: "+invalidHost);
            }
            var ordinaryHosts=LocalAgentEngine.ParseHosts("Example.COM,api.Example.com");
            Check(ordinaryHosts.Length==2 &&
                  ordinaryHosts[0]=="example.com" && ordinaryHosts[1]=="api.example.com",
                  "Normal DNS hostnames remain supported and normalized");
            Check(LocalAgentEngine.ParseHosts("").Length==0,"Empty list remains valid for local tools");

            // Browser action is staged, reviewed, bound to an exact approved HTTPS hostname.
            var browser=Call(c,new {
                command="agent_create",companyId="demo",orderId=id,
                instruction="Open the example.com test site in Chrome without reading any page content.",
                mode="demo-browser",model="qwen3:4b",approvedHosts="example.com"
            });
            Check(browser.GetProperty("ok").GetBoolean(),"browser plan created");
            string browserJob=browser.GetProperty("jobId").GetString()!;
            Call(c,new {command="agent_approve",companyId="demo",jobId=browserJob,approved=true});
            var nav=Call(c,new {command="agent_run_next",companyId="demo",jobId=browserJob});
            Check(nav.GetProperty("status").GetString()=="awaiting_browser_navigation",
                "browser work requires extension action");
            string navToken=nav.GetProperty("token").GetString()!;
            var invalidToken=Call(c,new {command="agent_complete_browser",companyId="demo",
                jobId=browserJob,token="0",url="https://example.com/",tabId=123});
            Check(!invalidToken.GetProperty("ok").GetBoolean(),"browser receipt token required");
            // Even with the valid step token, a receipt must match the exact approved host,
            // scheme, port and fragment-free URL; neither subdomains nor userinfo are scope grants.
            foreach(string wrongUrl in new[]{
                "https://sub.example.com/","https://example.com.evil.org/",
                "http://example.com/","https://example.com:444/",
                "https://example.com/#fragment","https://example.com@evil.org/"})
            {
                var rejectedReceipt=Call(c,new {command="agent_complete_browser",companyId="demo",
                    jobId=browserJob,token=navToken,url=wrongUrl,tabId=123});
                Check(!rejectedReceipt.GetProperty("ok").GetBoolean(),
                    "Browser receipts cannot expand approved navigation hosts: "+wrongUrl);
            }
            var receipt=Call(c,new {command="agent_complete_browser",companyId="demo",
                jobId=browserJob,token=navToken,url="https://example.com/",tabId=123});
            Check(receipt.GetProperty("ok").GetBoolean()&&
                !receipt.GetProperty("verifiedPageContents").GetBoolean(),
                "navigation evidence never claims page contents verified");

            var replayedReceipt=Call(new Controller(root),new {command="agent_complete_browser",companyId="demo",
                jobId=browserJob,token=navToken,url="https://example.com/",tabId=123});
            Check(!replayedReceipt.GetProperty("ok").GetBoolean(),"completed browser receipt cannot replay");

            var browserQa=Call(c,new {command="agent_review",companyId="demo",jobId=browserJob});
            Check(browserQa.GetProperty("qa").GetProperty("browserOutcomeUnknown").GetBoolean(),
                "browser navigation is not accepted as content QA");

            // Simulate a host restart while browser navigation has an unknown outcome.
            var interrupted=Call(c,new {command="agent_create",companyId="demo",orderId=id,
                instruction="Open a synthetic approved page for recovery testing.",
                mode="demo-browser",model="qwen3:4b",approvedHosts="example.com"});
            string interruptedId=interrupted.GetProperty("jobId").GetString()!;
            Call(c,new {command="agent_approve",companyId="demo",jobId=interruptedId,approved=true});
            var interruptedNav=Call(c,new {command="agent_run_next",companyId="demo",jobId=interruptedId});
            string staleToken=interruptedNav.GetProperty("token").GetString()!;
            var recoveredBrowserJob=Call(new Controller(root),new {command="agent_recover",companyId="demo",jobId=interruptedId});
            Check(recoveredBrowserJob.GetProperty("status").GetString()=="blocked" &&
                  recoveredBrowserJob.GetProperty("manualReviewRequired").GetBoolean(),"unknown browser outcome blocks recovery");
            foreach(string replayCommand in new[]{"agent_run_next","agent_run_safe_batch","agent_approve"}) {
                Check(!Call(new Controller(root),new {command=replayCommand,companyId="demo",
                    jobId=interruptedId,approved=true}).GetProperty("ok").GetBoolean(),
                    "Recovered work cannot replay or reapprove: "+replayCommand);
            }
            Check(!Call(new Controller(root),new {command="agent_complete_browser",companyId="demo",
                jobId=interruptedId,token=staleToken,url="https://example.com/",tabId=123})
                .GetProperty("ok").GetBoolean(),"late browser receipt cannot complete recovered job");
            var recoveryState=Call(c,new {command="agent_get",companyId="demo",jobId=interruptedId});
            Check(recoveryState.GetProperty("status").GetString()=="blocked" &&
                  recoveryState.GetProperty("stepIndex").GetInt32()==0,"recovery preserves unfinished step");

            using(var recoveryDb=new Microsoft.Data.Sqlite.SqliteConnection(
                new Microsoft.Data.Sqlite.SqliteConnectionStringBuilder{
                    DataSource=Path.Combine(root,"agent-jobs.sqlite")}.ToString()))
            {
                recoveryDb.Open();
                using var recoveryTokenCheck=recoveryDb.CreateCommand();
                recoveryTokenCheck.CommandText="SELECT step_token FROM agent_jobs WHERE id=$id";
                recoveryTokenCheck.Parameters.AddWithValue("$id",interruptedId);
                Check(recoveryTokenCheck.ExecuteScalar() is DBNull,
                    "Recovery revokes persisted browser step token");
            }
            var recoveredAgain=Call(new Controller(root),new {command="agent_recover",
                companyId="demo",jobId=interruptedId});
            Check(recoveredAgain.GetProperty("status").GetString()=="blocked" &&
                  !recoveredAgain.GetProperty("canResume").GetBoolean(),
                  "Repeated recovery cannot resume unknown-outcome work");

            // Interrupted execution must not auto-replay potentially non-idempotent tools.
            var cancelledPlan=Call(c,new {command="agent_create",companyId="demo",orderId=id,
                instruction="Create another short synthetic note.",mode="demo",model="qwen3:4b",approvedHosts=""});
            string cancelledId=cancelledPlan.GetProperty("jobId").GetString()!;
            var cancel=Call(c,new {command="agent_cancel",companyId="demo",jobId=cancelledId});
            Check(cancel.GetProperty("status").GetString()=="cancelled","agent cancellation");
            var neverRun=Call(c,new {command="agent_run_next",companyId="demo",jobId=cancelledId});
            Check(!neverRun.GetProperty("ok").GetBoolean(),"cancelled jobs cannot run");

            // Both extensions share the legacy envelope; a format check is never
            // signature verification or authorization to decrypt.
            string envelopePath = Path.Combine(root, "synthetic.gize");
            File.WriteAllText(envelopePath,
                "GAIZ1\n{\"manifest\":{},\"signature\":\"synthetic\",\"ciphertext\":\"synthetic\"}");
            Check(ArtifactInspection.Inspect(envelopePath, "synthetic.gize").Valid,
                "GIZE structural intake");
            Check(ArtifactInspection.Inspect(envelopePath, "synthetic.gaiz").Valid,
                "legacy GAIZ structural intake");
            File.WriteAllText(envelopePath, "NOT-A-GAIZ-ENVELOPE");
            Check(!ArtifactInspection.Inspect(envelopePath, "synthetic.gize").Valid,
                "malformed GIZE rejection");
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



    private sealed class SyntheticModelStream : Stream
    {
        private readonly int _size;
        internal int BytesRead {get;private set;}
        internal SyntheticModelStream(int size) { _size=size; }
        public override bool CanRead=>true;
        public override bool CanSeek=>false;
        public override bool CanWrite=>false;
        public override long Length=>throw new NotSupportedException();
        public override long Position {get=>BytesRead;set=>throw new NotSupportedException();}
        public override int Read(byte[] buffer,int offset,int count)
        {
            int length=Math.Min(count,_size-BytesRead);
            Array.Fill<byte>(buffer,(byte)'x',offset,length);
            BytesRead+=length;
            return length;
        }
        public override ValueTask<int> ReadAsync(Memory<byte> buffer,CancellationToken cancellationToken=default)
        {
            cancellationToken.ThrowIfCancellationRequested();
            int length=Math.Min(buffer.Length,_size-BytesRead);
            buffer.Span[..length].Fill((byte)'x');
            BytesRead+=length;
            return ValueTask.FromResult(length);
        }
        public override void Flush(){}
        public override long Seek(long offset,SeekOrigin origin)=>throw new NotSupportedException();
        public override void SetLength(long length)=>throw new NotSupportedException();
        public override void Write(byte[] buffer,int offset,int count)=>throw new NotSupportedException();
    }

    private static void SetJobField(string root,string jobId,string column,string value)
    {
        if(column is not ("plan_json" or "approved_hosts"))throw new ArgumentException("Invalid fixture column");
        using var db=new Microsoft.Data.Sqlite.SqliteConnection(
            new Microsoft.Data.Sqlite.SqliteConnectionStringBuilder{
                DataSource=Path.Combine(root,"agent-jobs.sqlite")}.ToString());
        db.Open();
        using var cmd=db.CreateCommand();
        cmd.CommandText="UPDATE agent_jobs SET "+column+"=$value WHERE id=$id";
        cmd.Parameters.AddWithValue("$value",value);
        cmd.Parameters.AddWithValue("$id",jobId);
        Check(cmd.ExecuteNonQuery()==1,"native negative fixture updated exactly one job");
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
