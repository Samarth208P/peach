# Graph Report - .  (2026-06-17)

## Corpus Check
- Large corpus: 3057 files · ~2,505,766 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 41 nodes · 38 edges · 9 communities (8 shown, 1 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.9)
- Token cost: 4,497 input · 1,363 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Turbo Build Tasks|Turbo Build Tasks]]
- [[_COMMUNITY_Package Metadata|Package Metadata]]
- [[_COMMUNITY_README Stream Docs|README Stream Docs]]
- [[_COMMUNITY_Turbo Config|Turbo Config]]
- [[_COMMUNITY_Package Scripts|Package Scripts]]
- [[_COMMUNITY_README Architecture|README Architecture]]
- [[_COMMUNITY_JS Scratchpad|JS Scratchpad]]

## God Nodes (most connected - your core abstractions)
1. `scripts` - 4 edges
2. `tasks` - 4 edges
3. `build` - 3 edges
4. `dev` - 3 edges
5. `engines` - 2 edges
6. `turbo` - 2 edges
7. `lint` - 2 edges
8. `Peach Protocol` - 2 edges
9. `DeepBook V3` - 2 edges
10. `private` - 1 edges

## Surprising Connections (you probably didn't know these)
- `Peach Contracts` --implements--> `PeachStream<USDC>`  [EXTRACTED]
  packages/peach_contracts → packages/peach_contracts  _Bridges community 5 → community 2_

## Import Cycles
- None detected.

## Communities (9 total, 1 thin omitted)

### Community 0 - "Turbo Build Tasks"
Cohesion: 0.22
Nodes (9): dependsOn, outputs, cache, persistent, dependsOn, tasks, build, dev (+1 more)

### Community 1 - "Package Metadata"
Cohesion: 0.29
Nodes (6): engines, node, name, packageManager, private, workspaces

### Community 2 - "README Stream Docs"
Cohesion: 0.40
Nodes (6): cancel_stream, claim_stream, create_stream, DeepBook V3, PeachStream<USDC>, Pyth Network

### Community 3 - "Turbo Config"
Cohesion: 0.50
Nodes (3): devDependencies, turbo, $schema

### Community 4 - "Package Scripts"
Cohesion: 0.50
Nodes (4): scripts, build, dev, lint

### Community 5 - "README Architecture"
Cohesion: 0.67
Nodes (4): Peach Frontend, Peach Contracts, Peach Protocol, Sui Blockchain

## Knowledge Gaps
- **17 isolated node(s):** `name`, `private`, `node`, `packageManager`, `workspaces` (+12 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `tasks` connect `Turbo Build Tasks` to `Turbo Config`?**
  _High betweenness centrality (0.181) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `Turbo Config` to `Package Metadata`?**
  _High betweenness centrality (0.169) - this node is a cross-community bridge._
- **What connects `name`, `private`, `node` to the rest of the system?**
  _17 weakly-connected nodes found - possible documentation gaps or missing edges._