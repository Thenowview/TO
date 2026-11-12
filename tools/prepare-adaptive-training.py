#!/usr/bin/env python3
"""Export and validate owner-reviewed adaptive examples for OPTIONAL offline LoRA work.

This is dataset preparation, NOT automatic model training. The user must opt in
to exporting local text. No provider calls, weights, automatic deletion or
modification of the original SQLite knowledge store.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import sqlite3
import sys

MAX_LENGTH=10000
SECRET_PATTERNS=[
    re.compile(r"-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----"),
    re.compile(r"(?i)\b(?:api[_-]?key|access[_-]?token|password|secret)\s*[:=]\s*\S+"),
    re.compile(r"gh[pousr]_[A-Za-z0-9_]{20,}"),
]


def safe_example(question,answer,evidence):
    if not all(isinstance(v,str) for v in (question,answer,evidence)):
        raise ValueError("Training examples must be text.")
    if not (3<=len(question.strip())<=1000 and 5<=len(answer.strip())<=MAX_LENGTH and
            10<=len(evidence.strip())<=2000):
        raise ValueError("Training example has invalid lengths or no verification evidence.")
    combined="\n".join((question,answer,evidence))
    if any(p.search(combined) for p in SECRET_PATTERNS):
        raise ValueError("Training candidate contains probable credentials; exclude and review.")
    return {"instruction":question.strip(),"response":answer.strip()}


def _read(db_path):
    if not db_path.is_file():
        raise ValueError("SQLite knowledge database not found; nothing to export.")
    # Open strictly read-only to avoid accidental migrations or edits.
    uri=db_path.resolve().as_uri()+"?mode=ro"
    conn=sqlite3.connect(uri,uri=True,timeout=5)
    conn.row_factory=sqlite3.Row
    try:
        rows=conn.execute("""SELECT id,question,answer,evidence,origin,status
                             FROM adaptive_solutions
                             WHERE status='verified'
                             ORDER BY id""").fetchall()
    except sqlite3.Error as exc:
        raise ValueError("Verified adaptive knowledge schema unavailable.") from exc
    finally:
        conn.close()
    return rows


def export(db_path,output,confirmed=False):
    if not confirmed:
        raise ValueError("Explicit --confirm-reviewed-export required: local user data may be sensitive.")
    rows=_read(Path(db_path))
    if len(rows)<3:
        raise ValueError("At least three separately verified solutions are needed; do not invent training examples.")
    candidates=[]
    rejected=0
    for row in rows:
        try:
            example=safe_example(row["question"],row["answer"],row["evidence"])
        except ValueError:
            rejected+=1
            continue
        candidates.append((row["id"],example))
    if len(candidates)<3:
        raise ValueError("Insufficient safe, verified examples after secret checks.")
    if len(candidates)>10000:
        raise ValueError("Too many training examples; split and review explicitly.")
    output=Path(output).resolve()
    if output.suffix.lower()!=".jsonl" or output.exists():
        raise ValueError("Choose a new .jsonl path; never overwrite existing user datasets.")
    output.parent.mkdir(parents=True,exist_ok=True)
    # Group by stable ID; no random source reshuffling across exports.
    train=[];validation=[]
    for id_,example in candidates:
        bucket=int(hashlib.sha256(id_.encode("ascii")).hexdigest()[:8],16)%5
        (validation if bucket==0 else train).append(example)
    # A tiny dataset cannot reliably estimate model performance.
    if len(validation)==0:
        validation=[train.pop()]
    if len(train)<2:
        raise ValueError("Need at least two training and one validation example.")
    val=output.with_name(output.stem+"-validation.jsonl")
    if val.exists():
        raise ValueError("Validation output already exists; refuse overwrite.")
    for target,records in ((output,train),(val,validation)):
        with target.open("x",encoding="utf-8",newline="\n") as file:
            for record in records:
                file.write(json.dumps(record,ensure_ascii=False)+"\n")
    return {"training_examples":len(train),"validation_examples":len(validation),
            "rejected_candidates":rejected,
            "training_path":str(output),"validation_path":str(val),
            "model_weights_modified":False,"adapter_trained":False,
            "note":"Human review, rights checks and separate LoRA training/validation are still required."}


def validate(path):
    target=Path(path)
    if not target.is_file() or target.stat().st_size>100*1024*1024:
        raise ValueError("Invalid or excessive JSONL dataset.")
    count=0
    for index,line in enumerate(target.read_text(encoding="utf-8").splitlines(),start=1):
        try:
            example=json.loads(line)
        except ValueError as exc:
            raise ValueError(f"Invalid JSONL at line {index}.") from exc
        if type(example) is not dict or set(example)!={"instruction","response"}:
            raise ValueError(f"Invalid JSONL schema at line {index}.")
        safe_example(example["instruction"],example["response"],
                     "Validated source evidence is retained in original local SQLite.")
        count+=1
    if not count:
        raise ValueError("Dataset is empty.")
    return {"valid":True,"examples":count,"model_training_performed":False}


def main(argv=None):
    parser=argparse.ArgumentParser(description="Review-only Adaptive dataset export/validator.")
    parser.add_argument("mode",choices=["export","validate"])
    parser.add_argument("--db",help="TheOrg local SQLite database")
    parser.add_argument("--output",help="New training JSONL output path")
    parser.add_argument("--file",help="Existing JSONL file for validation")
    parser.add_argument("--confirm-reviewed-export",action="store_true")
    args=parser.parse_args(argv)
    try:
        if args.mode=="export":
            if not args.db or not args.output:raise ValueError("Export requires --db and --output.")
            result=export(args.db,args.output,args.confirm_reviewed_export)
        else:
            if not args.file:raise ValueError("Validation requires --file.")
            result=validate(args.file)
    except (ValueError,OSError,UnicodeError) as exc:
        print(json.dumps({"ok":False,"error":str(exc)}),file=sys.stderr)
        return 1
    print(json.dumps({"ok":True,**result},ensure_ascii=False))
    return 0


if __name__=="__main__":
    raise SystemExit(main())
