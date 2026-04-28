"use client";

import { useState } from "react";
import styles from "./page.module.css";

interface Task {
  id: string;
  name: string;
  description: string;
  selected: boolean;
}

interface Milestone {
  id: string;
  name: string;
  description: string;
  selected: boolean;
  tasks: Task[];
}

interface Phase {
  id: string;
  name: string;
  description: string;
  selected: boolean;
  milestones: Milestone[];
}

interface Plan {
  projectName: string;
  description: string;
  phases: Phase[];
}

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [generatedPlan, setGeneratedPlan] = useState<Plan | null>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsLoading(true);
    setError(null);
    setResult(null);
    setGeneratedPlan(null);

    try {
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
      
      // Process the plan to add IDs and selection state
      const processedPlan: Plan = {
        ...planData.plan,
        phases: planData.plan.phases.map((phase: Phase, pIdx: number) => ({
          ...phase,
          id: `p-${pIdx}`,
          selected: true,
          milestones: phase.milestones.map((ms: Milestone, mIdx: number) => ({
            ...ms,
            id: `p-${pIdx}-m-${mIdx}`,
            selected: true,
            tasks: ms.tasks.map((t: Task, tIdx: number) => ({
              ...t,
              id: `p-${pIdx}-m-${mIdx}-t-${tIdx}`,
              selected: true
            }))
          }))
        }))
      };

      setGeneratedPlan(processedPlan);
      setStatusText("");
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
      setStatusText("");
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async () => {
    if (!generatedPlan) return;

    setIsExporting(true);
    setError(null);
    setResult(null);

    try {
      // Filter out unselected items
      const finalPlan = {
        ...generatedPlan,
        phases: generatedPlan.phases
          .filter(p => p.selected)
          .map(phase => ({
            ...phase,
            milestones: phase.milestones
              .filter(m => m.selected)
              .map(ms => ({
                ...ms,
                tasks: ms.tasks.filter(t => t.selected)
              }))
              .filter(m => m.tasks.length > 0 || m.selected) // Keep milestones even if empty but selected? Usually yes.
          }))
          .filter(p => p.milestones.length > 0 || p.selected)
      };

      setStatusText("Creating Work Packages in OpenProject...");
      const openProjectResponse = await fetch("/api/export-to-openproject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: finalPlan }),
      });

      if (!openProjectResponse.ok) {
        const errData = await openProjectResponse.json();
        throw new Error(errData.error || "Failed to export to OpenProject.");
      }

      const exportResult = await openProjectResponse.json();
      
      setStatusText("Finished!");
      setResult(`Successfully created project and tasks in OpenProject. Project ID: ${exportResult.projectId}`);
      setGeneratedPlan(null); // Clear plan after success
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
      setStatusText("");
    } finally {
      setIsExporting(false);
    }
  };

  const togglePhase = (phaseId: string) => {
    if (!generatedPlan) return;
    setGeneratedPlan({
      ...generatedPlan,
      phases: generatedPlan.phases.map(p => {
        if (p.id === phaseId) {
          const newSelected = !p.selected;
          return {
            ...p,
            selected: newSelected,
            milestones: p.milestones.map(m => ({
              ...m,
              selected: newSelected,
              tasks: m.tasks.map(t => ({ ...t, selected: newSelected }))
            }))
          };
        }
        return p;
      })
    });
  };

  const toggleMilestone = (phaseId: string, milestoneId: string) => {
    if (!generatedPlan) return;
    setGeneratedPlan({
      ...generatedPlan,
      phases: generatedPlan.phases.map(p => {
        if (p.id === phaseId) {
          return {
            ...p,
            milestones: p.milestones.map(m => {
              if (m.id === milestoneId) {
                const newSelected = !m.selected;
                return {
                  ...m,
                  selected: newSelected,
                  tasks: m.tasks.map(t => ({ ...t, selected: newSelected }))
                };
              }
              return m;
            })
          };
        }
        return p;
      })
    });
  };

  const toggleTask = (phaseId: string, milestoneId: string, taskId: string) => {
    if (!generatedPlan) return;
    setGeneratedPlan({
      ...generatedPlan,
      phases: generatedPlan.phases.map(p => {
        if (p.id === phaseId) {
          return {
            ...p,
            milestones: p.milestones.map(m => {
              if (m.id === milestoneId) {
                return {
                  ...m,
                  tasks: m.tasks.map(t => {
                    if (t.id === taskId) return { ...t, selected: !t.selected };
                    return t;
                  })
                };
              }
              return m;
            })
          };
        }
        return p;
      })
    });
  };

  const removeItem = (phaseId: string, milestoneId?: string, taskId?: string) => {
    if (!generatedPlan) return;
    setGeneratedPlan({
      ...generatedPlan,
      phases: generatedPlan.phases.map(p => {
        if (p.id === phaseId) {
          if (!milestoneId) return null; // Remove phase
          return {
            ...p,
            milestones: p.milestones.map(m => {
              if (m.id === milestoneId) {
                if (!taskId) return null; // Remove milestone
                return {
                  ...m,
                  tasks: m.tasks.filter(t => t.id !== taskId)
                };
              }
              return m;
            }).filter(Boolean) as Milestone[]
          };
        }
        return p;
      }).filter(Boolean) as Phase[]
    });
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
        {!generatedPlan ? (
          <form className={styles.form} onSubmit={handleGenerate}>
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
                  Generating Plan...
                </>
              ) : (
                "Generate Plan"
              )}
            </button>
          </form>
        ) : (
          <div className={styles.reviewSection}>
            <div className={styles.header}>
              <h2 className={styles.reviewTitle}>Review Your Plan</h2>
              <p className={styles.reviewDescription}>
                Audit the generated structure for <strong>{generatedPlan.projectName}</strong>. Deselect items you don&apos;t want to export or remove them entirely.
              </p>
            </div>

            <div className={styles.planContainer}>
              {generatedPlan.phases.map((phase) => (
                <div key={phase.id} className={styles.phaseCard}>
                  <div className={styles.phaseHeader}>
                    <label className={styles.phaseTitle}>
                      <input
                        type="checkbox"
                        className={styles.checkbox}
                        checked={phase.selected}
                        onChange={() => togglePhase(phase.id)}
                      />
                      <span>Phase: {phase.name}</span>
                    </label>
                    <button className={styles.removeButton} onClick={() => removeItem(phase.id)}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                  </div>

                  <div className={styles.milestoneList}>
                    {phase.milestones.map((ms) => (
                      <div key={ms.id} className={styles.milestoneItem}>
                        <div className={styles.milestoneHeader}>
                          <label className={styles.milestoneTitle}>
                            <input
                              type="checkbox"
                              className={styles.checkbox}
                              checked={ms.selected}
                              onChange={() => toggleMilestone(phase.id, ms.id)}
                            />
                            <span>Milestone: {ms.name}</span>
                          </label>
                          <button className={styles.removeButton} onClick={() => removeItem(phase.id, ms.id)}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                          </button>
                        </div>

                        <div className={styles.taskList}>
                          {ms.tasks.map((task) => (
                            <div key={task.id} className={styles.taskItem}>
                              <label className={styles.itemLabel}>
                                <input
                                  type="checkbox"
                                  className={styles.checkbox}
                                  checked={task.selected}
                                  onChange={() => toggleTask(phase.id, ms.id, task.id)}
                                />
                                <span>{task.name}</span>
                              </label>
                              <button className={styles.removeButton} onClick={() => removeItem(phase.id, ms.id, task.id)}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.footer}>
              <button
                className={styles.secondaryButton}
                onClick={() => setGeneratedPlan(null)}
                disabled={isExporting}
              >
                Back to Edit Prompt
              </button>
              <button
                className={styles.button}
                onClick={handleExport}
                disabled={isExporting || !generatedPlan.phases.some(p => p.selected)}
              >
                {isExporting ? (
                  <>
                    <svg className={styles.spinner} viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeDasharray="32" strokeLinecap="round" />
                    </svg>
                    Exporting to OpenProject...
                  </>
                ) : (
                  "Export to OpenProject"
                )}
              </button>
            </div>
          </div>
        )}

        {(isLoading || isExporting || statusText || error || result) && (
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
