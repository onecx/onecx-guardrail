import * as fs from 'node:fs';
import * as path from 'node:path';
import madge from 'madge';

export interface GraphInput {
  root: string;
  files: string[];
}

/** Union-find over madge's elementary cycles: cycles sharing a file belong to one component. */
class Components {
  private readonly parent = new Map<string, string>();

  find(node: string): string {
    const known = this.parent.get(node) ?? node;
    if (known === node) {
      this.parent.set(node, node);
      return node;
    }
    const top = this.find(known);
    this.parent.set(node, top);
    return top;
  }

  join(cycle: string[]): void {
    for (const node of cycle) this.parent.set(this.find(node), this.find(cycle[0]));
  }

  groups(): string[][] {
    const byTop = new Map<string, string[]>();
    for (const node of [...this.parent.keys()]) {
      const top = this.find(node);
      byTop.set(top, [...(byTop.get(top) ?? []), node]);
    }
    return [...byTop.values()].map((members) => members.sort());
  }
}

/** Circular dependency groups (sorted member files) via `madge --circular`; type-only imports are ignored. */
export async function findCycles(input: GraphInput): Promise<string[][]> {
  if (input.files.length === 0) return [];
  const tsConfig = path.join(input.root, 'tsconfig.json');
  const result = await madge(input.files.map((file) => path.join(input.root, file)), {
    baseDir: input.root,
    fileExtensions: ['ts', 'tsx', 'js', 'jsx', 'mts', 'cts', 'mjs', 'cjs'],
    tsConfig: fs.existsSync(tsConfig) ? tsConfig : undefined,
    detectiveOptions: { ts: { skipTypeImports: true }, tsx: { skipTypeImports: true } },
  });
  const known = new Set(input.files);
  const components = new Components();
  for (const cycle of result.circular()) {
    if (cycle.every((file) => known.has(file))) components.join(cycle);
  }
  return components.groups();
}

export function cycleKey(members: string[]): string {
  return members.join('|');
}

export function cycleTarget(members: string[]): string {
  return [...members, members[0]].join(' -> ');
}
