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
                    commands = new[] { "ping", "capabilities", "submit_order", "get_order", "list_orders" },
                    liveAiProvider = false,
                    chromeDesktopAutomation = false,
                    offlineFiles = true
                },
                "submit_order" => Submit(request),
                "get_order" => Get(request),
                "list_orders" => List(request),
                _ => Fail("unsupported_command")
            };
        }
        catch (ArgumentException) { return Fail("invalid_input"); }
        catch (IOException) { return Fail("storage_error"); }
        catch (UnauthorizedAccessException) { return Fail("access_denied"); }
        catch (JsonException) { return Fail("invalid_stored_record"); }
    }

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
        string preview = File.Exists(previewPath)
            ? File.ReadAllText(previewPath)[..Math.Min(16000, (int)new FileInfo(previewPath).Length)]
            : "";
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
            Console.WriteLine("PASS: 11 native-host controller checks");
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
