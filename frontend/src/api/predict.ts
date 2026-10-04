import { MOCK_CAT_PREDICTIONS } from "../config/theme";

export interface PredictionItem {
  label: string;
  confidence: number;
}

export interface PredictionResponse {
  predictions: PredictionItem[];
  bbox: [number, number, number, number]; // [x, y, width, height]
  status: "success" | "no_face" | "error";
  message?: string;
}

/**
 * Predicts facial expression / cat vibe.
 * Supports VITE_MOCK=true (default for Step 13).
 */
export async function predictExpression(
  _imageSource?: string | null
): Promise<PredictionResponse> {
  const isMock = import.meta.env.VITE_MOCK !== "false";

  if (isMock) {
    // Simulate lightweight network / analysis latency
    await new Promise((resolve) => setTimeout(resolve, 600));

    // Random choice from requested mock pool
    const randomLabel =
      MOCK_CAT_PREDICTIONS[
        Math.floor(Math.random() * MOCK_CAT_PREDICTIONS.length)
      ];
    const randomConfidence = +(0.75 + Math.random() * 0.23).toFixed(2);

    // Mock bounding box centered in a 640x480 frame
    const mockBbox: [number, number, number, number] = [160, 90, 320, 300];

    return {
      predictions: [
        {
          label: randomLabel,
          confidence: randomConfidence,
        },
      ],
      bbox: mockBbox,
      status: "success",
    };
  }

  // Fallback placeholder when live backend is connected in future steps
  throw new Error("Live CV API endpoint not yet configured. Use VITE_MOCK=true.");
}
