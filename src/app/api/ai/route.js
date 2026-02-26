import OpenAI from "openai";

export async function POST(req) {
  const { message } = await req.json();

  const client = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
  });

  try {
    const completion = await client.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: [
        {
          role: "system",
          content: `
You are an AI Cybersecurity Audit Assistant.

When explaining vulnerabilities:
1. Explain in simple language.
2. Explain business impact.
3. Provide risk level (Low/Medium/High).
4. Suggest mitigation.
          `,
        },
        { role: "user", content: message },
      ],
      temperature: 0.3,
      max_tokens: 800,
    });

    return Response.json({
      reply: completion.choices[0].message.content,
    });
  } catch (error) {
    return Response.json({
      reply: "AI service temporarily unavailable.",
    });
  }
}