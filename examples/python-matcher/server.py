"""
Example matching service in Python — no dependencies, standard library only.

Run:   python3 examples/python-matcher/server.py          (listens on :8000)
Wire:  MATCHERS_HTTP="python=http://localhost:8000/match" npm run dev
Check: MATCHERS_HTTP="python=http://localhost:8000/match" npm run matcher:check -- --provider=python
Eval:  MATCHERS_HTTP="python=http://localhost:8000/match" npm run eval -- --workspace=demo

The platform POSTs {"request": MatchRequest, "corpus": MatchCorpus} and expects a
MatchResponse back. Shapes: shared/matching/types.ts. Rules: shared/matching/contract.ts.
Guide: docs/matching/writing-a-matcher.md

This toy scorer uses TF-IDF-like keyword overlap so you can see the plumbing.
Replace `score_faculty` with your real model (embeddings, learned ranker, ...).
"""
import json
import math
import re
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer

STOP = set("a an and are as at be by for from has have in into is it its of on or our that the their to we with who looking research researchers collaborate".split())


def tokens(text):
    return [t for t in re.findall(r"[a-z0-9]+", (text or "").lower()) if len(t) > 2 and t not in STOP]


def faculty_text(f, corpus):
    parts = [f.get("summary", ""), " ".join(f.get("keywords", [])), " ".join(f.get("expertise", []))]
    evidence = []
    for kind in ("projects", "publications", "ip"):
        for rec in corpus.get(kind, []):
            if f["id"] in rec.get("facultyIds", []):
                parts.append(rec.get("title", "") + " " + rec.get("description", rec.get("summary", "")))
                evidence.append((kind, rec))
    return " ".join(parts), evidence


def score_faculty(query_tokens, f, corpus, idf):
    text, evidence = faculty_text(f, corpus)
    ft = set(tokens(text))
    hits = [t for t in set(query_tokens) if t in ft]
    if not hits:
        return None
    raw = sum(idf.get(t, 1.0) for t in hits) / max(1e-9, sum(idf.get(t, 1.0) for t in set(query_tokens)))
    score = round(100 * raw)
    ev = []
    for kind, rec in evidence:
        overlap = [t for t in set(query_tokens) if t in set(tokens(rec.get("title", "")))]
        if overlap:
            ev.append({
                "type": {"projects": "project", "publications": "publication", "ip": "ip"}[kind],
                "id": rec["id"], "title": rec["title"], "concepts": [], "strength": min(1.0, len(overlap) / 3),
                "active": rec.get("status") == "active" if kind == "projects" else None,
            })
    ev = [{k: v for k, v in e.items() if v is not None} for e in ev]
    return score, hits, ev


def band(score):
    return "strong" if score >= 75 else "good" if score >= 60 else "possible" if score >= 45 else "weak"


def match(request, corpus):
    q = tokens(" ".join([request.get("text", ""), " ".join(request.get("topics", []))]))
    docs = [set(tokens(faculty_text(f, corpus)[0])) for f in corpus["faculty"]]
    n = max(1, len(docs))
    idf = {t: math.log((n + 1) / (1 + sum(t in d for d in docs))) + 1 for t in set(q)}
    rows = []
    for f in corpus["faculty"]:
        r = score_faculty(q, f, corpus, idf)
        if r is None:
            continue
        score, hits, ev = r
        rows.append((score, f, hits, ev))
    rows.sort(key=lambda x: (-x[0], x[1]["name"]))
    results = []
    for i, (score, f, hits, ev) in enumerate(rows[:25]):
        results.append({
            "facultyId": f["id"], "rank": i + 1, "score": score, "band": band(score),
            "components": [{"key": "topic", "label": "Keyword overlap", "weight": 1.0, "score": score,
                            "explanation": "Matched terms: " + ", ".join(sorted(hits))}],
            "adjustments": [], "concepts": [], "evidence": ev,
            "unknowns": ["Availability not confirmed"] + ([] if f.get("emailVerified") else ["Contact details not verified"]),
            "concerns": [],
            "confidence": {"score": 50, "level": "medium", "factors": []},
            "summary": f"Keyword overlap on {', '.join(sorted(hits)[:3])}.",
            "pathways": [], "relatedProjectIds": [e["id"] for e in ev if e["type"] == "project"],
            "relatedIpIds": [e["id"] for e in ev if e["type"] == "ip"],
        })
    return {
        "providerId": "python", "providerVersion": "0.1.0", "generatedAt": datetime.now(timezone.utc).isoformat(),
        "method": "TF-IDF weighted keyword overlap (example service).",
        "requestConcepts": request.get("topics", []), "inferredConcepts": [],
        "results": results, "excluded": [], "considered": len(corpus["faculty"]),
    }


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200 if self.path.endswith("/health") else 404)
        self.end_headers()

    def do_POST(self):
        if not self.path.endswith("/match"):
            self.send_response(404); self.end_headers(); return
        body = json.loads(self.rfile.read(int(self.headers.get("content-length", 0))))
        out = json.dumps(match(body["request"], body["corpus"])).encode()
        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(out)))
        self.end_headers()
        self.wfile.write(out)


if __name__ == "__main__":
    print("Example matcher on http://localhost:8000/match")
    HTTPServer(("127.0.0.1", 8000), Handler).serve_forever()
