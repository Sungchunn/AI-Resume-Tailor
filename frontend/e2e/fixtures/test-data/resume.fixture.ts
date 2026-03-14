export interface ResumeTestConfig {
  experienceCount: number;
  bulletsPerEntry: number;
  bulletLength: number;
  educationCount: number;
  skillCount: number;
}

export const RESUME_PRESETS = {
  /** Fits on one page - no scaling needed */
  minimal: {
    experienceCount: 1,
    bulletsPerEntry: 3,
    bulletLength: 60,
    educationCount: 1,
    skillCount: 5,
  },

  /** Slight overflow (1-10%) - needs minor scaling */
  slightOverflow: {
    experienceCount: 3,
    bulletsPerEntry: 4,
    bulletLength: 80,
    educationCount: 2,
    skillCount: 12,
  },

  /** Moderate overflow (10-50%) - needs significant scaling */
  moderateOverflow: {
    experienceCount: 5,
    bulletsPerEntry: 5,
    bulletLength: 90,
    educationCount: 3,
    skillCount: 20,
  },

  /** Severe overflow (>50%) - will hit minimum thresholds */
  severeOverflow: {
    experienceCount: 8,
    bulletsPerEntry: 6,
    bulletLength: 100,
    educationCount: 4,
    skillCount: 30,
  },
} as const;

export function generateBullet(targetLength: number): string {
  const starters = ["Developed", "Led", "Implemented", "Designed", "Optimized"];
  let bullet = starters[Math.floor(Math.random() * starters.length)];
  const filler = " technology solution delivering measurable business value";
  while (bullet.length < targetLength) {
    bullet += filler;
  }
  return bullet.substring(0, targetLength);
}

export function generateResumeContent(config: ResumeTestConfig) {
  return {
    contact: {
      name: "Test User",
      email: "test@example.com",
      phone: "(555) 123-4567",
      location: "San Francisco, CA",
    },
    summary: "Experienced software engineer with expertise in full-stack development.",
    experience: Array.from({ length: config.experienceCount }, (_, i) => ({
      title: `Senior Software Engineer ${i + 1}`,
      company: `Tech Company ${i + 1}`,
      location: "Remote",
      start_date: "2020-01",
      end_date: i === 0 ? "Present" : `202${i}-12`,
      bullets: Array.from({ length: config.bulletsPerEntry }, () =>
        generateBullet(config.bulletLength)
      ),
    })),
    education: Array.from({ length: config.educationCount }, (_, i) => ({
      degree: `Bachelor of Science in Computer Science`,
      institution: `University ${i + 1}`,
      graduation_date: `201${i}`,
    })),
    skills: Array.from({ length: config.skillCount }, (_, i) => `Skill ${i + 1}`),
  };
}
