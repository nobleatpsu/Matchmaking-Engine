# Research taxonomy

`shared/taxonomy.ts` defines about 60 **concepts** grouped into 10 domains. Each concept has:

```ts
c('solid-state-batteries', 'Solid-state batteries', 'Energy',
  ['solid state battery', 'solid electrolyte', 'lithium metal anode'],   // phrases that signal it
  ['energy-storage', 'electrochemistry', 'battery-materials'])          // related (adjacent) concepts
```

## Where it's used

- The **baseline matcher** scores coverage of concepts (direct = 1.0, adjacent = 0.5).
- **Ingestion** maps free-text `expertise` and `topics` to concept ids, and derives topics from titles when none are given.
- The **UI** shows concepts as topic chips and offers them in pickers (Match Studio, company needs, forms).

Your own matcher doesn't have to use the taxonomy. You can ignore `topics` and work from raw text. The UI still shows the concept ids you return in `requestConcepts`.

## Editing

- **Add a phrase** when a common way of saying something isn't detected. Phrases are lowercase and matched on word boundaries after normalization (hyphens become spaces). Longer phrases win.
- **Add a concept** when a research area keeps coming up. Pick a stable kebab-case id. Never rename ids, because stored records reference them.
- **Related concepts** give partial credit. Keep the lists short (2–4). Too many relations make everything match everything.

After editing, run `npm test`. The baseline tests check a few rankings that depend on the taxonomy.

## Known gaps

- No sub-fields for broad areas (e.g. *genomics* vs. *plant pathology*). This produced the demo's "wrong expertise" case.
- Phrase matching can't resolve ambiguity ("grid" in power systems vs. computing). Embedding-based matchers handle this better.
