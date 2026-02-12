
import { GoogleGenAI, Type } from "@google/genai";
import { FieldDefinition } from "../types";

export const suggestMappings = async (
  targetFields: FieldDefinition[],
  sourceColumns: string[]
): Promise<Record<string, string>> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Suggest the best possible mapping between these target data fields and source Excel columns.
      Target Fields: ${JSON.stringify(targetFields.map(f => ({ id: f.id, name: f.name, desc: f.description })))}
      Source Columns: ${JSON.stringify(sourceColumns)}
      
      Return a JSON object where keys are Target Field IDs and values are the best matching Source Column Names. If no good match exists, skip it.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          additionalProperties: { type: Type.STRING }
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    return result;
  } catch (error) {
    console.error("Gemini Mapping Suggestion Error:", error);
    return {};
  }
};
