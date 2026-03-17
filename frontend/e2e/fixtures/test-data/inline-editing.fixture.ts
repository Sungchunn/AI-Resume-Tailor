/**
 * Test data fixtures for inline editing E2E tests
 */

export interface InlineEditingResumeData {
  id: string;
  contact: {
    fullName: string;
    email: string;
    phone: string;
    location: string;
    linkedIn?: string;
  };
  summary: string;
  experience: Array<{
    id: string;
    title: string;
    company: string;
    location: string;
    startDate: string;
    endDate: string;
    bullets: string[];
  }>;
  education: Array<{
    id: string;
    degree: string;
    institution: string;
    graduationDate: string;
    gpa?: string;
  }>;
  skills: string[];
}

/**
 * Generate a complete resume for inline editing tests
 */
export function generateInlineEditingResume(
  overrides: Partial<InlineEditingResumeData> = {}
): InlineEditingResumeData {
  return {
    id: "test-resume-id",
    contact: {
      fullName: "John Doe",
      email: "john.doe@example.com",
      phone: "(555) 123-4567",
      location: "San Francisco, CA",
      linkedIn: "linkedin.com/in/johndoe",
      ...overrides.contact,
    },
    summary:
      "Experienced software engineer with expertise in full-stack development, cloud architecture, and team leadership.",
    experience: [
      {
        id: "exp-1",
        title: "Senior Software Engineer",
        company: "Tech Corp",
        location: "San Francisco, CA",
        startDate: "2020-01",
        endDate: "Present",
        bullets: [
          "Led development of microservices architecture serving 1M+ users",
          "Implemented CI/CD pipeline reducing deployment time by 60%",
          "Mentored team of 5 junior developers",
        ],
      },
      {
        id: "exp-2",
        title: "Software Engineer",
        company: "StartUp Inc",
        location: "Remote",
        startDate: "2018-06",
        endDate: "2019-12",
        bullets: [
          "Built React frontend for customer portal",
          "Designed RESTful APIs using Node.js and Express",
        ],
      },
      ...((overrides.experience as InlineEditingResumeData["experience"]) ?? []),
    ],
    education: [
      {
        id: "edu-1",
        degree: "Bachelor of Science in Computer Science",
        institution: "University of California, Berkeley",
        graduationDate: "2018",
        gpa: "3.8",
      },
      ...((overrides.education as InlineEditingResumeData["education"]) ?? []),
    ],
    skills: [
      "JavaScript",
      "TypeScript",
      "React",
      "Node.js",
      "Python",
      "AWS",
      "Docker",
      "Kubernetes",
      ...((overrides.skills as string[]) ?? []),
    ],
  };
}

/**
 * Convert fixture data to API response format (matches ResumeResponse interface)
 */
export function toApiResponse(data: InlineEditingResumeData) {
  return {
    // Required ResumeResponse fields
    id: data.id,
    user_id: 1,
    title: "Test Resume",
    raw_content: "Raw resume content for testing",
    is_master: false,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    parsed_verified: true,
    parsed_verified_at: "2024-01-01T00:00:00Z",
    version: 1,

    // Parsed content (the actual resume data)
    parsed: {
      contact: {
        name: data.contact.fullName,
        email: data.contact.email,
        phone: data.contact.phone,
        location: data.contact.location,
        linkedin: data.contact.linkedIn,
      },
      summary: data.summary,
      experience: data.experience.map((exp) => ({
        title: exp.title,
        company: exp.company,
        location: exp.location,
        start_date: exp.startDate,
        end_date: exp.endDate,
        bullets: exp.bullets,
      })),
      education: data.education.map((edu) => ({
        degree: edu.degree,
        institution: edu.institution,
        graduation_date: edu.graduationDate,
        gpa: edu.gpa,
      })),
      skills: data.skills,
    },

    // Style settings (use defaults)
    style: {
      fontFamily: "inter",
      fontSize: 10,
      lineHeight: 1.4,
      pageMargins: 0.5,
      sectionSpacing: 16,
      fit_to_one_page: false,
    },

    // Fit-to-page flag
    fit_to_page: false,
  };
}

/**
 * Element ID patterns for inline editing
 */
export const ELEMENT_IDS = {
  // Contact fields
  contactName: (contactId: string) => `${contactId}::fullName`,
  contactEmail: (contactId: string) => `${contactId}::email`,
  contactPhone: (contactId: string) => `${contactId}::phone`,
  contactLocation: (contactId: string) => `${contactId}::location`,

  // Summary
  summaryContent: (summaryId: string) => `${summaryId}::content`,

  // Experience
  expTitle: (expId: string, entryIndex: number) =>
    `${expId}:entry-${entryIndex}:title`,
  expCompany: (expId: string, entryIndex: number) =>
    `${expId}:entry-${entryIndex}:company`,
  expBullet: (expId: string, entryIndex: number, bulletIndex: number) =>
    `${expId}:entry-${entryIndex}:bullets:${bulletIndex}`,

  // Education
  eduDegree: (eduId: string, entryIndex: number) =>
    `${eduId}:entry-${entryIndex}:degree`,
  eduInstitution: (eduId: string, entryIndex: number) =>
    `${eduId}:entry-${entryIndex}:institution`,

  // Skills
  skill: (skillsId: string, skillIndex: number) =>
    `${skillsId}:skill-${skillIndex}`,
} as const;
