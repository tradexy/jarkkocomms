const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const FLASH = "deepseek-v4-flash";
const PRO = "deepseek-v4-pro";

function pickModel(requested) {
  return requested === PRO ? PRO : FLASH;
}

export async function runBrief({ key, model, messages }) {
  if (!key || typeof key !== "string") {
    const error = new Error("DeepSeek key missing");
    error.status = 401;
    throw error;
  }
  const allowed = pickModel(model);
  const response = await fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: allowed,
      messages,
      stream: false,
      max_tokens: 500,
      thinking: { type: "disabled" },
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || `DeepSeek ${response.status}`;
    const error = new Error(message);
    error.status = response.status === 401 ? 401 : 502;
    throw error;
  }
  return {
    text: payload?.choices?.[0]?.message?.content ?? "",
    model: allowed,
    billedTo: "your DeepSeek account",
  };
}
