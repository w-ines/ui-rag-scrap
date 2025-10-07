
type Env = {
  BACKEND_API_URL: string; // Full URL to your backend RAG endpoint (e.g., https://api.example.com/rag)
};

function getRequiredEnv(name: keyof Env): string {
  const value = process.env[name as string];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env: Env = {
  BACKEND_API_URL: getRequiredEnv("BACKEND_API_URL"),
};


