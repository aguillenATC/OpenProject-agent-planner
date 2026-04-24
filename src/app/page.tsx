"use client";

import { useState } from "react";
import styles from "./page.module.css";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      // Step 1: Generate Plan with LLM
      setStatusText("Generating project plan with local LLM...");
      const llmResponse = await fetch("/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (!llmResponse.ok) {
        throw new Error("Failed to generate plan. Please check the LLM settings.");
      }

      const planData = await llmResponse.json();

      // Step 2: Export to OpenProject
      setStatusText("Creating Work Packages in OpenProject...");
      const openProjectResponse = await fetch("/api/export-to-openproject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planData.plan }),
      });

      if (!openProjectResponse.ok) {
        const errData = await openProjectResponse.json();
        throw new Error(errData.error || "Failed to export to OpenProject.");
      }

      const exportResult = await openProjectResponse.json();
      
      setStatusText("Finished!");
      setResult(`Successfully created project and tasks in OpenProject. Project ID: ${exportResult.projectId}`);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
      setStatusText("");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>OpenProject Planner</h1>
        <p className={styles.subtitle}>
          Describe your project, and our local LLM will automatically break it down into phases, milestones, and tasks inside your OpenProject instance.
        </p>
      </header>

      <section className={styles.card}>
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="prompt" className={styles.label}>
              Project Description
            </label>
            <textarea
              id="prompt"
              className={styles.textarea}
              placeholder="E.g., Build a new e-commerce website with user authentication, a product catalog, and a shopping cart checkout flow."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            className={styles.button}
            disabled={isLoading || !prompt.trim()}
          >
            {isLoading ? (
              <>
                <svg className={styles.spinner} viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeDasharray="32" strokeLinecap="round" />
                </svg>
                Processing...
              </>
            ) : (
              "Generate & Export"
            )}
          </button>
        </form>

        {(isLoading || statusText || error || result) && (
          <div className={styles.statusContainer}>
            {statusText && !error && !result && (
              <div className={styles.statusItem}>
                <svg className={styles.spinner} viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeDasharray="32" strokeLinecap="round" />
                </svg>
                <span>{statusText}</span>
              </div>
            )}

            {error && (
              <div className={styles.statusItem}>
                <svg className={`${styles.statusIcon} ${styles.errorIcon}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="15" y1="9" x2="9" y2="15"></line>
                  <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
                <div className={styles.errorText}>{error}</div>
              </div>
            )}

            {result && (
              <div className={styles.statusItem}>
                <svg className={`${styles.statusIcon} ${styles.successIcon}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                <span>{result}</span>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
