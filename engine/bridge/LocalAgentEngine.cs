using System.Diagnostics;
using System.Net;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Data.Sqlite;

namespace TheOrg.Bridge;

// Preview-only local execution. Tool catalog is intentionally closed, user plans require approval.
// Chrome Native Messaging launches a fresh process per request: all job state lives in SQLite.
internal sealed class LocalAgentEngine
{
    private static readonly Regex Company = new("^[a-z0-9_-]{1,40}$",RegexOptions.Compiled);
    private static readonly Regex Id = new("^[a-f0-9]{32}$",RegexOptions.Compiled);
    private static readonly Regex ModelName = new("^[a-zA-Z0-9][a-zA-Z0-9_./:-]{0,79}$",RegexOptions.Compiled);
    private static readonly Regex FileName = new(@"^[a-zA-Z0-9_-]{1,70}\.md$",RegexOptions.Compiled);
    private readonly string _root;
    private readonly string _dbPath;
    private static readonly JsonSerializerOptions Options = new()
    {
        PropertyNamingPolicy=JsonNamingPolicy.CamelCase,PropertyNameCaseInsensitive=true
    };
    private const int MaxSteps = 5;

    internal LocalAgentEngine(string root)
    {
        _root = Path.GetFullPath(root);
        Directory.CreateDirectory(_root);
        _dbPath = Path.Combine(_root,"agent-jobs.sqlite");
        using var db = Open();
        Exec(db,@"CREATE TABLE IF NOT EXISTS agent_jobs (
          id TEXT PRIMARY KEY, company TEXT NOT NULL, order_id TEXT NOT NULL,
          instruction TEXT NOT NULL, mode TEXT NOT NULL, model TEXT NOT NULL,
          approved_hosts TEXT NOT NULL, plan_json TEXT NOT NULL,
          status TEXT NOT NULL, step_index INTEGER NOT NULL DEFAULT 0,
          step_token TEXT, qa_json TEXT, created_utc TEXT NOT NULL, updated_utc TEXT NOT NULL);
          CREATE INDEX IF NOT EXISTS idx_agent_jobs_company_order ON agent_jobs(company,order_id);
          CREATE TABLE IF NOT EXISTS agent_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT, job_id TEXT NOT NULL,
          step_index INTEGER NOT NULL, event_type TEXT NOT NULL,
          evidence TEXT NOT NULL, created_utc TEXT NOT NULL);
          CREATE INDEX IF NOT EXISTS idx_agent_events_job ON agent_events(job_id);
          CREATE TABLE IF NOT EXISTS agent_memory (
          company TEXT NOT NULL, memory_key TEXT NOT NULL, value TEXT NOT NULL,
          updated_utc TEXT NOT NULL, PRIMARY KEY(company,memory_key));");
    }

    internal object Execute(JsonElement request)
    {
        var command = Text(request,"command");
        try
        {
            return command switch
            {
                "agent_create" => Create(request),
                "agent_get" => Get(request),
                "agent_list" => List(request),
                "agent_approve" => Approve(request),
                "agent_run_next" => RunNext(request),
                "agent_run_safe_batch" => RunSafeBatch(request),
                "agent_complete_browser" => CompleteBrowser(request),
                "agent_review" => Review(request),
                "agent_cancel" => Cancel(request),
                "agent_recover" => Recover(request),
                "agent_memory_put" => Remember(request),
                "agent_memory_list" => Recall(request),
                "agent_tools" => new {
                    ok=true,
                    toolNames=new[]{"write_note","read_note","list_notes","system_info","browser_open","windows_open_notepad"},
                    catalogVersion="ao.local.tools.v1",
                    mcpEnabled=false,
                    remoteToolExecutionEnabled=false,
                    // This contract is descriptive. It never grants permission on its own;
                    // the server-side approved plan and native allowlist remain authoritative.
                    toolDescriptors=new[] {
                        new {id="write_note",version=1,riskClass="reversible_write",requiresOwnerApproval=true,permissionScope="company_order",execution="native_allowlist",safeBatch=true},
                        new {id="read_note",version=1,riskClass="read_only",requiresOwnerApproval=true,permissionScope="company_order",execution="native_allowlist",safeBatch=true},
                        new {id="list_notes",version=1,riskClass="read_only",requiresOwnerApproval=true,permissionScope="company_order",execution="native_allowlist",safeBatch=true},
                        new {id="system_info",version=1,riskClass="read_only",requiresOwnerApproval=true,permissionScope="local_system_summary",execution="native_allowlist",safeBatch=true},
                        new {id="browser_open",version=1,riskClass="consequential_external",requiresOwnerApproval=true,permissionScope="approved_https_host",execution="browser_navigation_only",safeBatch=false},
                        new {id="windows_open_notepad",version=1,riskClass="consequential_external",requiresOwnerApproval=true,permissionScope="explicit_notepad_launch",execution="native_allowlist",safeBatch=false}
                    },
                    browserLimitations="Navigation only, not site interaction or content extraction",
                    windowsLimitations="Only an explicitly reviewed Notepad launch, not general desktop control"
                },
                _ => new {ok=false,error="unsupported_command"}
            };
        }
        catch (ArgumentException ex) {return new {ok=false,error="invalid_input",detail=ex.Message};}
        catch (InvalidOperationException ex) {return new {ok=false,error="invalid_state",detail=ex.Message};}
        catch (HttpRequestException) {return new {ok=false,error="ollama_unavailable",detail="Install/run Ollama on 127.0.0.1:11434 and pull the selected model"};}
        catch (OperationCanceledException) {return new {ok=false,error="ollama_timeout"};}
        catch (JsonException) {return new {ok=false,error="model_invalid_json"};}
        catch (SqliteException) {return new {ok=false,error="local_queue_error"};}
        catch (IOException) {return new {ok=false,error="local_file_error"};}
        catch (UnauthorizedAccessException) {return new {ok=false,error="access_denied"};}
    }

    internal object Create(JsonElement request)
    {
        string company = RequireCompany(Text(request,"companyId"));
        string order = RequireId(Text(request,"orderId"));
        RequireOrder(company,order);
        string instruction=Text(request,"instruction").Trim();
        if(instruction.Length is < 5 or > 3000) throw new ArgumentException("Instruction must be 5 to 3000 characters");
        string mode=Text(request,"mode");
        if(mode is not ("ollama" or "demo" or "demo-browser" or "demo-notepad")) throw new ArgumentException("Choose ollama or clearly labeled demo");
        string model=Text(request,"model");
        if(!ModelName.IsMatch(model)) throw new ArgumentException("Invalid local Ollama model name");
        string hosts=Text(request,"approvedHosts");
        var approved=ParseHosts(hosts);
        AgentPlan plan=mode=="demo-browser" ? new AgentPlan
        {
            Summary="Synthetic browser navigation test; no site content extraction",
            Steps=new List<AgentStep>{
                new(){Title="Navigate one approved HTTPS site",AgentId="browser",Tool="browser_open",
                    Input=approved.Length>0?"https://"+approved[0]+"/":"https://example.com/",
                    ExpectedOutput="Browser tab navigation request; page contents not independently verified"}
            }
        } : mode=="demo-notepad" ? new AgentPlan
        {
            Summary="Synthetic Windows Notepad launch test only",
            Steps=new List<AgentStep>{
                new(){Title="Start Windows Notepad",AgentId="desktop",Tool="windows_open_notepad",Input="",
                    ExpectedOutput="Notepad process starts; GUI interaction remains unverified"}
            }
        } : mode=="demo" ? new AgentPlan
        {
            Summary="Synthetic local action test, not model reasoning",
            Steps=new List<AgentStep> {
                new(){Title="Write a synthetic test note",AgentId="documents",Tool="write_note",Input="Demo request: "+instruction,ExpectedOutput="An example note with checksum"},
                new(){Title="Inspect local workspace",AgentId="analyst",Tool="list_notes",Input="",ExpectedOutput="List of agent-generated notes"}
            }
        } : GeneratePlan(instruction,model);
        ValidatePlan(plan,approved);
        string jobId=Guid.NewGuid().ToString("N"),utc=DateTimeOffset.UtcNow.ToString("O");
        using var db=Open();
        Exec(db,@"INSERT INTO agent_jobs(id,company,order_id,instruction,mode,model,approved_hosts,plan_json,status,step_index,created_utc,updated_utc)
              VALUES($id,$company,$order,$instruction,$mode,$model,$hosts,$plan,'awaiting_approval',0,$utc,$utc);",
              ("$id",jobId),("$company",company),("$order",order),("$instruction",instruction),
              ("$mode",mode),("$model",model),("$hosts",string.Join(",",approved)),
              ("$plan",JsonSerializer.Serialize(plan,Options)),("$utc",utc));
        Event(db,jobId,-1,"plan_created",JsonSerializer.Serialize(new{mode,agentCount=plan.Steps.Count}));
        return new {ok=true,jobId,status="awaiting_approval",mode,plan,requiresApproval=true};
    }

    internal object Get(JsonElement request)
    {
        var job=Find(request);
        using var db=Open();
        using var query=Command(db,"SELECT step_index,event_type,evidence,created_utc FROM agent_events WHERE job_id=$job ORDER BY id DESC LIMIT 30",("$job",job.Id));
        var events=new List<object>();
        using(var rd=query.ExecuteReader()) while(rd.Read())
        {
            events.Add(new{stepIndex=rd.GetInt32(0),eventType=rd.GetString(1),evidence=rd.GetString(2),createdUtc=rd.GetString(3)});
        }
        return new{ok=true,jobId=job.Id,job.Company,orderId=job.Order,
            job.Instruction,job.Mode,job.Model,job.Status,job.StepIndex,
            job.Plan,job.QaJson,events=events.AsEnumerable().Reverse().ToArray(),
            approvedHosts=job.Hosts,reviewFingerprint=ApprovalFingerprint(job)};
    }
    internal object List(JsonElement request)
    {
        string company=RequireCompany(Text(request,"companyId"));
        using var db=Open();
        using var cmd=Command(db,"SELECT id,order_id,status,mode,step_index,created_utc FROM agent_jobs WHERE company=$company ORDER BY created_utc DESC LIMIT 50",("$company",company));
        var items=new List<object>();
        using var rd=cmd.ExecuteReader();
        while(rd.Read()) items.Add(new{jobId=rd.GetString(0),orderId=rd.GetString(1),status=rd.GetString(2),mode=rd.GetString(3),stepIndex=rd.GetInt32(4),createdUtc=rd.GetString(5)});
        return new{ok=true,jobs=items};
    }
    internal object Approve(JsonElement request)
    {
        var job=Find(request);
        if(job.Status!="awaiting_approval") throw new InvalidOperationException("Only a reviewed proposal may be approved");
        if(!Flag(request,"approved")) throw new ArgumentException("Approval requires explicit owner action");
        // The reviewer must echo the exact snapshot displayed by agent_get.
        // A fingerprint identifies content and scope; it is not an authorization token.
        if(!string.Equals(Text(request,"reviewFingerprint"),ApprovalFingerprint(job),StringComparison.Ordinal))
            throw new InvalidOperationException("Reviewed plan changed or snapshot missing; refresh and review again");
        using var db=Open();
        Exec(db,"BEGIN IMMEDIATE;");
        try
        {
            int approved=Exec(db,"UPDATE agent_jobs SET status='queued',updated_utc=$utc WHERE id=$id AND status='awaiting_approval' AND plan_json=$plan AND approved_hosts=$hosts",
                ("$id",job.Id),("$utc",Now()),("$plan",JsonSerializer.Serialize(job.Plan,Options)),
                ("$hosts",string.Join(",",job.Hosts)));
            if(approved!=1)throw new InvalidOperationException("Plan changed or already approved");
            Event(db,job.Id,-1,"owner_approved",ApprovalFingerprint(job));
            Exec(db,"COMMIT;");
        }
        catch {Exec(db,"ROLLBACK;");throw;}
        return new{ok=true,status="queued",jobId=job.Id};
    }
    internal object RunNext(JsonElement request)
    {
        var job=Find(request);
        if(job.Status!="queued") throw new InvalidOperationException("Job is not queued; recover blocked work manually");
        if(job.StepIndex>=job.Plan.Steps.Count) throw new InvalidOperationException("No steps remain");
        ValidatePlan(job.Plan,job.Hosts);
        var step=job.Plan.Steps[job.StepIndex];
        string token=Guid.NewGuid().ToString("N");
        using(var db=Open())
        {
            Exec(db,"BEGIN IMMEDIATE;");
            try
            {
                RequireApprovedPlan(db,job);
                var count=Exec(db,"UPDATE agent_jobs SET status='running',step_token=$token,updated_utc=$utc WHERE id=$id AND status='queued' AND step_index=$idx AND plan_json=$plan AND approved_hosts=$hosts",
                    ("$id",job.Id),("$idx",job.StepIndex),("$token",token),("$utc",Now()),
                    ("$plan",JsonSerializer.Serialize(job.Plan,Options)),("$hosts",string.Join(",",job.Hosts)));
                if(count!=1)throw new InvalidOperationException("Concurrent execution blocked");
                Event(db,job.Id,job.StepIndex,"step_started",JsonSerializer.Serialize(step,Options));
                Exec(db,"COMMIT;");
            }
            catch {Exec(db,"ROLLBACK;");throw;}
        }
        job=job with {StepToken=token};
        if(step.Tool=="browser_open")
        {
            string url=RequireApprovedUrl(step.Input,job.Hosts);
            return new{ok=true,status="awaiting_browser_navigation",jobId=job.Id,stepIndex=job.StepIndex,token,url,
                note="The extension may open this approved HTTPS URL. Navigation alone does not verify page outcomes."};
        }
        try
        {
            var result=PerformTool(job,step);
            using var db=Open();
            CompleteStep(db,job,JsonSerializer.Serialize(result,Options),"local_action_completed");
            return new{ok=true,status="local_action_completed",jobId=job.Id,stepIndex=job.StepIndex,result};
        }
        catch(Exception ex) when(ex is IOException or UnauthorizedAccessException or InvalidOperationException or ArgumentException or System.ComponentModel.Win32Exception)
        {
            using var db=Open();
            Exec(db,"UPDATE agent_jobs SET status='blocked',updated_utc=$utc WHERE id=$id AND status='running' AND step_token=$token",
                ("$id",job.Id),("$utc",Now()),("$token",job.StepToken));
            Event(db,job.Id,job.StepIndex,"step_blocked",ex.GetType().Name);
            return new{ok=false,error="step_blocked",reason=ex.GetType().Name};
        }
    }
    // A single owner-approved batch executes only closed-catalog local/read-only tools.
    // Browser navigation and desktop launches are intentionally excluded.
    internal object RunSafeBatch(JsonElement request)
    {
        var initial=Find(request);
        if(initial.Status!="queued") throw new InvalidOperationException("Approve the plan before batch execution");
        var receipts=new List<object>();
        while(receipts.Count<MaxSteps)
        {
            var current=Find(request);
            if(current.Status!="queued"||current.StepIndex>=current.Plan.Steps.Count) break;
            string tool=current.Plan.Steps[current.StepIndex].Tool;
            if(tool is not ("write_note" or "read_note" or "list_notes" or "system_info")) break;
            receipts.Add(RunNext(request));
            if(Find(request).Status!="queued") break;
        }
        var final=Find(request);
        bool separateAction=final.Status=="queued"&&final.StepIndex<final.Plan.Steps.Count;
        return new {ok=final.Status!="blocked",jobId=final.Id,status=final.Status,
            executedSteps=receipts.Count,receipts,requiresSeparateAction=separateAction,
            note="Only previously approved local notes and read-only tools were run; browser and desktop actions require separate execution."};
    }

    internal object CompleteBrowser(JsonElement request)
    {
        var job=Find(request);
        if(job.Status!="running"||job.StepIndex>=job.Plan.Steps.Count)
            throw new InvalidOperationException("No active browser step");
        var step=job.Plan.Steps[job.StepIndex];
        if(step.Tool!="browser_open"||!FixedEqual(job.StepToken,Text(request,"token")))
            throw new ArgumentException("Invalid browser completion token");
        using(var approvalDb=Open()) RequireApprovedPlan(approvalDb,job);
        string expected=RequireApprovedUrl(step.Input,job.Hosts);
        string observed=RequireApprovedUrl(Text(request,"url"),job.Hosts);
        if(!string.Equals(expected,observed,StringComparison.Ordinal))
            throw new ArgumentException("Browser URL mismatch");
        long tabId=Number(request,"tabId");
        if(tabId<=0)throw new ArgumentException("Browser tab evidence missing");
        using var db=Open();
        CompleteStep(db,job,JsonSerializer.Serialize(new{requestedUrl=expected,tabId,verifiedPageContents=false}),"browser_navigation_requested");
        return new{ok=true,status="navigation_recorded",verifiedPageContents=false};
    }
    internal object Cancel(JsonElement request)
    {
        var job=Find(request);
        if(job.Status=="running")throw new InvalidOperationException("Active step unknown; use recover and review");
        if(job.Status=="cancelled")return new{ok=true,status="cancelled"};
        using var db=Open();
        Exec(db,"UPDATE agent_jobs SET status='cancelled',updated_utc=$utc WHERE id=$id",
            ("$id",job.Id),("$utc",Now()));
        Event(db,job.Id,job.StepIndex,"owner_cancelled","No further execution");
        return new{ok=true,status="cancelled"};
    }
    internal object Recover(JsonElement request)
    {
        var job=Find(request);
        using var db=Open();
        if(job.Status=="running")
        {
            Exec(db,"BEGIN IMMEDIATE;");
            try
            {
                int changed=Exec(db,@"UPDATE agent_jobs SET status='blocked',step_token=NULL,updated_utc=$utc
                    WHERE id=$id AND company=$company AND status='running' AND step_index=$idx AND step_token=$token",
                    ("$id",job.Id),("$company",job.Company),("$idx",job.StepIndex),
                    ("$token",job.StepToken),("$utc",Now()));
                if(changed!=1)throw new InvalidOperationException("Job changed during recovery; reload current state");
                Event(db,job.Id,job.StepIndex,"unknown_outcome",
                    "A prior process ended during a tool step. No automatic replay of non-idempotent actions.");
                Exec(db,"COMMIT;");
            }
            catch {Exec(db,"ROLLBACK;");throw;}
            return new{ok=true,status="blocked",manualReviewRequired=true};
        }
        return new{ok=true,status=job.Status,canResume=job.Status=="queued"};
    }
    internal object Review(JsonElement request)
    {
        var job=Find(request);
        if(job.Status!="completed_pending_review") throw new InvalidOperationException("Run all steps before review");
        using var db=Open();
        using var cmd=Command(db,@"SELECT step_index,event_type,evidence FROM agent_events
            WHERE job_id=$id AND (event_type='local_action_completed' OR event_type='browser_navigation_requested') ORDER BY step_index",("$id",job.Id));
        var evidence=new List<(int Index,string EventType,string Evidence)>();
        using(var rd=cmd.ExecuteReader())while(rd.Read())
            evidence.Add((rd.GetInt32(0),rd.GetString(1),rd.GetString(2)));
        bool verifiedCount=evidence.Count==job.Plan.Steps.Count;
        bool fileIntegrity=true;
        bool browserOutcomeUnknown=false;
        foreach(var row in evidence)
        {
            if(row.EventType=="browser_navigation_requested")
                browserOutcomeUnknown=true;
            else
            {
                var step=job.Plan.Steps[row.Index];
                if(step.Tool=="write_note")
                {
                    using var data=JsonDocument.Parse(row.Evidence);
                    string file=data.RootElement.GetProperty("fileName").GetString() ?? "";
                    string sha=data.RootElement.GetProperty("sha256").GetString() ?? "";
                    var path=Path.Combine(OutputFolder(job),file);
                    if(!File.Exists(path)||
                       !string.Equals(HashOutputBounded(path),sha,StringComparison.OrdinalIgnoreCase))
                        fileIntegrity=false;
                }
            }
        }
        string? assessment=null;
        if(job.Mode=="ollama")
        {
            string evidenceText=string.Join("\n",evidence.Select(x=>x.EventType+": "+x.Evidence).Take(5));
            string prompt="Review this execution evidence skeptically. Do not claim website results or file semantic accuracy without proof. Return ONLY JSON object {\"assessment\":\"...\",\"issues\":[\"...\"]}.";
            try {assessment=Ask(job.Model,prompt,"Instruction: "+job.Instruction+"\nSteps:"+JsonSerializer.Serialize(job.Plan,Options)+"\nEvidence:"+evidenceText);}
            catch(HttpRequestException) {assessment="Local verifier model unavailable; human review remains required.";}
            catch(TaskCanceledException) {assessment="Local verifier model timed out; human review remains required.";}
        }
        string verdict=(!verifiedCount||!fileIntegrity)?"failed_integrity":"human_review_required";
        var qa=new{verdict,verifiedStepCount=evidence.Count,expectedStepCount=job.Plan.Steps.Count,
            fileIntegrity,browserOutcomeUnknown,independentModelCritique=assessment,
            semanticQualityApproved=false,reviewedUtc=Now()};
        Exec(db,"UPDATE agent_jobs SET status=$status,qa_json=$qa,updated_utc=$utc WHERE id=$id",
            ("$status",verdict=="failed_integrity"?"blocked":"review_pending"),
            ("$qa",JsonSerializer.Serialize(qa,Options)),("$utc",Now()),("$id",job.Id));
        Event(db,job.Id,-1,"qa_reviewed",JsonSerializer.Serialize(qa,Options));
        return new{ok=true,qa};
    }
    internal object Remember(JsonElement request)
    {
        string company=RequireCompany(Text(request,"companyId"));
        string key=Text(request,"key").Trim(),value=Text(request,"value").Trim();
        if(!Regex.IsMatch(key,"^[a-zA-Z0-9_-]{1,64}$")||value.Length is < 1 or > 2000)
            throw new ArgumentException("Invalid memory key or value");
        using var db=Open();
        Exec(db,@"INSERT INTO agent_memory(company,memory_key,value,updated_utc)
          VALUES($company,$key,$value,$utc) ON CONFLICT(company,memory_key)
          DO UPDATE SET value=excluded.value,updated_utc=excluded.updated_utc",
          ("$company",company),("$key",key),("$value",value),("$utc",Now()));
        return new{ok=true,stored=true,note="Memory is user-supplied data, not trusted tool instructions"};
    }
    internal object Recall(JsonElement request)
    {
        string company=RequireCompany(Text(request,"companyId"));
        using var db=Open();
        using var cmd=Command(db,"SELECT memory_key,value,updated_utc FROM agent_memory WHERE company=$company ORDER BY memory_key LIMIT 100",("$company",company));
        var items=new List<object>();
        using var rd=cmd.ExecuteReader();
        while(rd.Read())items.Add(new{key=rd.GetString(0),value=rd.GetString(1),updatedUtc=rd.GetString(2)});
        return new{ok=true,memories=items};
    }


    // Do not search the current directory or inherited PATH for the reviewed application.
    internal static string NotepadExecutablePath()
    {
        if(!OperatingSystem.IsWindows())throw new InvalidOperationException("Windows Notepad only");
        string systemDirectory=Environment.GetFolderPath(Environment.SpecialFolder.System);
        if(string.IsNullOrWhiteSpace(systemDirectory)||!Path.IsPathFullyQualified(systemDirectory))
            throw new InvalidOperationException("Windows system directory unavailable");
        string executable=Path.Combine(systemDirectory,"notepad.exe");
        if(!File.Exists(executable))throw new InvalidOperationException("Windows system Notepad unavailable");
        return executable;
    }

    private object PerformTool(Job job,AgentStep step)
    {
        if(step.Tool=="write_note")
        {
            string name="agent-"+job.Id+"-"+(job.StepIndex+1).ToString("D2")+".md";
            string path=Path.Combine(OutputFolder(job),name);
            byte[] data=Encoding.UTF8.GetBytes(step.Input);
            if(data.Length>16000)throw new ArgumentException("Note exceeds 16 KiB");
            using(var file=new FileStream(path,FileMode.CreateNew,FileAccess.Write,FileShare.None))
                file.Write(data);
            return new{fileName=name,bytes=data.Length,sha256=Convert.ToHexString(SHA256.HashData(data)),contentIsModelGenerated=job.Mode=="ollama",semanticQA=false};
        }
        if(step.Tool=="read_note")
        {
            if(!FileName.IsMatch(step.Input))throw new ArgumentException("Read only named agent notes");
            string path=Path.Combine(OutputFolder(job),step.Input);
            if(!File.Exists(path)||new FileInfo(path).Length>32768)
                throw new ArgumentException("Note missing or too large");
            return new{fileName=step.Input,content=ReadNoteBounded(path)};
        }
        if(step.Tool=="list_notes")
        {
            return new{files=Directory.EnumerateFiles(OutputFolder(job),"agent-*.md")
                .Select(Path.GetFileName).Take(50).ToArray()};
        }
        if(step.Tool=="system_info")
        {
            return new{os=Environment.OSVersion.VersionString,
                machineArchitecture=System.Runtime.InteropServices.RuntimeInformation.OSArchitecture.ToString(),
                processorCount=Environment.ProcessorCount,
                noSensitiveSystemInfo=true};
        }
        if(step.Tool=="windows_open_notepad")
        {
            using var process=Process.Start(new ProcessStartInfo(NotepadExecutablePath())
            {
                UseShellExecute=false,CreateNoWindow=false
            }) ?? throw new InvalidOperationException("Notepad did not start");
            return new{processId=process.Id,application="notepad.exe",automationScope="launch_only",
                appInteractionVerified=false};
        }
        throw new ArgumentException("Unsupported local tool");
    }
    private void CompleteStep(SqliteConnection db,Job job,string evidence,string eventType)
    {
        int next=job.StepIndex+1;
        string status=next>=job.Plan.Steps.Count?"completed_pending_review":"queued";
        int changed=Exec(db,"UPDATE agent_jobs SET status=$status,step_index=$idx,step_token=NULL,updated_utc=$utc WHERE id=$id AND status='running' AND step_index=$previous AND step_token=$token",
            ("$status",status),("$idx",next),("$utc",Now()),("$id",job.Id),("$previous",job.StepIndex),("$token",job.StepToken));
        if(changed!=1)throw new InvalidOperationException("Stale or replayed step completion");
        Event(db,job.Id,job.StepIndex,eventType,evidence);
    }
    private AgentPlan GeneratePlan(string instruction,string model)
    {
        string system=@"You are a local Windows workflow planner. Return ONLY a strict JSON object with
        {""summary"":string,""steps"":[{""title"":string,""agentId"":string,""tool"":string,""input"":string,""expectedOutput"":string}]}.
        No more than five steps. Allowed agentId values: supervisor,planner,researcher,browser,desktop,developer,analyst,documents,communications,integrations,qa_auditor,security_officer. Allowed tool names: write_note,read_note,list_notes,system_info,browser_open,windows_open_notepad.
        You are planning only, not executing. write_note creates a text file with the exact input as its content,
        and cannot conduct research. read_note may only use known agent note filenames. browser_open navigates to one
        HTTPS URL and cannot read or interact with the page. windows_open_notepad only starts Notepad.
        Avoid suggesting unavailable actions. Do not claim real-world tasks or research completed.
        Browser actions and application launches require the owner to review and approve the entire plan.";
        using var payload=JsonDocument.Parse(Ask(model,system,instruction));
        ValidatePlanJson(payload.RootElement);
        var plan=JsonSerializer.Deserialize<AgentPlan>(payload.RootElement.GetRawText(),Options)
            ?? throw new JsonException("Missing plan");
        return plan;
    }
    internal const int MaxModelResponseBytes = 512 * 1024;
    private static string Ask(string model,string system,string user)
    {
        // Local model traffic must never inherit a proxy or follow a redirect off loopback.
        using var http = new HttpClient(new HttpClientHandler {
            UseProxy=false, AllowAutoRedirect=false
        }) {Timeout=Timeout.InfiniteTimeSpan};
        using var deadline=new CancellationTokenSource(TimeSpan.FromSeconds(65));
        var payload=new{model,stream=false,format="json",messages=new[]{
            new{role="system",content=system},new{role="user",content=user}}};
        using var request=new HttpRequestMessage(HttpMethod.Post,"http://127.0.0.1:11434/api/chat");
        request.Content=new StringContent(JsonSerializer.Serialize(payload),Encoding.UTF8,"application/json");
        using var res=http.SendAsync(request,HttpCompletionOption.ResponseHeadersRead,deadline.Token)
            .GetAwaiter().GetResult();
        return ReadLocalModelReply(res,deadline.Token);
    }

    // Shared bounded decoder; tests use synthetic HTTP responses, never claim real inference.
    internal static string ReadLocalModelReply(HttpResponseMessage response,CancellationToken cancellation)
    {
        cancellation.ThrowIfCancellationRequested();
        response.EnsureSuccessStatusCode();
        if(response.Content.Headers.ContentLength is long length && length>MaxModelResponseBytes)
            throw new HttpRequestException("Local model response exceeds 512 KiB");
        using var stream=response.Content.ReadAsStreamAsync(cancellation).GetAwaiter().GetResult();
        using var bytes=new MemoryStream();
        var buffer=new byte[8192];
        while(true)
        {
            // Read at most one excess byte to detect unknown-length/chunked overflow.
            int remaining=MaxModelResponseBytes+1-checked((int)bytes.Length);
            int count=stream.ReadAsync(buffer.AsMemory(0,Math.Min(buffer.Length,remaining)),cancellation)
                .AsTask().GetAwaiter().GetResult();
            if(count==0)break;
            if(bytes.Length+count>MaxModelResponseBytes)
                throw new HttpRequestException("Local model response exceeds 512 KiB");
            bytes.Write(buffer,0,count);
        }
        cancellation.ThrowIfCancellationRequested();
        using var parsed=JsonDocument.Parse(bytes.ToArray());
        var root=parsed.RootElement;
        if(root.ValueKind!=JsonValueKind.Object ||
           !root.TryGetProperty("message",out var message) || message.ValueKind!=JsonValueKind.Object ||
           !message.TryGetProperty("content",out var content) || content.ValueKind!=JsonValueKind.String ||
           string.IsNullOrWhiteSpace(content.GetString()))
            throw new JsonException("Invalid or empty local model output");
        return content.GetString()!;
    }

    // Enforce the same closed schema for model output and persisted plans.
    internal static void ValidatePlanJson(JsonElement plan)
    {
        RequireFields(plan,new[]{"summary","steps"});
        if(plan.GetProperty("summary").ValueKind!=JsonValueKind.String ||
           plan.GetProperty("steps").ValueKind!=JsonValueKind.Array)
            throw new ArgumentException("Invalid plan schema");
        foreach(var step in plan.GetProperty("steps").EnumerateArray())
        {
            RequireFields(step,new[]{"title","agentId","tool","input","expectedOutput"});
            foreach(var property in step.EnumerateObject())
                if(property.Value.ValueKind!=JsonValueKind.String)
                    throw new ArgumentException("Plan fields must be strings");
        }
    }
    private static void RequireFields(JsonElement value,string[] fields)
    {
        if(value.ValueKind!=JsonValueKind.Object)throw new ArgumentException("Expected plan object");
        var seen=new HashSet<string>(StringComparer.Ordinal);
        foreach(var property in value.EnumerateObject())
            if(!fields.Contains(property.Name,StringComparer.Ordinal)||!seen.Add(property.Name))
                throw new ArgumentException("Unknown or duplicate plan field");
        if(seen.Count!=fields.Length)throw new ArgumentException("Missing plan field");
    }
    private static string ApprovalFingerprint(Job job) =>
        "plan-v1:"+Convert.ToHexString(SHA256.HashData(JsonSerializer.SerializeToUtf8Bytes(
            new {job.Id,job.Company,job.Order,job.Plan,job.Hosts},Options)));

    private static void RequireApprovedPlan(SqliteConnection db,Job job)
    {
        using var cmd=Command(db,
            "SELECT evidence FROM agent_events WHERE job_id=$id AND event_type='owner_approved' ORDER BY id DESC LIMIT 1",
            ("$id",job.Id));
        string evidence=cmd.ExecuteScalar() as string ?? "";
        if(!string.Equals(evidence,ApprovalFingerprint(job),StringComparison.Ordinal))
            throw new InvalidOperationException("Plan or scope changed; create and approve a fresh plan");
    }

    private void ValidatePlan(AgentPlan plan,string[] approved)
    {
        if(plan.Summary.Length is < 4 or > 600||plan.Steps.Count is < 1 or > MaxSteps)
            throw new ArgumentException("Plan summary or step count invalid");
        string[] supported={"write_note","read_note","list_notes","system_info","browser_open","windows_open_notepad"};
        string[] agents={"supervisor","planner","researcher","browser","desktop","developer","analyst","documents","communications","integrations","qa_auditor","security_officer"};
        foreach(var step in plan.Steps)
        {
            if(!supported.Contains(step.Tool)||!agents.Contains(step.AgentId)||step.Title.Length is < 4 or > 130
               ||step.Input.Length>16000||step.ExpectedOutput.Length is < 4 or > 450)
                throw new ArgumentException("Invalid or unsupported agent step");
            if(step.Tool=="browser_open") RequireApprovedUrl(step.Input,approved);
            if(step.Tool=="read_note"&&!FileName.IsMatch(step.Input))
                throw new ArgumentException("Invalid local read target");
            if(step.Tool=="windows_open_notepad"&&step.Input.Length>0)
                throw new ArgumentException("Notepad tool has no command arguments");
        }
    }
    private string OutputFolder(Job job)
    {
        string folder=Path.Combine(_root,"companies",job.Company,"orders",job.Order,"agent_outputs");
        Directory.CreateDirectory(folder);
        return folder;
    }
    private void RequireOrder(string company,string order)
    {
        if(!File.Exists(Path.Combine(_root,"companies",company,"orders",order,"order.json")))
            throw new ArgumentException("Create the work order before running agents");
    }
    private Job Find(JsonElement request)
    {
        string company=RequireCompany(Text(request,"companyId"));
        string id=RequireId(Text(request,"jobId"));
        using var db=Open();
        using var cmd=Command(db,@"SELECT id,company,order_id,instruction,mode,model,approved_hosts,plan_json,status,step_index,
         COALESCE(step_token,''),COALESCE(qa_json,'') FROM agent_jobs WHERE id=$id AND company=$company",
         ("$id",id),("$company",company));
        using var rd=cmd.ExecuteReader();
        if(!rd.Read())throw new ArgumentException("Unknown job in company workspace");
        using var storedPlan=JsonDocument.Parse(rd.GetString(7));
        ValidatePlanJson(storedPlan.RootElement);
        var plan=JsonSerializer.Deserialize<AgentPlan>(rd.GetString(7),Options)
            ?? throw new JsonException("Stored plan invalid");
        return new Job(rd.GetString(0),rd.GetString(1),rd.GetString(2),rd.GetString(3),rd.GetString(4),
            rd.GetString(5),rd.GetString(6).Split(',',StringSplitOptions.RemoveEmptyEntries),plan,
            rd.GetString(8),rd.GetInt32(9),rd.GetString(10),rd.GetString(11));
    }
    private SqliteConnection Open()
    {
        var db=new SqliteConnection(new SqliteConnectionStringBuilder{DataSource=_dbPath,Mode=SqliteOpenMode.ReadWriteCreate}.ToString());
        db.Open();
        Exec(db,"PRAGMA busy_timeout=5000;");
        return db;
    }
    private static SqliteCommand Command(SqliteConnection db,string sql,params (string Name,object Value)[] args)
    {
        var cmd=db.CreateCommand();cmd.CommandText=sql;
        foreach(var a in args)cmd.Parameters.AddWithValue(a.Name,a.Value);
        return cmd;
    }
    private static int Exec(SqliteConnection db,string sql,params (string Name,object Value)[] args)
    {
        using var cmd=Command(db,sql,args);return cmd.ExecuteNonQuery();
    }
    private static void Event(SqliteConnection db,string job,int step,string type,string evidence)
    {
        Exec(db,"INSERT INTO agent_events(job_id,step_index,event_type,evidence,created_utc) VALUES($job,$step,$type,$evidence,$utc)",
            ("$job",job),("$step",step),("$type",type),("$evidence",evidence),("$utc",Now()));
    }
    private static string Now()=>DateTimeOffset.UtcNow.ToString("O");
    private static string Text(JsonElement data,string key)=>data.TryGetProperty(key,out var v)&&v.ValueKind==JsonValueKind.String?v.GetString()??"":"";
    private static bool Flag(JsonElement data,string key)=>data.TryGetProperty(key,out var v)&&v.ValueKind==JsonValueKind.True;
    private static long Number(JsonElement data,string key)=>data.TryGetProperty(key,out var v)&&v.ValueKind==JsonValueKind.Number&&v.TryGetInt64(out var n)?n:throw new ArgumentException("Missing numeric input");
    private static string RequireId(string s)=>Id.IsMatch(s)?s:throw new ArgumentException("Invalid identifier");
    private static string RequireCompany(string s)=>Company.IsMatch(s)?s:throw new ArgumentException("Invalid workspace");
    // Browser navigation is only permitted to explicit, ordinary DNS hostnames.
    // Syntax is not DNS ownership, resolution, TLS or destination-content verification.
    private static readonly string[] BlockedBrowserHostSuffixes = {
        ".localhost", ".local", ".localdomain", ".internal", ".lan",
        ".home.arpa", ".test", ".invalid", ".example", ".onion"
    };

    internal static string[] ParseHosts(string text)
    {
        if(text.Length>700)throw new ArgumentException("Approved host list too long");
        if(string.IsNullOrWhiteSpace(text))return Array.Empty<string>();
        // Empty comma entries can silently reduce an explicitly reviewed scope.
        var parts=text.Split(',',StringSplitOptions.TrimEntries);
        if(parts.Length>10)throw new ArgumentException("No more than 10 approved sites");
        var hosts=new List<string>();
        foreach(var part in parts)
        {
            if(part.Length is < 4 or > 200 || Uri.CheckHostName(part)!=UriHostNameType.Dns)
                throw new ArgumentException("Invalid approved hostname");
            string name=part.ToLowerInvariant();
            if(BlockedBrowserHostSuffixes.Any(suffix => name.EndsWith(suffix,StringComparison.Ordinal)) ||
                name=="home.arpa" || name.Contains("..",StringComparison.Ordinal))
                throw new ArgumentException("Local or reserved sites cannot be approved for browser navigation");
            string[] labels=name.Split('.');
            if(labels.Length<2 || labels[^1].Length<2 || labels[^1].All(char.IsDigit) ||
               labels.Any(label => label.Length>63 ||
                 !Regex.IsMatch(label,"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")))
                throw new ArgumentException("Invalid DNS hostname");
            hosts.Add(name);
        }
        return hosts.Distinct(StringComparer.Ordinal).ToArray();
    }
    private static string RequireApprovedUrl(string url,string[] hosts)
    {
        if(!Uri.TryCreate(url,UriKind.Absolute,out var parsed)||parsed.Scheme!="https"||
           parsed.Port!=443||parsed.UserInfo!=""||parsed.Fragment!=""||!hosts.Contains(parsed.Host,StringComparer.OrdinalIgnoreCase))
            throw new ArgumentException("HTTPS site is not in the exact user-approved host list");
        return parsed.AbsoluteUri;
    }
    private static bool FixedEqual(string a,string b)=>
        a.Length==32&&b.Length==32&&CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(a),Encoding.UTF8.GetBytes(b));

    private sealed record Job(string Id,string Company,string Order,string Instruction,string Mode,
       string Model,string[] Hosts,AgentPlan Plan,string Status,int StepIndex,string StepToken,string QaJson);
    internal sealed class AgentPlan
    {
        public string Summary {get;set;}="";
        public List<AgentStep> Steps {get;set;}=new();
    }
    internal static string HashOutputBounded(string path)
    {
        // Reject existing link/reparse components before opening. This is defense in depth,
        // not a handle-based guarantee against a concurrently replaced parent directory.
        FileSystemInfo? component = new FileInfo(Path.GetFullPath(path));
        while (component != null)
        {
            if ((component.Attributes & FileAttributes.ReparsePoint) != 0)
                throw new ArgumentException("Linked note paths are not permitted");
            component = component is FileInfo file ? file.Directory : ((DirectoryInfo)component).Parent;
        }

        using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
        byte[] bytes = new byte[32769];
        int count = 0;
        while (count < bytes.Length)
        {
            int read = stream.Read(bytes, count, bytes.Length - count);
            if (read == 0) break;
            count += read;
        }
        if (count > 32768) throw new ArgumentException("Output too large for integrity review");
        return Convert.ToHexString(SHA256.HashData(bytes.AsSpan(0, count)));
    }

    internal static string ReadNoteBounded(string path)
    {
        // Reject existing link/reparse components before opening. This is defense in depth,
        // not a handle-based guarantee against a concurrently replaced parent directory.
        FileSystemInfo? component = new FileInfo(Path.GetFullPath(path));
        while (component != null)
        {
            if ((component.Attributes & FileAttributes.ReparsePoint) != 0)
                throw new ArgumentException("Linked note paths are not permitted");
            component = component is FileInfo file ? file.Directory : ((DirectoryInfo)component).Parent;
        }
        // Bound bytes from the open handle, even if the file grew after metadata inspection.
        using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
        byte[] bytes = new byte[32769];
        int count = 0;
        while (count < bytes.Length)
        {
            int read = stream.Read(bytes, count, bytes.Length - count);
            if (read == 0) break;
            count += read;
        }
        if (count > 32768) throw new ArgumentException("Note too large");
        return new UTF8Encoding(false, true).GetString(bytes, 0, count);
    }

    internal sealed class AgentStep
    {
        public string AgentId {get;set;}="planner";
        public string Title {get;set;}="";
        public string Tool {get;set;}="";
        public string Input {get;set;}="";
        public string ExpectedOutput {get;set;}="";
    }
}

