import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="bg-gradient-to-b from-primary-50 to-white py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
                Tailor Your Resume with{" "}
                <span className="text-primary-600">AI</span>
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600">
                Stop sending generic resumes. Our AI analyzes job descriptions
                and customizes your resume to match what employers are looking
                for.
              </p>
              <div className="mt-10 flex items-center justify-center gap-4">
                <Link href="/signup" className="btn-primary text-base px-8 py-3">
                  Get Started Free
                </Link>
                <Link href="/dashboard" className="btn-secondary text-base px-8 py-3">
                  View Demo
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-gray-900">
                How It Works
              </h2>
              <p className="mt-4 text-lg text-gray-600">
                Three simple steps to a perfectly tailored resume
              </p>
            </div>

            <div className="mt-16 grid gap-8 md:grid-cols-3">
              <div className="card text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-primary-600">
                  <span className="text-xl font-bold">1</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Upload Your Resume
                </h3>
                <p className="mt-2 text-gray-600">
                  Paste or upload your existing resume. We&apos;ll parse and
                  structure your experience.
                </p>
              </div>

              <div className="card text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-primary-600">
                  <span className="text-xl font-bold">2</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Add Job Description
                </h3>
                <p className="mt-2 text-gray-600">
                  Paste the job posting you&apos;re applying for. Our AI
                  extracts key requirements.
                </p>
              </div>

              <div className="card text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-primary-600">
                  <span className="text-xl font-bold">3</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Get Tailored Resume
                </h3>
                <p className="mt-2 text-gray-600">
                  Receive a customized resume that highlights relevant skills
                  and experience.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="bg-primary-600 py-16">
          <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-white">
              Ready to land your dream job?
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-primary-100">
              Join thousands of job seekers who have improved their application
              success rate.
            </p>
            <Link
              href="/signup"
              className="mt-8 inline-flex items-center justify-center rounded-lg bg-white px-8 py-3 font-medium text-primary-600 hover:bg-primary-50 transition-colors"
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
