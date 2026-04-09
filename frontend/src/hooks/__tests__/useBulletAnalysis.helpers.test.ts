import { describe, it, expect } from "vitest";

import {
  collectBulletsFromBlocks,
  buildImportanceMap,
  findEntryContext,
} from "../useBulletAnalysis";

import type { AnyResumeBlock } from "@/lib/resume/types";
import type { BulletInput } from "@/lib/api/types";
import type { KeywordGapItem } from "@/components/tailor/editor/TailorEditorContext";

// ============================================================================
// collectBulletsFromBlocks
// ============================================================================

describe("collectBulletsFromBlocks", () => {
  it("extracts bullets from experience blocks with correct ID format", () => {
    const blocks: AnyResumeBlock[] = [
      {
        id: "exp1",
        type: "experience",
        order: 0,
        content: [
          {
            id: "e1",
            title: "Engineer",
            company: "Acme",
            startDate: "2023",
            endDate: "2024",
            bullets: [
              { id: "b1", text: "Built APIs" },
              { id: "b2", text: "Led team" },
            ],
          },
        ],
      },
    ];

    const result = collectBulletsFromBlocks(blocks);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("exp1:entry-0:bullet-0");
    expect(result[0].text).toBe("Built APIs");
    expect(result[1].id).toBe("exp1:entry-0:bullet-1");
  });

  it("extracts bullets from projects blocks (company is empty)", () => {
    const blocks: AnyResumeBlock[] = [
      {
        id: "proj1",
        type: "projects",
        order: 0,
        content: [
          {
            id: "p1",
            name: "Cool Project",
            description: "A cool project",
            startDate: "2023",
            endDate: "2024",
            bullets: [{ id: "b1", text: "Implemented feature X" }],
          },
        ],
      },
    ];

    const result = collectBulletsFromBlocks(blocks);

    expect(result).toHaveLength(1);
    expect(result[0].entry_context.company).toBe("");
    expect(result[0].entry_context.title).toBe("Cool Project");
  });

  it("skips empty/whitespace-only bullets", () => {
    const blocks: AnyResumeBlock[] = [
      {
        id: "exp1",
        type: "experience",
        order: 0,
        content: [
          {
            id: "e1",
            title: "Dev",
            company: "Co",
            startDate: "2023",
            endDate: "2024",
            bullets: [
              { id: "b1", text: "" },
              { id: "b2", text: "   " },
              { id: "b3", text: "Real bullet" },
            ],
          },
        ],
      },
    ];

    const result = collectBulletsFromBlocks(blocks);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("Real bullet");
  });

  it("handles multiple entries within a single block", () => {
    const blocks: AnyResumeBlock[] = [
      {
        id: "exp1",
        type: "experience",
        order: 0,
        content: [
          {
            id: "e1",
            title: "Senior Dev",
            company: "A",
            startDate: "2024",
            endDate: "2025",
            bullets: [{ id: "b1", text: "Led team" }],
          },
          {
            id: "e2",
            title: "Junior Dev",
            company: "B",
            startDate: "2022",
            endDate: "2023",
            bullets: [{ id: "b2", text: "Wrote code" }],
          },
        ],
      },
    ];

    const result = collectBulletsFromBlocks(blocks);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("exp1:entry-0:bullet-0");
    expect(result[1].id).toBe("exp1:entry-1:bullet-0");
  });

  it("returns empty array for blocks with no content", () => {
    const blocks: AnyResumeBlock[] = [
      {
        id: "exp1",
        type: "experience",
        order: 0,
        content: [],
      },
    ];

    const result = collectBulletsFromBlocks(blocks);
    expect(result).toEqual([]);
  });

  it("ignores non-experience, non-projects block types", () => {
    const blocks = [
      {
        id: "skills1",
        type: "skills",
        order: 0,
        content: [{ id: "s1", category: "Languages", skills: ["TypeScript"] }],
      },
      {
        id: "edu1",
        type: "education",
        order: 1,
        content: [
          {
            id: "ed1",
            school: "MIT",
            degree: "BS",
            field: "CS",
            startDate: "2020",
            endDate: "2024",
          },
        ],
      },
    ] as unknown as AnyResumeBlock[];

    const result = collectBulletsFromBlocks(blocks);
    expect(result).toEqual([]);
  });

  it("builds correct entry_context (title, company, date_range)", () => {
    const blocks: AnyResumeBlock[] = [
      {
        id: "exp1",
        type: "experience",
        order: 0,
        content: [
          {
            id: "e1",
            title: "Staff Engineer",
            company: "BigCorp",
            startDate: "Jan 2023",
            endDate: "Dec 2024",
            bullets: [{ id: "b1", text: "Designed systems" }],
          },
        ],
      },
    ];

    const result = collectBulletsFromBlocks(blocks);

    expect(result[0].entry_context).toEqual({
      title: "Staff Engineer",
      company: "BigCorp",
      date_range: "Jan 2023 - Dec 2024",
    });
  });
});

// ============================================================================
// buildImportanceMap
// ============================================================================

describe("buildImportanceMap", () => {
  it("creates keyword->importance mapping", () => {
    const gaps: KeywordGapItem[] = [
      { keyword: "React", importance: "required", inVault: false },
      { keyword: "Docker", importance: "preferred", inVault: true },
    ];

    const result = buildImportanceMap(gaps);

    expect(result).toEqual({
      React: "required",
      Docker: "preferred",
    });
  });

  it("returns empty object for empty array", () => {
    expect(buildImportanceMap([])).toEqual({});
  });
});

// ============================================================================
// findEntryContext
// ============================================================================

describe("findEntryContext", () => {
  const bullets: BulletInput[] = [
    {
      id: "block1:entry-0:bullet-0",
      text: "Did stuff",
      entry_context: {
        title: "Engineer",
        company: "Acme",
        date_range: "2023 - 2024",
      },
    },
  ];

  it("returns entry context for matching bulletId", () => {
    const result = findEntryContext(bullets, "block1:entry-0:bullet-0");

    expect(result).toEqual({
      title: "Engineer",
      company: "Acme",
      dateRange: "2023 - 2024",
    });
  });

  it("returns empty strings when bulletId not found", () => {
    const result = findEntryContext(bullets, "nonexistent");

    expect(result).toEqual({
      title: "",
      company: "",
      dateRange: "",
    });
  });
});
