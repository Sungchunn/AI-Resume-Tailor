import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { TechStackLogos } from "@/components/ui/TechStackLogos";
import { ImageComparisonSlider } from "@/components/ui/ImageComparisonSlider";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero + Tech Stack Section - Full viewport height */}
        <div className="min-h-screen flex flex-col bg-linear-to-b from-background to-card">
          {/* Hero stays centered */}
          <section className="flex-1 flex items-center justify-center pt-16">
            <div className="mx-auto w-full max-w-screen-2xl px-4 sm:px-6 lg:px-8">
              <div className="text-center">
                <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl">
                  Tailor Your Resume with{" "}
                  <span className="text-primary">AI</span>
                </h1>
                <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
                  Stop sending generic resumes. Our AI analyzes job descriptions
                  and customizes your resume to match what employers are looking for.
                </p>

                <ImageComparisonSlider
                  className="mx-auto mt-8 max-w-screen-2xl"
                  originalSrc="/landing/resume-original-204830.png"
                  comparisonSrc="/landing/resume-tailored-202957.png"
                  originalAlt="Original resume screenshot before tailoring"
                  comparisonAlt="Resume screenshot after AI tailoring"
                />
              </div>
            </div>
          </section>

          {/* Logo loop is independent */}
          <div className="mt-auto pb-10">
            <TechStackLogos className="py-20" />
          </div>
        </div>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-28 scroll-mt-24 bg-background">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-foreground">
                How It Works
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Three simple steps to a perfectly tailored resume
              </p>
            </div>

            <div className="mt-16 grid gap-8 md:grid-cols-3">
              <div className="card text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/20 text-primary">
                  <span className="text-xl font-bold">1</span>
                </div>
                <h3 className="text-lg font-semibold text-foreground">
                  Upload Your Resume
                </h3>
                <p className="mt-2 text-muted-foreground">
                  Paste or upload your existing resume. We&apos;ll parse and
                  structure your experience.
                </p>
              </div>

              <div className="card text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/20 text-primary">
                  <span className="text-xl font-bold">2</span>
                </div>
                <h3 className="text-lg font-semibold text-foreground">
                  Add Job Description
                </h3>
                <p className="mt-2 text-muted-foreground">
                  Paste the job posting you&apos;re applying for. Our AI
                  extracts key requirements.
                </p>
              </div>

              <div className="card text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/20 text-primary">
                  <span className="text-xl font-bold">3</span>
                </div>
                <h3 className="text-lg font-semibold text-foreground">
                  Get Tailored Resume
                </h3>
                <p className="mt-2 text-muted-foreground">
                  Receive a customized resume that highlights relevant skills
                  and experience.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="bg-primary py-16">
          <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-primary-foreground">
              Ready to land your dream job?
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-primary-foreground/80">
              Join thousands of job seekers who have improved their application
              success rate.
            </p>
            <Link
              href="/signup"
              className="mt-8 inline-flex items-center justify-center rounded-lg bg-background px-8 py-3 font-medium text-foreground hover:bg-background/90 transition-colors"
            >
              Start Free Trial
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
