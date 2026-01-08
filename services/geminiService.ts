import { GoogleGenAI, Type } from "@google/genai";

const getAiClient = (passedKey?: string) => {
  const apiKey = passedKey || process.env.API_KEY || (typeof window !== 'undefined' ? localStorage.getItem('gemini_api_key') : null);
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

// ==================== AI Logic ====================

/**
 * Build the generation prompt with base template + user-defined style
 * If user provides a custom style, it takes priority over the preset style
 */
const buildStickerPrompt = (manualStyle?: string): string => {
  const basePrompt = `为图中角色设计一个可爱的卡通角色，生成 16种 LINE 贴纸。姿势和文字排版要富有创意，变化丰富，设计独特。对话应为简体中文，可以是角色在不同场景，不同情绪的，角色比例二头身。

重要要求：背景必须是纯白色(#FFFFFF)，不要有任何其他颜色或图案。每个贴纸之间要有足够间距。`;

  const styleDescription = manualStyle && manualStyle.trim()
    ? manualStyle.trim()
    : "可爱的卡通二头身角色，适合日常聊天";

  return `${basePrompt}\n画面风格：${styleDescription}`;
};

/**
 * Generate a sticker sheet using Gemini 3 Pro Image model
 */
export const generateStickerSheet = async (
  referenceImage: string,
  manualStyle?: string,
  userApiKey?: string
): Promise<string> => {
  const ai = getAiClient(userApiKey);
  if (!ai) throw new Error("API_KEY is not set");

  try {
    // Remove data:image/xxx;base64, prefix if present
    const cleanBase64 = referenceImage.includes(',')
      ? referenceImage.split(',')[1]
      : referenceImage;

    const prompt = buildStickerPrompt(manualStyle);

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/png',
              data: cleanBase64
            }
          },
          {
            text: prompt
          }
        ]
      }
    });

    // Extract the generated image from response
    if (response.candidates && response.candidates[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const mimeType = part.inlineData.mimeType || 'image/png';
          return `data:${mimeType};base64,${part.inlineData.data}`;
        }
      }
    }

    throw new Error("No image returned from generation");

  } catch (error) {
    console.error("Sticker Generation Error:", error);
    throw error;
  }
};

// ==================== Sticker Naming ====================

export const generateStickerName = async (base64Image: string, userApiKey?: string): Promise<string> => {
  const ai = getAiClient(userApiKey);
  if (!ai) return "sticker";

  try {
    // Remove data:image/png;base64, prefix
    const cleanBase64 = base64Image.split(',')[1];

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/png',
              data: cleanBase64
            }
          },
          {
            text: "Analyze this sticker. Return a JSON object with a 'filename' property containing a short, descriptive name (max 3 words) in English using snake_case. If there is text, try to capture the meaning or emotion. Example: 'sad_crying', 'thumbs_up', 'working_hard'."
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            filename: { type: Type.STRING }
          }
        }
      }
    });

    if (response.text) {
      const data = JSON.parse(response.text);
      return data.filename || "sticker";
    }
    return "sticker";

  } catch (error) {
    console.error("Gemini Naming Error:", error);
    return "sticker"; // Fallback
  }
};
