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
        var vaultLock = new ToolStripButton("Unlock saved logins");
        vaultLock.Click += (_, _) => {
            if (JobCredentialVault.IsLocked) {
                if (MessageBox.Show(this, "Allow saved-login access for this GIZE app session? This is session consent, not Windows identity verification.",
                    "GIZE saved logins", MessageBoxButtons.OKCancel) != DialogResult.OK) return;
                JobCredentialVault.Unlock(); vaultLock.Text = "Lock saved logins";
            } else {JobCredentialVault.Lock(); vaultLock.Text = "Unlock saved logins";}
        };
        _toolbar.Items.Add(vaultLock);
        var saveLogin = new ToolStripButton("Save login"); saveLogin.Click += (_, _) => SaveLogin(); _toolbar.Items.Add(saveLogin);
        var fillLogin = new ToolStripButton("Use saved login"); fillLogin.Click += async (_, _) => await FillLogin(); _toolbar.Items.Add(fillLogin);
        var forgetLogin = new ToolStripButton("Forget login"); forgetLogin.Click += (_, _) => ForgetLogin(); _toolbar.Items.Add(forgetLogin);
        Controls.Add(_tabs); Controls.Add(_toolbar); _toolbar.Dock = DockStyle.Top;
        Shown += async (_, _) => {await Initialize(); if (_smoke) await Smoke();};
        Microsoft.Win32.SystemEvents.SessionSwitch += OnCredentialSessionSwitch;
        FormClosed += (_, _) => {Microsoft.Win32.SystemEvents.SessionSwitch -= OnCredentialSessionSwitch; JobCredentialVault.Lock(); _controller.Dispose(); foreach (var tab in _browser.Values) tab.View.Dispose(); _workspace?.Dispose();};
    }
    private BrowserTab LoginTab()
    {
        var tab = _browser.Values.FirstOrDefault(item => item.Page == _tabs.SelectedTab);
        if (tab?.View.Source == null) throw new ArgumentException("Open a job's website tab first");
        _ = Https(tab.View.Source.AbsoluteUri); return tab;
    }
    private void SaveLogin()
    {
        try
        {
            var tab = LoginTab(); var site = tab.View.Source!;
            long saveConsent = JobCredentialVault.CaptureConsent();
            using var dialog = new Form {Text = "Save login for this job", Width = 510, Height = 270, StartPosition = FormStartPosition.CenterParent};
            var notice = new Label {Text = "Windows Credential Manager - job " + tab.Job.Id[..6] + "\n" + site.GetLeftPart(UriPartial.Authority), Left = 16, Top = 16, Width = 470, Height = 44};
            var username = new TextBox {Left = 16, Top = 72, Width = 460, PlaceholderText = "Username or email", AccessibleName = "Saved login username"};
            var password = new TextBox {Left = 16, Top = 112, Width = 460, UseSystemPasswordChar = true, PlaceholderText = "Password", AccessibleName = "Saved login password"};
            var save = new Button {Text = "Save securely", Left = 16, Top = 160, Width = 140, DialogResult = DialogResult.OK};
            var cancel = new Button {Text = "Cancel", Left = 170, Top = 160, Width = 100, DialogResult = DialogResult.Cancel};
            dialog.Controls.AddRange(new Control[] {notice, username, password, save, cancel}); dialog.AcceptButton = save; dialog.CancelButton = cancel;
            if (dialog.ShowDialog(this) == DialogResult.OK) JobCredentialVault.Save(tab.Job.Company, tab.Job.Id, site, username.Text, password.Text, saveConsent);
            password.Clear();
        }
        catch (Exception error) when (error is ArgumentException or InvalidOperationException or System.ComponentModel.Win32Exception)
        {MessageBox.Show(this, error is ArgumentException ? error.Message : "Windows could not save this login", "GIZE saved login");}
    }
    private async Task FillLogin()
    {
        try
        {
            var tab = LoginTab(); var site = tab.View.Source!;
            long fillConsent = JobCredentialVault.CaptureConsent();
            var saved = JobCredentialVault.Load(tab.Job.Company, tab.Job.Id, site);
            if (saved == null) throw new ArgumentException("No saved login for this job and exact website");
            string data = JsonSerializer.Serialize(new {origin = site.GetLeftPart(UriPartial.Authority), username = saved.Value.Username, password = saved.Value.Password});
            string script = "((data)=>{if(location.origin!==data.origin)return false;" + AutofillVisibility +
                "const p=[...document.querySelectorAll('input[type=password]')].filter(visible);" +
                "const u=[...document.querySelectorAll('input[type=email],input[autocomplete=username]')].filter(visible);" +
                "if(p.length!==1||u.length!==1)return false;const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;" +
                "set.call(u[0],data.username);u[0].dispatchEvent(new Event('input',{bubbles:true}));" +
                "set.call(p[0],data.password);p[0].dispatchEvent(new Event('input',{bubbles:true}));return true;})(" + data + ")";
            string result = await JobCredentialVault.Dispatch(fillConsent, () => tab.View.CoreWebView2.ExecuteScriptAsync(script));
            if (result != "true") throw new ArgumentException("This page needs manual login. GIZE fills only one visible username/email and password pair; it never submits the form.");
        }
        catch (Exception error) when (error is ArgumentException or InvalidOperationException or System.ComponentModel.Win32Exception or System.Runtime.InteropServices.COMException)
        {MessageBox.Show(this, error is ArgumentException ? error.Message : "Windows could not use this saved login", "GIZE saved login");}
    }
    private void ForgetLogin()
    {
        try {var tab = LoginTab(); JobCredentialVault.Remove(tab.Job.Company, tab.Job.Id, tab.View.Source!);}
        catch (Exception error) when (error is ArgumentException or InvalidOperationException or System.ComponentModel.Win32Exception)
        {MessageBox.Show(this, error is ArgumentException ? error.Message : "Windows could not remove this saved login", "GIZE saved login");}
    }
    private const string AutofillVisibility = "const visible=e=>{const s=getComputedStyle(e);return e.isConnected&&!e.disabled&&!e.readOnly&&!e.closest('[inert],[hidden],[aria-hidden=true]')&&s.visibility!=='hidden'&&s.visibility!=='collapse'&&s.display!=='none'&&e.getClientRects().length>0;};";
    private static void OnCredentialSessionSwitch(object? sender, Microsoft.Win32.SessionSwitchEventArgs args)
    {
        // Revoke app-session consent on every Windows session transition.
        JobCredentialVault.Lock();
    }
    private async Task Smoke()
    {
        try
        {
            if (_workspace?.CoreWebView2 == null) throw new InvalidOperationException("workspace_not_initialized");
            foreach (string deniedUrl in new[] {
                "https://gize.local:8443/home.html", "https://user@gize.local/home.html",
                "http://gize.local/home.html", "https://example.com/home.html",
                "https://gize.local/other.html"})
                if (WorkspaceUrl(deniedUrl)) throw new InvalidOperationException("workspace_url_boundary_failed");
            if (!WorkspaceUrl("https://gize.local/home.html"))
                throw new InvalidOperationException("workspace_url_positive_failed");
            if (_workspace.CoreWebView2.Profile.IsGeneralAutofillEnabled ||
                _workspace.CoreWebView2.Profile.IsPasswordAutosaveEnabled)
                throw new InvalidOperationException("workspace_autofill_enabled");
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
            JobCredentialVault.Unlock(); // Synthetic scope tests explicitly enroll this test session.
            foreach (var scope in new[] {
                (Company: "synthetic\n", Order: new string('a', 32), Site: "https://example.com/"),
                (Company: "synthetic", Order: new string('a', 32) + "\n", Site: "https://example.com/"),
                (Company: "synthetic", Order: new string('a', 32), Site: "http://example.com/"),
                (Company: "synthetic", Order: new string('a', 32), Site: "https://example.com:8443/"),
                (Company: "synthetic", Order: new string('a', 32), Site: "https://user@example.com/")})
            {
                bool deniedScope = false;
                try {JobCredentialVault.Load(scope.Company, scope.Order, new Uri(scope.Site));}
                catch (ArgumentException) {deniedScope = true;}
                if (!deniedScope) throw new InvalidOperationException("invalid_credential_scope_accepted");
            }
            foreach (var malformed in new[] {
                (Size: 0u, Blob: new IntPtr(1), User: "synthetic"),
                (Size: 3u, Blob: new IntPtr(1), User: "synthetic"),
                (Size: 4002u, Blob: new IntPtr(1), User: "synthetic"),
                (Size: 2u, Blob: IntPtr.Zero, User: "synthetic"),
                (Size: 2u, Blob: new IntPtr(1), User: "")})
            {
                bool rejectedRecord = false;
                try {JobCredentialVault.ValidateRecord(malformed.Size, malformed.Blob, malformed.User);}
                catch (InvalidOperationException) {rejectedRecord = true;}
                if (!rejectedRecord) throw new InvalidOperationException("malformed_vault_record_accepted");
            }
            if (await _workspace.CoreWebView2.ExecuteScriptAsync("(()=>{" + AutofillVisibility + "const box=document.createElement('div');document.body.append(box);try{const e=document.createElement('input');box.append(e);if(!visible(e))return false;for(const attr of ['hidden','inert','aria-hidden']){box.setAttribute(attr,'true');if(visible(e))return false;box.removeAttribute(attr);}e.readOnly=true;if(visible(e))return false;e.readOnly=false;e.disabled=true;if(visible(e))return false;e.disabled=false;for(const value of ['hidden','collapse']){e.style.visibility=value;if(visible(e))return false;}e.style.visibility='visible';e.style.display='none';if(visible(e))return false;e.style.display='block';e.remove();return !visible(e);}finally{box.remove();}})()") != "true")
                throw new InvalidOperationException("autofill_dom_denial_failed");
            JobCredentialVault.Lock();
            JobCredentialVault.Unlock();
            OnCredentialSessionSwitch(null, new Microsoft.Win32.SessionSwitchEventArgs(Microsoft.Win32.SessionSwitchReason.SessionLock));
            if (!JobCredentialVault.IsLocked) throw new InvalidOperationException("session_transition_did_not_lock_vault");
            bool lockedLoadDenied = false, lockedSaveDenied = false;
            try {JobCredentialVault.Load("synthetic", new string('a',32), new Uri("https://example.com/"));}
            catch (InvalidOperationException) {lockedLoadDenied = true;}
            try {JobCredentialVault.Save("synthetic", new string('a',32), new Uri("https://example.com/"), "synthetic", "synthetic");}
            catch (InvalidOperationException) {lockedSaveDenied = true;}
            if (!lockedLoadDenied || !lockedSaveDenied) throw new InvalidOperationException("locked_vault_access");
            JobCredentialVault.Unlock();
            long leaseNow = 100;
            var testLease = new JobCredentialVault.SessionLease(() => leaseNow);
            if (!testLease.IsLocked) throw new InvalidOperationException("lease_not_initially_locked");
            testLease.Unlock(); leaseNow += 299999;
            if (testLease.IsLocked) throw new InvalidOperationException("lease_expired_early");
            leaseNow++;
            if (!testLease.IsLocked) throw new InvalidOperationException("lease_boundary_not_expired");
            leaseNow = 100;
            if (!testLease.IsLocked) throw new InvalidOperationException("expired_lease_reopened");
            testLease.Unlock(); leaseNow--;
            if (!testLease.IsLocked) throw new InvalidOperationException("backward_clock_not_denied");
            long concurrentTicks = 0;
            var concurrentLease = new JobCredentialVault.SessionLease(() => Interlocked.Read(ref concurrentTicks));
            concurrentLease.Unlock(); Interlocked.Exchange(ref concurrentTicks, 300000);
            int expiredAccess = 0;
            Parallel.For(0, 256, _ => {if (!concurrentLease.IsLocked) Interlocked.Increment(ref expiredAccess);});
            if (expiredAccess != 0) throw new InvalidOperationException("concurrent_expired_consent");
            concurrentLease.Unlock();
            Task.Run(() => concurrentLease.Lock()).GetAwaiter().GetResult();
            Parallel.For(0, 256, _ => {if (!concurrentLease.IsLocked) Interlocked.Increment(ref expiredAccess);});
            if (expiredAccess != 0) throw new InvalidOperationException("cross_thread_lock_not_observed");
            concurrentLease.Unlock();
            long staleConsent = concurrentLease.Capture();
            concurrentLease.Lock(); concurrentLease.Unlock();
            bool staleDenied = false;
            try {concurrentLease.Validate(staleConsent);} catch (InvalidOperationException) {staleDenied = true;}
            if (!staleDenied) throw new InvalidOperationException("revoked_consent_reused_after_unlock");
            bool dispatchedRevoked = false, dispatchDenied = false;
            try {concurrentLease.Dispatch(staleConsent, () => {dispatchedRevoked = true; return true;});}
            catch (InvalidOperationException) {dispatchDenied = true;}
            if (!dispatchDenied || dispatchedRevoked) throw new InvalidOperationException("revoked_broker_dispatch");
            if (!concurrentLease.Dispatch(concurrentLease.Capture(), () => true))
                throw new InvalidOperationException("fresh_broker_dispatch_failed");
            concurrentLease.Validate(concurrentLease.Capture());
            var vaultSite = new Uri("https://example.com/");
            long staleSave = JobCredentialVault.CaptureConsent();
            JobCredentialVault.Lock(); JobCredentialVault.Unlock();
            bool saveDenied = false;
            try {JobCredentialVault.Save("synthetic", id, vaultSite, "synthetic", "synthetic", staleSave);}
            catch (InvalidOperationException) {saveDenied = true;}
            if (!saveDenied || JobCredentialVault.Load("synthetic", id, vaultSite) != null)
                throw new InvalidOperationException("revoked_save_persisted");

            try
            {
                JobCredentialVault.Save("synthetic", id, vaultSite, "synthetic-user", "synthetic-password");
                if (JobCredentialVault.Load("synthetic", id, vaultSite)?.Password != "synthetic-password" ||
                    JobCredentialVault.Load("synthetic", new string('b', 32), vaultSite) != null ||
                    JobCredentialVault.Load("other-company", id, vaultSite) != null ||
                    JobCredentialVault.Load("synthetic", id, new Uri("https://example.org/")) != null)
                    throw new InvalidOperationException("credential_vault_scope_failed");
                JobCredentialVault.Save("synthetic", id, vaultSite, "synthetic-rotated-user", "synthetic-rotated-password");
                var rotatedCredential = JobCredentialVault.Load("synthetic", id, vaultSite);
                if (rotatedCredential?.Username != "synthetic-rotated-user" ||
                    rotatedCredential?.Password != "synthetic-rotated-password")
                    throw new InvalidOperationException("credential_vault_rotation_failed");

            }
            finally {JobCredentialVault.Remove("synthetic", id, vaultSite);}
            if (JobCredentialVault.Load("synthetic", id, vaultSite) != null)
                throw new InvalidOperationException("credential_vault_revocation_failed");
            JobCredentialVault.Remove("synthetic", id, vaultSite); // Repeated deletion is safe.
            var first = await CreateTab(RequireJob(id), "https://example.com/", false);
            var secondJob = JsonSerializer.SerializeToElement(await AppCommand(JsonSerializer.SerializeToElement(new {
                command = "create_order", companyId = "synthetic", instruction = "Separate synthetic job"})), _json);
            var second = await CreateTab(RequireJob(String(secondJob, "taskId")), "https://example.com/", false);
            if (first.View.CoreWebView2.Environment.UserDataFolder == second.View.CoreWebView2.Environment.UserDataFolder ||
                first.View.CoreWebView2.Settings.IsWebMessageEnabled || second.View.CoreWebView2.Settings.IsWebMessageEnabled)
                throw new InvalidOperationException("provider_profile_or_bridge_isolation_failed");
            foreach (var checkedTab in new[] {first, second})
                if (checkedTab.View.CoreWebView2.Profile.IsGeneralAutofillEnabled ||
                    checkedTab.View.CoreWebView2.Profile.IsPasswordAutosaveEnabled)
                    throw new InvalidOperationException("provider_autofill_enabled");
            bool rejected = false;
            try {RequireTab(first.Job, second.Id);} catch (ArgumentException) {rejected = true;}
            if (!rejected) throw new InvalidOperationException("cross_job_tab_access");
            File.WriteAllText("desktop-smoke-result.json", JsonSerializer.Serialize(new {ok = true,
                packagedWorkspace = true, nativeJobCreation = true, sidebarRendered = true, isolatedProfiles = true,
                providerBridgeDisabled = true, credentialVaultScoped = true, extensionRequired = false, synthetic = true}, _json));
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
            _workspace.CoreWebView2.PermissionRequested += (_, args) => args.State = CoreWebView2PermissionState.Deny;
            _workspace.CoreWebView2.Profile.IsGeneralAutofillEnabled = false;
            _workspace.CoreWebView2.Profile.IsPasswordAutosaveEnabled = false;
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
        uri.Scheme == "https" && uri.Host == "gize.local" && uri.IsDefaultPort &&
        string.IsNullOrEmpty(uri.UserInfo) && uri.AbsolutePath == "/home.html";
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
        view.CoreWebView2.PermissionRequested += (_, args) => args.State = CoreWebView2PermissionState.Deny;
        view.CoreWebView2.Profile.IsGeneralAutofillEnabled = false;
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
