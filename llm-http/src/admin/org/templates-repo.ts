export interface OrgTemplateRow {
  id: string;
  name: string;
  description?: string | undefined;
  body: string;
  tags: string[];
  updatedAt: string;
}

export interface OrgTemplateCreateInput {
  name: string;
  description?: string | undefined;
  body: string;
  tags: string[];
}

export interface OrgTemplateUpdateInput {
  name?: string | undefined;
  description?: string | undefined;
  body?: string | undefined;
  tags?: string[] | undefined;
}

export interface OrgTemplateRepo {
  list(orgId: string): Promise<OrgTemplateRow[]>;
  findById(orgId: string, id: string): Promise<OrgTemplateRow | null>;
  findByName(orgId: string, name: string): Promise<OrgTemplateRow | null>;
  create(orgId: string, input: OrgTemplateCreateInput): Promise<OrgTemplateRow>;
  update(
    orgId: string,
    id: string,
    input: OrgTemplateUpdateInput,
  ): Promise<OrgTemplateRow | null>;
  delete(orgId: string, id: string): Promise<boolean>;
}

export class InMemoryOrgTemplateRepo implements OrgTemplateRepo {
  private readonly rowsByOrg = new Map<string, Map<string, OrgTemplateRow>>();
  private idCounter = 0;

  constructor(private readonly clock: () => Date = () => new Date()) {}

  private orgMap(orgId: string): Map<string, OrgTemplateRow> {
    let m = this.rowsByOrg.get(orgId);
    if (!m) {
      m = new Map();
      this.rowsByOrg.set(orgId, m);
    }
    return m;
  }

  async list(orgId: string): Promise<OrgTemplateRow[]> {
    return Array.from(this.orgMap(orgId).values()).map((r) => ({ ...r, tags: [...r.tags] }));
  }

  async findById(orgId: string, id: string): Promise<OrgTemplateRow | null> {
    const row = this.orgMap(orgId).get(id);
    return row ? { ...row, tags: [...row.tags] } : null;
  }

  async findByName(orgId: string, name: string): Promise<OrgTemplateRow | null> {
    const target = name.toLowerCase();
    for (const row of this.orgMap(orgId).values()) {
      if (row.name.toLowerCase() === target) {
        return { ...row, tags: [...row.tags] };
      }
    }
    return null;
  }

  async create(
    orgId: string,
    input: OrgTemplateCreateInput,
  ): Promise<OrgTemplateRow> {
    this.idCounter += 1;
    const row: OrgTemplateRow = {
      id: `tpl_${this.idCounter}`,
      name: input.name,
      description: input.description,
      body: input.body,
      tags: [...input.tags],
      updatedAt: this.clock().toISOString(),
    };
    this.orgMap(orgId).set(row.id, row);
    return { ...row, tags: [...row.tags] };
  }

  async update(
    orgId: string,
    id: string,
    input: OrgTemplateUpdateInput,
  ): Promise<OrgTemplateRow | null> {
    const m = this.orgMap(orgId);
    const existing = m.get(id);
    if (!existing) return null;
    const next: OrgTemplateRow = {
      ...existing,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(input.body !== undefined ? { body: input.body } : {}),
      ...(input.tags !== undefined ? { tags: [...input.tags] } : {}),
      updatedAt: this.clock().toISOString(),
    };
    m.set(id, next);
    return { ...next, tags: [...next.tags] };
  }

  async delete(orgId: string, id: string): Promise<boolean> {
    return this.orgMap(orgId).delete(id);
  }
}
