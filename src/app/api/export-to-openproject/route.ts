import { NextResponse } from "next/server";

const OP_URL = process.env.OPENPROJECT_URL?.replace(/\/$/, ""); // Remove trailing slash
const OP_KEY = process.env.OPENPROJECT_API_KEY;

const headers = {
  "Content-Type": "application/json",
  "Authorization": `Basic ${Buffer.from(`apikey:${OP_KEY}`).toString('base64')}`
};

// Helper to generate a URL-safe identifier
const generateIdentifier = (name: string) => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") + "-" + Math.floor(Math.random() * 10000);
};

export async function POST(request: Request) {
  try {
    const { plan } = await request.json();

    if (!plan || !OP_URL || !OP_KEY) {
      return NextResponse.json({ error: "Missing plan or OpenProject credentials in .env" }, { status: 400 });
    }

    // 1. Fetch Types to map Phase, Milestone, Task
    let typesResponse = await fetch(`${OP_URL}/api/v3/types`, { headers });
    if (!typesResponse.ok) {
        throw new Error("Failed to fetch Work Package Types from OpenProject");
    }
    const typesData = await typesResponse.json();
    const typeMap: Record<string, string> = {};
    
    // We assume OpenProject has "Phase", "Milestone", "Task" or we fallback to the first type available
    const defaultType = typesData._embedded.elements[0].id;
    typesData._embedded.elements.forEach((t: any) => {
        typeMap[t.name.toLowerCase()] = t.id;
    });

    const getTypeId = (name: string) => {
        return typeMap[name.toLowerCase()] || defaultType;
    };

    // 2. Create the Project
    const projectIdentifier = generateIdentifier(plan.projectName);
    const createProjectBody = {
      name: plan.projectName,
      identifier: projectIdentifier,
      description: {
        format: "markdown",
        raw: plan.description || ""
      }
    };

    const projectResponse = await fetch(`${OP_URL}/api/v3/projects`, {
      method: "POST",
      headers,
      body: JSON.stringify(createProjectBody)
    });

    if (!projectResponse.ok) {
      const err = await projectResponse.text();
      throw new Error(`Failed to create project: ${err}`);
    }

    const projectData = await projectResponse.json();
    const projectId = projectData.id;

    // Helper to create a work package
    const createWorkPackage = async (subject: string, description: string, typeName: string, parentId?: string) => {
        const body: any = {
            subject,
            description: {
                format: "markdown",
                raw: description
            },
            _links: {
                type: { href: `/api/v3/types/${getTypeId(typeName)}` },
                project: { href: `/api/v3/projects/${projectId}` }
            }
        };

        if (parentId) {
            body._links.parent = { href: `/api/v3/work_packages/${parentId}` };
        }

        const wpResponse = await fetch(`${OP_URL}/api/v3/projects/${projectId}/work_packages`, {
            method: "POST",
            headers,
            body: JSON.stringify(body)
        });

        if (!wpResponse.ok) {
            console.error(`Failed to create ${typeName}: ${subject}`);
            return null; // Don't throw, just skip if one fails to avoid complete crash
        }
        
        return await wpResponse.json();
    };

    // 3. Iterate over the plan and create hierarchy
    if (plan.phases && Array.isArray(plan.phases)) {
        for (const phase of plan.phases) {
            const phaseWp = await createWorkPackage(phase.name, phase.description || "", "Phase");
            const phaseId = phaseWp ? phaseWp.id : undefined;

            if (phase.milestones && Array.isArray(phase.milestones)) {
                for (const milestone of phase.milestones) {
                    const milestoneWp = await createWorkPackage(milestone.name, milestone.description || "", "Milestone", phaseId);
                    const milestoneId = milestoneWp ? milestoneWp.id : phaseId; // Fallback parent to phase if milestone creation fails

                    if (milestone.tasks && Array.isArray(milestone.tasks)) {
                        for (const task of milestone.tasks) {
                            await createWorkPackage(task.name, task.description || "", "Task", milestoneId);
                        }
                    }
                }
            }
        }
    }

    return NextResponse.json({ success: true, projectId: projectIdentifier });
  } catch (error: any) {
    console.error("Error exporting to OpenProject:", error);
    return NextResponse.json(
      { error: error.message || "Failed to export plan" },
      { status: 500 }
    );
  }
}
