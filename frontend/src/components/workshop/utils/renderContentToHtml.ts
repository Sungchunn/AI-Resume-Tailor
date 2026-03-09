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

  // Education
  if (content.education && content.education.length > 0) {
    sections.push(`
      <section class="education">
        <h2>Education</h2>
        ${content.education
          .map(
            (edu) => `
          <div class="education-entry">
            <div><strong>${escapeHtml(edu.degree)}</strong></div>
            <div>${escapeHtml(edu.institution)}${edu.location ? `, ${escapeHtml(edu.location)}` : ""}</div>
            ${edu.graduation_date ? `<div>${escapeHtml(edu.graduation_date)}</div>` : ""}
          </div>
        `
          )
          .join("\n")}
      </section>
    `);
  }

  // Certifications
  if (content.certifications && content.certifications.length > 0) {
    sections.push(`
      <section class="certifications">
        <h2>Certifications</h2>
        <ul>
          ${content.certifications.map((c) => `<li>${escapeHtml(c.name)}${c.issuer ? ` - ${escapeHtml(c.issuer)}` : ""}</li>`).join("\n")}
        </ul>
      </section>
    `);
  }

  // Projects
  if (content.projects && content.projects.length > 0) {
    sections.push(`
      <section class="projects">
        <h2>Projects</h2>
        ${content.projects
          .map(
            (p) => `
          <div class="project-entry">
            <div><strong>${escapeHtml(p.name)}</strong></div>
            ${p.description ? `<div>${escapeHtml(p.description)}</div>` : ""}
            ${p.technologies ? `<div>Technologies: ${p.technologies.map(escapeHtml).join(", ")}</div>` : ""}
          </div>
        `
          )
          .join("\n")}
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
