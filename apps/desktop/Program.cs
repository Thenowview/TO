using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using System.Text.Json;
using System.Text.RegularExpressions;
using TheOrg.Bridge;

namespace Gize.Desktop;

internal static class Program
{
    [STAThread] private static void Main(string[] args)
    {
        ApplicationConfiguration.Initialize();
        Application.Run(new WorkspaceWindow(args.SequenceEqual(new[] {"--smoke-test"})));
    }
}

internal sealed class WorkspaceWindow : Form
{
    private readonly string _root = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "TheOrg", "workspace");
    private readonly TabControl _tabs = new() {Dock = DockStyle.Fill};
    private readonly ToolStrip _toolbar = new() {GripStyle = ToolStripGripStyle.Hidden, BackColor = Color.FromArgb(17, 28, 48), ForeColor = Color.White};
    private readonly Dictionary<int, BrowserTab> _browser = new();
    private readonly Dictionary<int, string> _groups = new();
    private readonly Dictionary<string, Job> _jobs = new(StringComparer.Ordinal);
    private readonly HashSet<string> _grants = new(StringComparer.Ordinal);
    private readonly SemaphoreSlim _nativeQueue = new(1, 1);
    private readonly Controller _controller;
    private readonly bool _smoke;
    private readonly JsonSerializerOptions _json = new() {PropertyNamingPolicy = JsonNamingPolicy.CamelCase};
    private WebView2? _workspace;
    private string? _selectedJob;
    private int _nextTab = 1, _nextGroup = 1;
    private static readonly Regex Id = new("^[a-f0-9]{32}$");
    private sealed record Job(string Id, string Company, string Instruction);
    private sealed class BrowserTab
    {
        internal required int Id; internal required Job Job; internal required TabPage Page; internal required WebView2 View;
        internal int Group = -1; internal bool Loaded;
    }
    internal WorkspaceWindow(bool smoke = false)
    {
        _smoke = smoke;
        if (smoke) _root = Path.Combine(Path.GetTempPath(), "GizeSyntheticWorkspace", Guid.NewGuid().ToString("N"));
        Text = "GIZE AI"; Width = 1380; Height = 900; MinimumSize = new Size(900, 600);
        StartPosition = FormStartPosition.CenterScreen; BackColor = Color.FromArgb(11, 17, 32);
        Directory.CreateDirectory(_root); _controller = new Controller(_root);
        var home = new ToolStripButton("GIZE jobs"); home.Click += (_, _) => _tabs.SelectedIndex = 0;
        var newTab = new ToolStripButton("New job tab"); newTab.Click += async (_, _) => await OpenSelected("https://www.google.com/");
        _toolbar.Items.Add(home); _toolbar.Items.Add(newTab);
        foreach (var provider in new[] {("ChatGPT", "https://chatgpt.com/"), ("Claude", "https://claude.ai/"), ("Gemini", "https://gemini.google.com/")})
        {
            var button = new ToolStripButton(provider.Item1); button.Click += async (_, _) => await OpenSelected(provider.Item2); _toolbar.Items.Add(button);
        }
        var close = new ToolStripButton("Close tab"); close.Click += (_, _) => CloseSelected(); _toolbar.Items.Add(close);
        Controls.Add(_tabs); Controls.Add(_toolbar); _toolbar.Dock = DockStyle.Top;
        Shown += async (_, _) => {await Initialize(); if (_smoke) await Smoke();};
        FormClosed += (_, _) => {_controller.Dispose(); foreach (var tab in _browser.Values) tab.View.Dispose(); _workspace?.Dispose();};
    }
    private async Task Smoke()
    {
        try
        {
            if (_workspace?.CoreWebView2 == null) throw new InvalidOperationException("workspace_not_initialized");
            var deadline = DateTime.UtcNow.AddSeconds(30);
            while (await _workspace.CoreWebView2.ExecuteScriptAsync("Boolean(globalThis.GizeDesktopSurface && document.getElementById('chatRefresh'))") != "true")
            {
                if (DateTime.UtcNow > deadline) throw new InvalidOperationException("packaged_workspace_not_ready");
                await Task.Delay(100);
            }
            var created = JsonSerializer.SerializeToElement(await AppCommand(JsonSerializer.SerializeToElement(new {
                command = "create_order", companyId = "synthetic", instruction = "Synthetic standalone job"})), _json);
            string id = String(created, "taskId");
            if (!Id.IsMatch(id)) throw new InvalidOperationException("standalone_job_creation_failed");
            await _workspace.CoreWebView2.ExecuteScriptAsync("document.getElementById('chatRefresh').click()");
            while (await _workspace.CoreWebView2.ExecuteScriptAsync("document.getElementById('chatJobCount').textContent") != "\"1\"")
            {
                if (DateTime.UtcNow > deadline) throw new InvalidOperationException("job_sidebar_not_rendered");
                await Task.Delay(100);
            }
            var first = await CreateTab(RequireJob(id), "https://example.com/", false);
            var secondJob = JsonSerializer.SerializeToElement(await AppCommand(JsonSerializer.SerializeToElement(new {
                command = "create_order", companyId = "synthetic", instruction = "Separate synthetic job"})), _json);
            var second = await CreateTab(RequireJob(String(secondJob, "taskId")), "https://example.com/", false);
            if (first.View.CoreWebView2.Environment.UserDataFolder == second.View.CoreWebView2.Environment.UserDataFolder ||
                first.View.CoreWebView2.Settings.IsWebMessageEnabled || second.View.CoreWebView2.Settings.IsWebMessageEnabled)
                throw new InvalidOperationException("provider_profile_or_bridge_isolation_failed");
            bool rejected = false;
            try {RequireTab(first.Job, second.Id);} catch (ArgumentException) {rejected = true;}
            if (!rejected) throw new InvalidOperationException("cross_job_tab_access");
            File.WriteAllText("desktop-smoke-result.json", JsonSerializer.Serialize(new {ok = true,
                packagedWorkspace = true, nativeJobCreation = true, sidebarRendered = true, isolatedProfiles = true,
                providerBridgeDisabled = true, extensionRequired = false, synthetic = true}, _json));
        }
        catch (Exception error)
        {
            Environment.ExitCode = 1;
            File.WriteAllText("desktop-smoke-result.json", JsonSerializer.Serialize(new {ok = false, error = error.ToString()}, _json));
        }
        Close();
    }
    private async Task Initialize()
    {
        try
        {
            var page = new TabPage("GIZE · Jobs") {BackColor = BackColor};
            _workspace = new WebView2 {Dock = DockStyle.Fill}; page.Controls.Add(_workspace); _tabs.TabPages.Add(page);
            var environment = await CoreWebView2Environment.CreateAsync(userDataFolder: Path.Combine(_root, "desktop_profile"));
            await _workspace.EnsureCoreWebView2Async(environment);
            _workspace.CoreWebView2.SetVirtualHostNameToFolderMapping("gize.local", Path.Combine(AppContext.BaseDirectory, "assets"), CoreWebView2HostResourceAccessKind.DenyCors);
            _workspace.CoreWebView2.Settings.AreDevToolsEnabled = false;
            _workspace.CoreWebView2.NavigationStarting += (_, args) => {if (!WorkspaceUrl(args.Uri)) args.Cancel = true;};
            _workspace.CoreWebView2.NewWindowRequested += (_, args) => args.Handled = true;
            _workspace.CoreWebView2.WebMessageReceived += BridgeMessage;
            _workspace.Source = new Uri("https://gize.local/home.html");
        }
        catch (Exception error)
        {
            MessageBox.Show(this, "GIZE could not start its embedded browser. Install or repair Microsoft Edge WebView2 Runtime, then reopen GIZE.\n\n" + error.GetType().Name,
                "GIZE startup", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }
    private static bool WorkspaceUrl(string text) => Uri.TryCreate(text, UriKind.Absolute, out var uri) &&
        uri.Scheme == "https" && uri.Host == "gize.local" && uri.AbsolutePath == "/home.html";
    private async void BridgeMessage(object? sender, CoreWebView2WebMessageReceivedEventArgs args)
    {
        if (_workspace?.CoreWebView2 == null || !WorkspaceUrl(args.Source)) return;
        string? id = null;
        try
        {
            if (args.WebMessageAsJson.Length > 1000000) throw new ArgumentException("Request exceeds limit");
            using var message = JsonDocument.Parse(args.WebMessageAsJson);
            id = String(message.RootElement, "id"); if (!Id.IsMatch(id)) return;
            string channel = String(message.RootElement, "channel"); var payload = message.RootElement.GetProperty("payload").Clone();
            object result = channel == "browser" ? await BrowserCommand(payload) : channel == "app" ? await AppCommand(payload) :
                throw new ArgumentException("Unsupported app channel");
            _workspace.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(new {id, ok = true, result}, _json));
        }
        catch (Exception error) when (error is ArgumentException or InvalidOperationException or IOException or JsonException or KeyNotFoundException or System.Runtime.InteropServices.COMException)
        {
            _workspace.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(new {id, ok = false, error = error is ArgumentException ? error.Message : error.GetType().Name}, _json));
        }
    }
    private async Task<JsonElement> Native(object payload, bool control = false)
    {
        var request = JsonSerializer.SerializeToElement(payload, _json);
        if (!control) await _nativeQueue.WaitAsync();
        try {return await Task.Run(() => JsonSerializer.SerializeToElement(_controller.Execute(request), _json));}
        finally {if (!control) _nativeQueue.Release();}
    }
    private async Task<object> AppCommand(JsonElement input)
    {
        string command = String(input, "command");
        if (command == "orders")
        {
            var records = new List<object>(); string companies = Path.Combine(_root, "companies");
            if (Directory.Exists(companies)) foreach (string directory in Directory.GetDirectories(companies))
            {
                string company = Path.GetFileName(directory); if (!Regex.IsMatch(company, "^[a-z0-9_-]{1,40}$")) continue;
                var result = await Native(new {command = "list_orders", companyId = company});
                if (!result.TryGetProperty("orders", out var list) || list.ValueKind != JsonValueKind.Array) continue;
                foreach (var record in list.EnumerateArray())
                {
                    string jobId = String(record, "orderId"); if (!Id.IsMatch(jobId)) continue;
                    var detail = await Native(new {command = "get_order", companyId = company, orderId = jobId});
                    if (!detail.TryGetProperty("order", out var order)) continue;
                    string instruction = String(order, "instruction"); _jobs[jobId] = new Job(jobId, company, instruction);
                    records.Add(new {taskId = jobId, companyId = company, title = instruction[..Math.Min(90, instruction.Length)],
                        instruction, createdUtc = String(order, "createdUtc"), phase = "pending"});
                }
            }
            return new {ok = true, orders = records};
        }
        if (command == "create_order")
        {
            string company = String(input, "companyId"), instruction = String(input, "instruction");
            var result = await Native(new {command = "submit_order", companyId = company, instruction});
            if (!result.GetProperty("ok").GetBoolean()) return result;
            string id = String(result.GetProperty("order"), "orderId"); _jobs[id] = new Job(id, company, instruction);
            return new {ok = true, taskId = id};
        }
        if (command == "chat_models") return await Native(new {command});
        if (command == "ping" || command == "capabilities") return await Native(new {command});
        var job = RequireJob(String(input, "taskId"));
        _selectedJob = job.Id;
        if (command == "select_job") return new {ok = true};
        var request = new Dictionary<string, object?> { ["command"] = command, ["companyId"] = job.Company, ["orderId"] = job.Id };
        string[] fields = command switch {
            "chat_get" or "chat_memory_list" or "desktop_windows" or "desktop_history" => Array.Empty<string>(),
            "chat_start" => new[] {"text", "model", "nonce"},
            "chat_stop" or "chat_recover" => new[] {"turnId"},
            "chat_memory_put" => new[] {"key", "content", "source"},
            "desktop_observe" => new[] {"window"}, "desktop_preview" => new[] {"action"},
            "desktop_execute" => new[] {"actionId", "fingerprint", "approved"},
            "desktop_receipt" or "desktop_stop" => new[] {"actionId"},
            "desktop_draft_plan" => new[] {"window", "model"},
            "browser_workflow_draft" => new[] {"model", "url", "observation"},
            _ => throw new ArgumentException("This operation is not available in the standalone workspace")};
        foreach (string field in fields) if (input.TryGetProperty(field, out var value)) request[field] = value.Clone();
        if (command is "chat_start" or "desktop_draft_plan" or "browser_workflow_draft") request["instruction"] = job.Instruction;
        if (command == "browser_workflow_draft") request["command"] = "agent_browser_draft";
        return await Native(request, command is "chat_get" or "chat_stop" or "chat_recover" or "desktop_stop");
    }
    private Job RequireJob(string id) => Id.IsMatch(id) && _jobs.TryGetValue(id, out var job) ? job : throw new ArgumentException("Choose an existing job first");
    private async Task OpenSelected(string url)
    {
        try {if (_selectedJob == null) throw new ArgumentException("Choose a GIZE job first"); await CreateTab(RequireJob(_selectedJob), url, true);}
        catch (Exception error) {MessageBox.Show(this, error.Message, "GIZE tabs", MessageBoxButtons.OK, MessageBoxIcon.Information);}
    }
    private static string Https(string url)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || uri.Scheme != "https" || uri.UserInfo != "" || uri.Port != 443)
            throw new ArgumentException("Use an HTTPS website without embedded credentials or a custom port");
        return uri.AbsoluteUri;
    }
    private async Task<BrowserTab> CreateTab(Job job, string url, bool active)
    {
        url = Https(url);
        if (_browser.Count >= 32) throw new ArgumentException("Close an app tab before opening more");
        int id = _nextTab++; var page = new TabPage("Job · Loading"); var view = new WebView2 {Dock = DockStyle.Fill};
        var navigation = new ToolStrip {GripStyle = ToolStripGripStyle.Hidden};
        var address = new ToolStripTextBox {AutoSize = false, Width = 700, Text = url};
        var back = new ToolStripButton("Back"); back.Click += (_, _) => {if (view.CanGoBack) view.GoBack();};
        var reload = new ToolStripButton("Reload"); reload.Click += (_, _) => view.Reload();
        address.KeyDown += (_, args) => {if (args.KeyCode == Keys.Enter) {try {view.Source = new Uri(Https(address.Text));} catch (ArgumentException) { } args.SuppressKeyPress = true;}};
        navigation.Items.Add(back); navigation.Items.Add(reload); navigation.Items.Add(address);
        page.Controls.Add(view); page.Controls.Add(navigation); navigation.Dock = DockStyle.Top; _tabs.TabPages.Add(page);
        var tab = new BrowserTab {Id = id, Job = job, Page = page, View = view}; _browser[id] = tab;
        var profile = Path.Combine(_root, "companies", job.Company, "orders", job.Id, "browser_profile");
        var environment = await CoreWebView2Environment.CreateAsync(userDataFolder: profile);
        await view.EnsureCoreWebView2Async(environment);
        view.CoreWebView2.NavigationStarting += (_, _) => tab.Loaded = false;
        view.CoreWebView2.NavigationCompleted += (_, args) => tab.Loaded = args.IsSuccess;
        view.CoreWebView2.Settings.IsWebMessageEnabled = false;
        view.CoreWebView2.Settings.AreDevToolsEnabled = false;
        view.CoreWebView2.Profile.IsPasswordAutosaveEnabled = false;
        view.CoreWebView2.NavigationStarting += (_, args) => {if (!Uri.TryCreate(args.Uri, UriKind.Absolute, out var target) || target.Scheme != "https") args.Cancel = true;};
        view.CoreWebView2.SourceChanged += (_, _) => address.Text = view.Source?.AbsoluteUri ?? "";
        view.CoreWebView2.DocumentTitleChanged += (_, _) => {string title = view.CoreWebView2.DocumentTitle; page.Text = "Job " + job.Id[..6] + " · " + title[..Math.Min(35, title.Length)];};
        view.CoreWebView2.NewWindowRequested += async (_, args) => {
            args.Handled = true; if (Uri.TryCreate(args.Uri, UriKind.Absolute, out var target) && target.Scheme == "https") await CreateTab(job, target.AbsoluteUri, true);
        };
        view.Source = new Uri(url); if (active) _tabs.SelectedTab = page;
        return tab;
    }
    private void CloseSelected()
    {
        if (_tabs.SelectedIndex <= 0) return;
        var tab = _browser.Values.FirstOrDefault(item => item.Page == _tabs.SelectedTab);
        if (tab == null) return; _browser.Remove(tab.Id); _tabs.TabPages.Remove(tab.Page); tab.View.Dispose(); tab.Page.Dispose();
    }
    private object TabInfo(BrowserTab tab) => new {id = tab.Id, windowId = 1, groupId = tab.Group,
        url = tab.View.Source?.AbsoluteUri ?? "about:blank", status = tab.Loaded ? "complete" : "loading"};
    private async Task<object> BrowserCommand(JsonElement input)
    {
        string operation = String(input, "operation"); var job = RequireJob(String(input, "taskId"));
        if (operation is "permission_contains" or "permission_request")
        {
            var origins = input.GetProperty("origins").EnumerateArray().Select(item => item.GetString() ?? "").ToArray();
            if (origins.Length != 1 || !origins[0].EndsWith("/*", StringComparison.Ordinal)) throw new ArgumentException("Choose one exact HTTPS site");
            string origin = new Uri(Https(origins[0][..^1])).GetLeftPart(UriPartial.Authority);
            if (origins[0] != origin + "/*") throw new ArgumentException("Wildcard hosts are not supported");
            string key = job.Company + ":" + job.Id + ":" + origin;
            if (operation == "permission_request" && !_grants.Contains(key) && MessageBox.Show(this,
                "Allow GIZE to read and interact with " + origin + " for this job?", "GIZE site access", MessageBoxButtons.YesNo, MessageBoxIcon.Question) == DialogResult.Yes) _grants.Add(key);
            return _grants.Contains(key);
        }
        if (operation == "tabs_create") return TabInfo(await CreateTab(job, String(input, "url"), !input.TryGetProperty("active", out var active) || active.GetBoolean()));
        if (operation == "tabs_query") return _browser.Values.Where(tab => tab.Job.Id == job.Id).Select(TabInfo).ToArray();
        if (operation == "tabs_group")
        {
            int group = input.TryGetProperty("groupId", out var groupId) ? groupId.GetInt32() : _nextGroup++;
            foreach (var id in input.GetProperty("tabIds").EnumerateArray()) RequireTab(job, id.GetInt32()).Group = group;
            _groups.TryAdd(group, "Job " + job.Id[..6]); return group;
        }
        if (operation == "groups_update") {int group = input.GetProperty("groupId").GetInt32(); _groups[group] = String(input, "title"); return new {id = group};}
        int tabId = input.GetProperty("tabId").GetInt32(); var selected = RequireTab(job, tabId);
        if (operation == "tabs_get") return TabInfo(selected);
        if (operation == "tabs_update") {if (input.TryGetProperty("url", out var address)) selected.View.Source = new Uri(Https(address.GetString() ?? "")); _tabs.SelectedTab = selected.Page; return TabInfo(selected);}
        if (operation == "tabs_remove") {_browser.Remove(tabId); _tabs.TabPages.Remove(selected.Page); selected.View.Dispose(); selected.Page.Dispose(); return true;}
        if (operation == "script")
        {
            string kind = String(input, "kind"); if (kind is not ("pageOperation" or "inspectPage")) throw new ArgumentException("Unknown browser adapter");
            string origin = selected.View.Source!.GetLeftPart(UriPartial.Authority);
            if (!_grants.Contains(job.Company + ":" + job.Id + ":" + origin)) throw new ArgumentException("Site access has not been granted for this job");
            var data = input.GetProperty("input"); if (String(data, "origin") != origin) throw new ArgumentException("Page moved outside reviewed origin");
            string source = File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "assets", "browser-workflow.js"));
            int start = source.IndexOf("  function " + kind + "(input) {", StringComparison.Ordinal);
            int end = start < 0 ? -1 : source.IndexOf("\n  }", start, StringComparison.Ordinal);
            if (start < 0 || end < 0) throw new InvalidOperationException("Packaged browser adapter is missing");
            string function = source.Substring(start, end + 4 - start);
            string result = await selected.View.CoreWebView2.ExecuteScriptAsync("(" + function + ")(" + data.GetRawText() + ")");
            using var parsed = JsonDocument.Parse(result);
            return new[] {new {frameId = 0, result = parsed.RootElement.Clone()}};
        }
        throw new ArgumentException("Unknown browser operation");
    }
    private BrowserTab RequireTab(Job job, int id) => _browser.TryGetValue(id, out var tab) && tab.Job.Id == job.Id && tab.Job.Company == job.Company ? tab : throw new ArgumentException("Tab is not owned by this job");
    private static string String(JsonElement value, string key) => value.ValueKind == JsonValueKind.Object && value.TryGetProperty(key, out var field) && field.ValueKind == JsonValueKind.String ? field.GetString() ?? "" : "";
}
