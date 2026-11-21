using System.Diagnostics;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace TheOrg.Bridge;

// Accessibility patterns target one reviewed window/control, never global keyboard or mouse input.
// A fixed embedded worker runs in Windows PowerShell's .NET Framework UI Automation environment.
internal sealed class WindowsDesktopAssist
{
    private readonly string _root;
    private static readonly JsonSerializerOptions Json = new() {PropertyNamingPolicy = JsonNamingPolicy.CamelCase};
    private static readonly Regex Company = new("^[a-z0-9_-]{1,40}$");
    private static readonly Regex Id = new("^[a-f0-9]{32}$");
    internal WindowsDesktopAssist(string root) { _root = Path.GetFullPath(root); }

    internal object Execute(JsonElement request)
    {
        try
        {
            string folder = OrderFolder(request);
            string command = Text(request, "command");
            if (command == "desktop_history")
            {
                string historyRoot = Path.Combine(folder, "desktop_actions");
                RejectLinks(historyRoot);
                var entries = new List<object>();
                if (Directory.Exists(historyRoot)) foreach (var directory in new DirectoryInfo(historyRoot).GetDirectories()
                    .Where(item => Id.IsMatch(item.Name)).OrderByDescending(item => item.CreationTimeUtc).Take(50))
                {
                    RejectLinks(directory.FullName);
                    string receipt = Path.Combine(directory.FullName, "receipt.json"); RejectLinks(receipt);
                    string status = File.Exists(Path.Combine(directory.FullName, "claimed")) ? "unknown_outcome_review_required" : "awaiting_approval";
                    if (File.Exists(receipt) && new FileInfo(receipt).Length < 192000)
                    {
                        using var data = JsonDocument.Parse(File.ReadAllText(receipt, Encoding.UTF8));
                        status = Text(data.RootElement, "status");
                    }
                    entries.Add(new {actionId = directory.Name, status, createdUtc = directory.CreationTimeUtc});
                }
                return new {ok = true, actions = entries};
            }
            if (command == "desktop_windows") return Worker(new {operation = "list_windows"});
            if (command == "desktop_observe")
            {
                var window = request.GetProperty("window"); ValidateWindow(window);
                return Worker(new {operation = "observe", window});
            }
            if (command == "desktop_preview")
            {
                var action = request.GetProperty("action"); ValidateAction(action);
                string id = Guid.NewGuid().ToString("N");
                string directory = Path.Combine(folder, "desktop_actions", id);
                Directory.CreateDirectory(directory); RejectLinks(directory);
                string body = action.GetRawText();
                using (var file = new FileStream(Path.Combine(directory, "plan.json"), FileMode.CreateNew, FileAccess.Write, FileShare.None))
                {
                    byte[] bytes = Encoding.UTF8.GetBytes(body); file.Write(bytes); file.Flush(true);
                }
                return new {ok = true, actionId = id, action, fingerprint = Hash(body), status = "awaiting_approval"};
            }
            if (command is not ("desktop_execute" or "desktop_receipt")) throw new ArgumentException("Unsupported desktop command");
            string actionId = Text(request, "actionId");
            if (!Id.IsMatch(actionId)) throw new ArgumentException("Invalid action identity");
            string actionFolder = Path.Combine(folder, "desktop_actions", actionId);
            RejectLinks(actionFolder);
            string planPath = Path.Combine(actionFolder, "plan.json");
            RejectLinks(planPath);
            var info = new FileInfo(planPath);
            if (!info.Exists || info.Length > 16000) throw new ArgumentException("Missing or oversized action proposal");
            string planText = File.ReadAllText(planPath, Encoding.UTF8);
            using var document = JsonDocument.Parse(planText);
            var plan = document.RootElement; ValidateAction(plan);
            string receiptPath = Path.Combine(actionFolder, "receipt.json");
            if (command == "desktop_receipt")
            {
                RejectLinks(receiptPath);
                if (!File.Exists(receiptPath))
                    return new {ok = true, actionId, status = File.Exists(Path.Combine(actionFolder, "claimed")) ? "unknown_outcome_review_required" : "awaiting_approval"};
                using var receipt = JsonDocument.Parse(File.ReadAllText(receiptPath, Encoding.UTF8));
                return new {ok = true, actionId, receipt = receipt.RootElement.Clone()};
            }
            if (!request.TryGetProperty("approved", out var approval) || approval.ValueKind != JsonValueKind.True ||
                !string.Equals(Text(request, "fingerprint"), Hash(planText), StringComparison.Ordinal))
                throw new ArgumentException("Review the exact action and confirm its fingerprint before execution");
            // Atomic cross-process claim. A crash or missing receipt NEVER permits a replay.
            string claim = Path.Combine(actionFolder, "claimed");
            using (var claimed = new FileStream(claim, FileMode.CreateNew, FileAccess.Write, FileShare.None))
            {
                byte[] bytes = Encoding.UTF8.GetBytes(DateTimeOffset.UtcNow.ToString("O"));
                claimed.Write(bytes); claimed.Flush(true);
            }
            object evidence;
            try
            {
                var result = Worker(plan);
                bool success = result.TryGetProperty("ok", out var ok) && ok.ValueKind == JsonValueKind.True;
                evidence = new {status = success ? "action_assertion_passed" : "blocked_review_required",
                    outcomeUnknown = !success, result, finishedUtc = DateTimeOffset.UtcNow};
            }
            catch (Exception error) when (error is IOException or InvalidOperationException or System.ComponentModel.Win32Exception)
            {
                evidence = new {status = "unknown_outcome_review_required", outcomeUnknown = true,
                    error = error.GetType().Name, finishedUtc = DateTimeOffset.UtcNow};
            }
            string temp = Path.Combine(actionFolder, Guid.NewGuid().ToString("N") + ".tmp");
            File.WriteAllText(temp, JsonSerializer.Serialize(evidence, Json), Encoding.UTF8);
            File.Move(temp, receiptPath, false);
            return new {ok = true, actionId, receipt = evidence};
        }
        catch (ArgumentException ex) {return new {ok = false, error = "invalid_desktop_input", detail = ex.Message};}
        catch (KeyNotFoundException) {return new {ok = false, error = "desktop_field_missing"};}
        catch (JsonException) {return new {ok = false, error = "invalid_desktop_json"};}
        catch (IOException) {return new {ok = false, error = "desktop_storage_or_replay_blocked"};}
        catch (UnauthorizedAccessException) {return new {ok = false, error = "desktop_access_denied"};}
        catch (InvalidOperationException ex) {return new {ok = false, error = "desktop_unavailable", detail = ex.Message};}
        catch (System.ComponentModel.Win32Exception) {return new {ok = false, error = "desktop_worker_unavailable"};}
    }

