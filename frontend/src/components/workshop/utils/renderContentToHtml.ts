import type { TailoredContent } from "@/lib/api/types";

/**
 * Escape HTML special characters to prevent XSS.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Convert TailoredContent to HTML string for server-side page count validation.
 * This should match the structure expected by the backend's WeasyPrint rendering.
 */
export function renderContentToHtml(content: TailoredContent): string {
  const sections: string[] = [];

  // Summary
  if (content.summary) {
    sections.push(`
      <section class="summary">
        <h2>Summary</h2>
        <p>${escapeHtml(content.summary)}</p>
      </section>
    `);
  }

  // Experience
  if (content.experience && content.experience.length > 0) {
    const experienceItems = content.experience
      .map(
        (job) => `
          <div class="experience-entry">
            <h3>${escapeHtml(job.title)} | ${escapeHtml(job.company)}</h3>
            <p class="job-details">${escapeHtml(job.location)} | ${escapeHtml(job.start_date)} - ${escapeHtml(job.end_date)}</p>
            <ul>
              ${job.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("\n")}
            </ul>
          </div>
        `
      )
      .join("\n");

    sections.push(`
      <section class="experience">
        <h2>Experience</h2>
        ${experienceItems}
      </section>
    `);
  }

  // Skills
  if (content.skills && content.skills.length > 0) {
    sections.push(`
      <section class="skills">
        <h2>Skills</h2>
        <p>${content.skills.map(escapeHtml).join(", ")}</p>
      </section>
    `);
  }

  // Highlights
  if (content.highlights && content.highlights.length > 0) {
    sections.push(`
      <section class="highlights">
        <h2>Key Highlights</h2>
        <ul>
          ${content.highlights.map((h) => `<li>${escapeHtml(h)}</li>`).join("\n")}
        </ul>
      </section>
    `);
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
</head>
<body>
  ${sections.join("\n")}
</body>
</html>`;
}
