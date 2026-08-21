# A robots verdict belongs to the host that served it

Status: accepted

Settled by
[Decide what an unreadable robots.txt means for a Source](https://github.com/SaKaNa-Y/Zis/issues/36),
which was routed out of
[Robots-verify the whole candidate source corpus](https://github.com/SaKaNa-Y/Zis/issues/29)
because two hosts it could not clear are a **precedent** rather than a curation
call: a WAF in front of `robots.txt` is a growing default, and deciding it inside
[Curate the initial source list](https://github.com/SaKaNa-Y/Zis/issues/11) would
settle it invisibly for every future Source. Re-probed 2026-08-21 from a second
egress; per-host evidence in
[`.scratch/zis/research/robots-verification.md`](../../.scratch/zis/research/robots-verification.md).

#29 swept 118 hosts and left two in a state the corpus had no name for. **InfoQ**
(`feed.infoq.com/robots.txt` → 406 `application/json`; the apex and `www` → 405
with an AWS WAF `Human Verification` page) and **Ars Technica**
(`arstechnica.com/robots.txt` → 202, `Content-Length: 0`,
`x-amzn-waf-action: challenge`). Under the fail-closed default both were unusable
— but that status was reached **by default rather than by decision**, and three
questions were left unruled: whether "cannot be read" is an exclusion, whether
any route reopens it, and what it costs.

## Only two responses yield a verdict, and a 404 is one of them whatever the body

#29 recorded 19 hosts as `404-ALLOWED` and separately refused to clear
`feeds.arstechnica.com`, whose `robots.txt` also answers **404** — on the ground
that its 404 arrives as a 518 KB "Page not found | Ars Technica" page, so
*"guard #4's '404 means allowed' does not cleanly apply."*

Re-read against the full table, that line does not divide the corpus where it
claims to:

| | count |
|---|---|
| hosts cleared as `404-ALLOWED` | 19 |
| ...of which the 404 is served as `text/html` | **18** |
| ...of which the 404 is served as `text/plain` | 1 (`remix.run`) |

`blog.vuejs.org`, `fly.io`, `tailwindcss.com`, `ziglang.org`,
`planet.postgresql.org`, `blog.python.org`, `lethain.com`, `ollama.com` and ten
more are all HTML-on-404. The only property separating them from Ars's feed host
is **how large the error page is**, and no threshold for that exists anywhere in
the fetch policy. Either a 404's body is irrelevant, or 18 cleared hosts leave
the corpus with Ars.

**It is irrelevant, and the reason is structural rather than a concession.** On a
**200** the body *is* the ruleset, which is why content-type is load-bearing
there — `openhome.bilibili.com` serves HTML with status 200, and a parser that
finds no `Disallow` in it concludes "allowed" (#16, guard #1). On a **404** there
is no ruleset to misparse: the status alone carries the whole meaning *the file is
absent, therefore nothing is restricted*, and the body is what the server shows
humans. A soft-404 is dangerous when it returns **200** for missing content; a
hard 404 that renders prettily is still a hard 404.

So the whitelist is stated positively and exhaustively:

| response | verdict |
|---|---|
| 200 + `text/plain` | **parse and obey** |
| **any 404** | **allow** — body and content-type irrelevant |
| 200 + any other content-type | AMBIGUOUS → deny (#16, guard #1) |
| 2xx other than 200, or zero-length 2xx | AMBIGUOUS → deny (#29, guard #4) |
| 4xx other than 404, 5xx, timeout, TLS failure | AMBIGUOUS → deny |

## No cross-host inference, in either direction

`robots.txt` binds the host that served it. Zis's fetch policy already says "per
host, before fetching", and this decision refuses to break that rule **for** a
Source as well as **against** one, because they are one move:

- **For.** Had `www.infoq.com/robots.txt` answered `text/plain` 200 `Allow: /`
  while `feed.infoq.com` stayed at 406, "InfoQ permits crawling, so poll the
  feed" would be inference about a host that never spoke.
- **Against.** This is the live case. `feeds.arstechnica.com` answers 404 →
  allowed, and its feed fetches clean (200, `text/xml`, 80 KB, 20 items, no WAF
  header anywhere). The WAF is on `arstechnica.com`, a **different host**.
  "Ars is behind a bot defence, therefore Ars is unverifiable" is the same
  inference pointing the other way — and it is the inference that put Ars on this
  ticket.

Permitting it only when it excludes a Source is a bias, not a policy. #29's apex
column keeps its value as a cross-check for fail-open shapes; it is not an
authority over subdomains.

**What makes this cheap for Ars specifically**: `ingestion-pipeline.md` §3 has
exactly one fetch of a publisher page — stage 4, *hydrate* — and it is
**Aggregator-only**, an explicit flag never inferred from a host. An ordinary
press Source is read from its feed and nothing else, and cited URLs are never
fetched at all (which is why 3,607 of 4,937 Signals carry no ingested text). No
request is ever sent to `arstechnica.com`.

## The register holds three states, keyed by host

The register held one exclusion shape: excluded-on-policy, each entry quoting a
`Disallow` line — Lobsters, Bilibili, YouTube channel RSS, The Register,
Changelog. InfoQ has no line to quote. Folding it in records a rule that does not
exist; leaving it out records nothing. So there are **three** states:

- **in** — every host this Source fetches has a verdict of *allow*.
- **excluded-on-policy** — a quoted `Disallow` (or `Content-Signal`) directive.
- **`unverifiable`** — no verdict is obtainable. The entry carries the *evidence
  of unanswerability* where an exclusion carries a directive: status,
  content-type, the `x-amzn-waf-action` value, probe date.

`AMBIGUOUS` remains the per-response verdict `robots_cache` computes;
`unverifiable` is the register word for a host that yields nothing else.

**Keyed by host, with a Source-level rollup for reading.** Ars is the first case
where one Source spans an allowed host and an unverifiable one, and collapsing
them loses the entry that would matter if a later phase fetches article bodies or
if a press Source were ever flagged `is_aggregator`. **A Source is usable when the
hosts it actually fetches are cleared** — not when every host its Publisher owns
is.

## `unverifiable` is pending in mechanism and out in effect

#29 established that **a robots verdict is perishable state, not a
qualification** — four ordinary tech hosts added a blanket `Disallow: /` inside
three years — so verdicts expire and hosts are re-probed. That cuts both ways: an
allow can rot into a `Disallow`, and an unanswerable host can start answering.

So an `unverifiable` host stays in the sweep on the existing TTL, with **no new
machinery and no waiting anywhere**. It is not a Source today: never written into
`sources.mjs`, and #11 curates as though it does not exist. No ticket stays open
on it, no press slot is held for it. If a later sweep gets a `text/plain` 200,
that is a curation act on that day, not a resumption of this decision.

## A verdict counts only if the pipeline's own egress can obtain it

#8 put the pipeline in a GitHub Actions runner, so Zis's egress is a shared
datacenter IP — and #11 found YouTube channel feeds failing **24 of 25 probes**
from it, inconsistently between runs, while working fine elsewhere. "It is our
egress, not the host" was therefore a live hypothesis, and it is now **ruled out
by measurement**: re-probed 2026-08-21 from a non-runner egress with the same
descriptive UA, all three responses are identical — 406 `application/json` on
`feed.infoq.com`, 405 + `x-amzn-waf-action: captcha` on `infoq.com` and
`www.infoq.com`, 202 + `x-amzn-waf-action: challenge` with a zero-length body on
`arstechnica.com` and `www.arstechnica.com`. It is a property of the host.

The standing rule holds even where a future probe *does* differ: **a verdict only
counts if the pipeline's own egress can obtain it.** A file readable only from a
workstation is state the monthly sweep can never refresh — exactly the permanent
boolean #29 said not to store — and a host that challenges the runner on
`robots.txt` will challenge it on the fetch a second later, so the cleared verdict
buys a Source that still cannot be read. This is a **reproducibility** objection,
distinct from the spoofing one the map already carries (The Register's file allows
`Claude-User`, `Claude-SearchBot` and `claude-code`; Zis's crawler is none of
them, and sending one of those UAs to clear a default-deny is not permission).

## The decision

A robots verdict is a property of **the host that served it**, obtained by **the
egress that will do the fetching**, and only a `text/plain` 200 or **any** 404
produces one. Everything else is AMBIGUOUS and fails closed. A candidate whose
fetched hosts cannot produce a verdict is **`unverifiable`** — a third register
state that quotes evidence rather than a directive, is re-probed on the ordinary
TTL, and is not a Source in the meantime.

## Consequences

- **Ars Technica is IN, as a full Source with no caveat and no special-casing.**
  Its feed host has a verdict and its feed is live; the WAF'd apex is a host Zis
  never contacts. Its **47 citations** — the largest of the whole press tier —
  return to #11's supply figures, so #29's loss falls from **102 of 6,468
  citations (1.6%) to 55 (0.85%)**, and the **press tier is four publishers
  (`lwn`, `404media`, `thenewstack`, `ars`), not three**. Zero named clusters and
  zero top-strength Signals were affected either way; press votes at the tail.
- **`arstechnica.com` (the apex) is recorded `unverifiable` even though the Source
  is in.** That entry exists so a future article-body fetch, or a press Source
  flagged `is_aggregator`, finds the finding instead of re-deriving it.
- **InfoQ is `unverifiable`, both of its hosts.** 15 citations stay out. It is
  re-probed monthly and is not a Source until a probe says otherwise.
- **The rule and the record live apart.** The response whitelist is a rule and
  belongs in `ingestion-pipeline.md` §8, with `verdict` stored on `robots_cache`
  so AMBIGUOUS is a value rather than an absence. The register is dated per-host
  state and is **#11's deliverable** — this ADR fixes its columns (host, verdict,
  status, content-type, WAF action, probed-at, quoted directive where one exists)
  and leaves the filling to curation.
- **The genre cost is #11's to price, and this ADR prescribes no replacement.**
  Two press Publishers are gone for good (The Register, InfoQ) and the corpus
  principle in `candidate-sources-rss.md` says slots are earned by **overlapping
  coverage**, so the loss is genre rather than volume. #29 cleared press
  candidates nobody has curated in (The Verge, TechCrunch, Phoronix, Stack
  Overflow blog, Smashing, CSS-Tricks, Quanta); a replacement is judged on whether
  it **co-cites the same releases**, never on whether it is good.
- **Asking a Publisher for a bespoke allowance is out of scope for Phase 0** — and
  out of scope rather than fog, because it is sharp and simply past the
  destination. Silence is indistinguishable from a slow yes, so nothing may block
  on a reply. If permission arrives unbidden, the mail becomes the register
  entry's evidence — and it never overrides a live `Disallow`, only an
  unanswerable file.
- **Do not re-litigate either temptation.** Clearing a host from a **sibling
  host's** file, and clearing one from an egress the runner cannot reproduce. Both
  are refused above on stated grounds, and both will look reasonable to someone
  who has only looked at the apex.
- **A 404's body is never evidence again.** If a future guard wants to reject a
  404, it needs a property that is not body size — the 18 HTML-on-404 hosts in the
  corpus are the test any such guard has to pass.
