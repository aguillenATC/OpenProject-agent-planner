import { NextResponse } from "next/server";
import { OpenAI } from "openai";

const openai = new OpenAI({
  baseURL: process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1",
  apiKey: "ollama", // Required by SDK but ignored by Ollama
});

export async function POST(request: Request) {
  try {
    const { prompt } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const modelName = process.env.OLLAMA_MODEL || "llama3";

    const systemPrompt = `You are an expert technical project manager. 
The user will provide a project description.
Your goal is to break this project down into a structured plan for OpenProject.
You MUST output a valid JSON object matching the following structure EXACTLY:
{
  "plan": {
    "projectName": "A concise name for the project",
    "description": "A short description of the project",
    "phases": [
      {
        "name": "Phase Name (e.g., Planning, Development)",
        "description": "Phase description",
        "milestones": [
          {
            "name": "Milestone Name",
            "description": "Milestone description",
            "tasks": [
              {
                "name": "Task Name",
                "description": "Detailed task description"
              }
            ]
          }
        ]
      }
    ]
  }
}
Do not include any other text, markdown blocks, or explanation. ONLY output the raw JSON.`;

    const completion = await openai.chat.completions.create({
      model: modelName,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2, // Low temperature for more consistent JSON structure
    });

    const responseContent = completion.choices[0].message.content;

    if (!responseContent) {
      throw new Error("Empty response from LLM");
    }

    let parsedPlan;
    try {
      parsedPlan = JSON.parse(responseContent);
    } catch (parseError) {
      console.error("Failed to parse LLM response:", responseContent);
      throw new Error("LLM did not return valid JSON");
    }

    return NextResponse.json(parsedPlan);
  } catch (error: any) {
    console.error("Error generating plan:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate plan" },
      { status: 500 }
    );
  }
}
