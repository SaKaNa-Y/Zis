# Evaluation Records

Use the [record helper](../scripts/evaluation_record.py) when a file-based run benefits from mechanical checks of versions, inputs, outputs, and retained evidence. It uses Python's standard library. Run its `--help` and each subcommand's `--help` for current arguments.

Keep records and evidence under the iteration's `evidence/` directory and established storage policy. Choose a root containing the retained file layout; snapshot the tested skill and relevant resources there. Bind every resource actually needed by the exercise, its input, and new output paths with `start` before execution. Existing outputs are rejected so an earlier result cannot silently fill a new trial. Record unknown model or tool versions as `unknown` rather than guessing. The helper hashes supplied files; the coordinator establishes whether they are the complete files the runner actually loads.

Run execution environments in `.scratch/skill-evolution/<work-id>/` or the established temporary location. Keep reproducible dependency trees, consumer copies and build caches there; bind the minimal retained inputs and results in the evidence package. If a run must bind a temporary file, preserve its exact required content and relative layout before removing that temporary dependency.

Use available host tools to run the exercise. Retain actual launch settings, session identity, delivered turns, tool events, outputs, and relevant environment checks. Use `finish` to bind those evidence files and expected outputs to a separate record; it checks the starting files remain unchanged. Each attempt keeps its own records. A candidate revision starts a new run; continuing the same conversation is recorded as `continuation`, including when that conversation loads revised instructions.

Use `verify` after retaining or moving evidence. Relocation requires the same relative file layout and the new root. Its successful exit establishes that supplied file identities still match. It does not establish that an agent read the files, events happened as described, session isolation was achieved, or the candidate passed behavioral criteria. Session mode and model/tool fields are declarations. Even `fresh` always retains `isolation_check: not-performed`; assess isolation from the host's actual launch evidence and document the supported scope separately.

After a run, follow [retention and migration](retention-and-migration.md) to retain the protocol, tested versions, key inputs, actual outputs and comparison limits. Verify a relocated package before cleanup. Keep original integrity records with unchanged packages; a sanitized derivative has separate integrity information and an explicit limit, not a rewritten successful verification.

Read the recorded outputs and host evidence against the agreed criteria using [purpose-led validation](validation.md). Expected outputs missing at finish, modified files, pre-existing outputs, malformed records, or reused record filenames produce errors. Preserve failed-run evidence alongside the start record and explain an interrupted or blocked run in the iteration record. The helper is a consistency check for cooperative local work, not a signed or tamper-proof archive.

When Python or the helper is unavailable, record the same versions, conditions, inputs, expected outputs, actual evidence, and limitations manually. State which integrity checks were performed. Dependency installation and a new model client are unnecessary for this workflow.

Maintainers can exercise the helper with `python3 -m unittest discover -s tests -v` from this skill directory. These tests check the helper, not the behavior of an evolved skill.
