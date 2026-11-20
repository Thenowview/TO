import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, ChevronDown, ChevronUp } from "lucide-react";
import { post } from "../lib/api";
import type { Approval } from "../lib/types";
import { Button, Card } from "./ui";

const LABELS: Record<string, string> = {
  once: "Allow once",
  task: "Allow for this task",
  site: "Allow for this site",
  always: "Always allow",
  deny: "Deny",
};

const CLASS_LABEL: Record<string, string> = {
  web: "Visit a website",
  read: "Read from a connected app",
  write: "Make a change in a connected app",
  send: "Send on your behalf",
  submit: "Submit a form",
  purchase: "Make a purchase",
};

export function ApprovalCard({ approval }: { approval: Approval }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const decide = async (grant: string) => {
    setBusy(true);
    try {
      await post(`/approvals/${approval.id}`, { grant });
      qc.invalidateQueries({ queryKey: ["approvals"] });
    } finally {
      setBusy(false);
    }
  };
  const allow = approval.options.filter((o) => o !== "deny");
  return (
    <Card className="border-[var(--accent)]/40 bg-[var(--accent-soft)] p-4" data-testid="approval-card">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-full bg-[var(--card)] p-2 text-[var(--accent)]">
          <ShieldCheck size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">{CLASS_LABEL[approval.actionClass] ?? "Needs your OK"}</div>
          <div className="mt-1 font-medium">{approval.purpose}</div>
          <button className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--muted)] hover:text-[var(--ink)]" onClick={() => setOpen(!open)}>
            See task details {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          {open && (
            <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-[var(--card)] p-2 text-xs">
              {JSON.stringify({ tool: approval.toolName, target: approval.target, ...approval.details }, null, 2)}
            </pre>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {allow.map((o, i) => (
              <Button key={o} size="sm" variant={i === 0 ? "primary" : "soft"} disabled={busy} onClick={() => decide(o)} data-testid={`approve-${o}`}>
                {LABELS[o] ?? o}
              </Button>
            ))}
            {approval.options.includes("deny") && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => decide("deny")} data-testid="approve-deny">
                Deny
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
