import OpenAI from "openai";

export const EMBEDDING_DIMENSIONS = 1536;
export const OPENAI_EMBEDDING_MODEL = "text-embedding-3-small";
export const LOCAL_EMBEDDING_PROVIDER = "local:hash-1536";
export const OPENAI_EMBEDDING_PROVIDER = `openai:${OPENAI_EMBEDDING_MODEL}`;

export type EmbeddingResult = {
  provider: string;
  vectors: Float32Array[];
};

function normalize(vector: Float32Array) {
  let squaredLength = 0;
  for (const value of vector) squaredLength += value * value;
  const length = Math.sqrt(squaredLength) || 1;
  for (let index = 0; index < vector.length; index += 1) {
    vector[index] /= length;
  }
  return vector;
}

function hashToken(token: string) {
  let hash = 2166136261;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function localEmbedding(text: string) {
  const vector = new Float32Array(EMBEDDING_DIMENSIONS);
  const tokens = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const features = [...tokens];
  for (let index = 0; index < tokens.length - 1; index += 1) {
    features.push(`${tokens[index]}_${tokens[index + 1]}`);
  }
  for (const feature of features) {
    const hash = hashToken(feature);
    const slot = hash % EMBEDDING_DIMENSIONS;
    vector[slot] += (hash & 1) === 0 ? 1 : -1;
  }
  return normalize(vector);
}

export async function embedTexts(
  texts: string[],
  preferredProvider?: string,
): Promise<EmbeddingResult> {
  const forceLocal =
    process.env.BOOKLY_EMBEDDING_MODE === "local" ||
    preferredProvider === LOCAL_EMBEDDING_PROVIDER ||
    !process.env.OPENAI_API_KEY;

  if (forceLocal) {
    return {
      provider: LOCAL_EMBEDDING_PROVIDER,
      vectors: texts.map(localEmbedding),
    };
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const result = await openai.embeddings.create({
      model: OPENAI_EMBEDDING_MODEL,
      input: texts,
      dimensions: EMBEDDING_DIMENSIONS,
    });
    return {
      provider: OPENAI_EMBEDDING_PROVIDER,
      vectors: result.data.map((item) => new Float32Array(item.embedding)),
    };
  } catch (error) {
    console.warn("OpenAI embeddings unavailable; using deterministic local embeddings.", error);
    return {
      provider: LOCAL_EMBEDDING_PROVIDER,
      vectors: texts.map(localEmbedding),
    };
  }
}
