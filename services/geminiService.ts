
import { GoogleGenAI, Type } from "@google/genai";
import { FileNode, AIResponse } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function refineResume(files: FileNode[], jobDescription: string): Promise<AIResponse> {
  // Flatten files to get all .tex contents
  const texFiles: { path: string; content: string }[] = [];
  const collect = (nodes: FileNode[]) => {
    for (const node of nodes) {
      if (node.type === 'file' && node.name.endsWith('.tex') && node.content) {
        texFiles.push({ path: node.path, content: node.content });
      }
      if (node.children) collect(node.children);
    }
  };
  collect(files);

  const prompt = `
    You are an expert Resume Optimizer and LaTeX specialist. 
    I will provide you with a list of LaTeX files representing my resume and a Job Description (JD).
    Your task is to refine the LaTeX content in these files to better align with the JD.
    
    STRICT FORMATTING RULES:
    1. PROPER INDENTATION: Always use consistent indentation (2 spaces) for environments like \\begin{itemize} ... \\end{itemize}. 
    2. LINE BREAKS: Ensure each \\item is on its own line.
    3. NO CLUTTER: Do not add unnecessary comments or meta-text inside the LaTeX content.
    4. PRESERVE STRUCTURE: Keep custom commands like \\resumeSubheading, \\resumeItem, etc., exactly as defined in the source, but update their arguments to reflect the JD.
    5. CLEAN OUTPUT: The output should be ready to compile. Ensure all braces { } are balanced and special characters (like &, %, _) are properly escaped according to LaTeX standards if they are part of the text content.
    6. SPACING: Ensure there is a blank line between major sections or high-level environments for readability.

    CONTENT GUIDELINES:
    1. Focus on keywords and impact. Use strong action verbs.
    2. Align project descriptions and work experience bullet points directly with the requirements of the JD.
    3. If a section is already perfect, do not change it.
    4. Provide the FULL content for any file that requires a change.
    
    JOB DESCRIPTION:
    ${jobDescription}
    
    RESUME FILES:
    ${texFiles.map(f => `--- FILE: ${f.path} ---\n${f.content}`).join('\n\n')}
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          generalAdvice: {
            type: Type.STRING,
            description: "A summary of what changes were made and why based on the JD."
          },
          suggestions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                filePath: { type: Type.STRING, description: "The path of the file to update." },
                refinedContent: { type: Type.STRING, description: "The full updated LaTeX content for this file with perfect indentation." },
                explanation: { type: Type.STRING, description: "Why this change was made." }
              },
              required: ["filePath", "refinedContent", "explanation"]
            }
          }
        },
        required: ["generalAdvice", "suggestions"]
      }
    }
  });

  try {
    const text = response.text;
    if (!text) throw new Error("Empty response from AI");
    const data = JSON.parse(text);
    return data as AIResponse;
  } catch (error) {
    console.error("Failed to parse Gemini response:", error);
    throw new Error("Invalid response format from AI. Please try again.");
  }
}
