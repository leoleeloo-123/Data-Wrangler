
import { GoogleGenAI, Type } from "@google/genai";
import { FieldDefinition } from "../types";

export const suggestMappings = async (
  targetFields: FieldDefinition[],
  sourceColumns: string[]
): Promise<Record<string, string>> => {
  // Use the API key directly from process.env.API_KEY as per guidelines
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
          // Correctly define properties for Type.OBJECT as it cannot be empty
          properties: targetFields.reduce((acc, field) => {
            acc[field.id] = { 
              type: Type.STRING,
              description: `Matching source column for ${field.name}`
            };
            return acc;
          }, {} as Record<string, any>)
        }
      }
    });

    // Use response.text property directly
    const result = JSON.parse(response.text || "{}");
    return result;
  } catch (error) {
    console.error("Gemini Mapping Suggestion Error:", error);
    return {};
  }
};
