/**
 * Real API client for Purrsonality CV Engine.
 * Connects frontend directly to the local Python FastAPI backend at http://127.0.0.1:8000.
 */

export interface Prediction {
  label: string;
  confidence: number;
}

// Backward-compatibility alias
export type PredictionItem = Prediction;

export interface CatResult {
  id?: string | null;
  name?: string | null;
  image_path?: string | null;
  image_url?: string | null;
  caption?: string | null;
}

export interface FacialFeatures {
  ear_avg: number;
  mar: number;
  mouth_width: number;
  smile: number;
}

export interface PredictResponse {
  predictions: Prediction[];
  bbox: [number, number, number, number] | null;
  cat?: CatResult | null;
  features?: FacialFeatures | null;
}

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

/**
 * Checks if the Python FastAPI CV backend is running and reachable.
 */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data?.status === "ok";
  } catch {
    return false;
  }
}

/**
 * Resolves the absolute browser URL for a cat meme image served statically by FastAPI.
 */
export function getCatImageUrl(cat?: CatResult | null): string | null {
  if (!cat || !cat.image_url) return null;
  if (cat.image_url.startsWith("http://") || cat.image_url.startsWith("https://")) {
    return cat.image_url;
  }
  const cleanPath = cat.image_url.startsWith("/") ? cat.image_url : `/${cat.image_url}`;
  return `${API_BASE_URL}${cleanPath}`;
}

/**
 * Sends a captured webcam frame to the real Python CV backend for
 * landmark detection, feature calculation, expression classification, and meme matching.
 */
export async function predictExpression(
  imageDataUrl: string
): Promise<PredictResponse> {
  if (!imageDataUrl || typeof imageDataUrl !== "string") {
    throw new Error("Invalid webcam capture image data.");
  }

  const response = await fetch(`${API_BASE_URL}/predict`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      image: imageDataUrl,
    }),
  });

  if (!response.ok) {
    let errorDetail = `Backend HTTP error ${response.status}`;
    try {
      const errJson = await response.json();
      if (errJson?.detail) {
        errorDetail = typeof errJson.detail === "string"
          ? errJson.detail
          : JSON.stringify(errJson.detail);
      }
    } catch {
      // Fallback to HTTP error
    }
    throw new Error(errorDetail);
  }

  const result: PredictResponse = await response.json();
  return result;
}