    internal static void ValidateWindow(JsonElement window)
    {
        Fields(window, "handle", "processId", "processStartedUtc", "title");
        if (!window.GetProperty("handle").TryGetInt64(out long handle) || handle <= 0 ||
            !window.GetProperty("processId").TryGetInt32(out int pid) || pid <= 0 ||
            !DateTimeOffset.TryParse(Text(window, "processStartedUtc"), out _) || Text(window, "title").Length > 240)
            throw new ArgumentException("Invalid pinned window identity");
    }
    internal static void ValidateAction(JsonElement action)
    {
        string operation = Text(action, "operation");
        if (operation is not ("set_value" or "invoke")) throw new ArgumentException("Only accessibility set_value and invoke are supported");
        Fields(action, operation == "set_value" ? new[] {"operation", "window", "target", "value"} :
            new[] {"operation", "window", "target", "expectedText"});
        ValidateWindow(action.GetProperty("window"));
        var target = action.GetProperty("target"); Fields(target, "runtimeId", "name", "controlType");
        var runtime = target.GetProperty("runtimeId");
        if (runtime.ValueKind != JsonValueKind.Array || runtime.GetArrayLength() is < 1 or > 20 ||
            runtime.EnumerateArray().Any(value => !value.TryGetInt32(out _)) || Text(target, "name").Length > 240 ||
            !Regex.IsMatch(Text(target, "controlType"), "^ControlType\\.[A-Za-z]{3,40}$"))
            throw new ArgumentException("Invalid observed accessibility control");
        string field = operation == "set_value" ? "value" : "expectedText";
        if (!action.TryGetProperty(field, out var input) || input.ValueKind != JsonValueKind.String ||
            input.GetString()!.Length > (operation == "set_value" ? 4000 : 240) ||
            (operation == "invoke" && string.IsNullOrWhiteSpace(input.GetString())))
            throw new ArgumentException("Missing or oversized reviewed input/outcome");
    }
    private static void Fields(JsonElement value, params string[] expected)
    {
        if (value.ValueKind != JsonValueKind.Object) throw new ArgumentException("Expected structured desktop data");
        var names = new HashSet<string>(StringComparer.Ordinal);
        foreach (var property in value.EnumerateObject())
            if (!expected.Contains(property.Name, StringComparer.Ordinal) || !names.Add(property.Name))
                throw new ArgumentException("Unknown desktop field");
        if (names.Count != expected.Length) throw new ArgumentException("Missing desktop field");
    }
    private string OrderFolder(JsonElement request)
    {
        string company = Text(request, "companyId"), order = Text(request, "orderId");
        if (!Company.IsMatch(company) || !Id.IsMatch(order)) throw new ArgumentException("Invalid work-order scope");
        string folder = Path.Combine(_root, "companies", company, "orders", order);
        RejectLinks(folder);
        if (!File.Exists(Path.Combine(folder, "order.json"))) throw new ArgumentException("Create the local work order first");
        return folder;
    }
    private static void RejectLinks(string path)
    {
        FileSystemInfo? part = File.Exists(path) ? new FileInfo(path) : new DirectoryInfo(path);
        while (part != null)
        {
            if (part.Exists && (part.Attributes & FileAttributes.ReparsePoint) != 0)
                throw new ArgumentException("Linked desktop action paths are not supported");
            part = part is FileInfo file ? file.Directory : ((DirectoryInfo)part).Parent;
        }
    }
    private static string Hash(string text) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(text)));
    private static string Text(JsonElement value, string name) => value.TryGetProperty(name, out var field) &&
        field.ValueKind == JsonValueKind.String ? field.GetString() ?? "" : "";
    private static JsonElement Worker(object request)
    {
        if (!OperatingSystem.IsWindows()) throw new InvalidOperationException("Windows desktop accessibility is required");
        using var resource = Assembly.GetExecutingAssembly().GetManifestResourceStream("TheOrg.Bridge.DesktopAutomation.ps1")
            ?? throw new InvalidOperationException("Packaged desktop worker missing");
        using var reader = new StreamReader(resource, Encoding.UTF8);
        string script = reader.ReadToEnd();
        string system = Environment.GetFolderPath(Environment.SpecialFolder.System);
        string powershell = Path.Combine(system, "WindowsPowerShell", "v1.0", "powershell.exe");
        var start = new ProcessStartInfo(powershell) {UseShellExecute = false, CreateNoWindow = true,
            RedirectStandardInput = true, RedirectStandardOutput = true, RedirectStandardError = true,
            StandardInputEncoding = new UTF8Encoding(false), StandardOutputEncoding = Encoding.UTF8};
        foreach (string argument in new[] {"-NoLogo", "-NoProfile", "-NonInteractive", "-STA", "-EncodedCommand", Convert.ToBase64String(Encoding.Unicode.GetBytes(script))})
            start.ArgumentList.Add(argument);
        using var process = Process.Start(start) ?? throw new InvalidOperationException("Desktop worker did not start");
        var output = process.StandardOutput.ReadToEndAsync();
        var errors = process.StandardError.ReadToEndAsync();
        process.StandardInput.Write(JsonSerializer.Serialize(request, Json)); process.StandardInput.Close();
        if (!process.WaitForExit(12000))
        {
            process.Kill(entireProcessTree: true);
            throw new InvalidOperationException("Desktop operation timed out; inspect the app before any retry");
        }
        string content = output.GetAwaiter().GetResult();
        _ = errors.GetAwaiter().GetResult();
        if (content.Length > 192000) throw new InvalidOperationException("Desktop response exceeded the observation limit");
        using var parsed = JsonDocument.Parse(content);
        return parsed.RootElement.Clone();
    }
}
