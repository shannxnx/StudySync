import http from "node:http";
export function startGeminiFixture() {
  const server = http.createServer(async (req, res) => {
    try {
      const parts = [];
      for await (const part of req) parts.push(part);
      const body = JSON.parse(Buffer.concat(parts).toString());
      const prompt = body.contents[0].parts[0].text;
      const quiz = prompt.includes("Generate exactly");
      const count = Number(prompt.match(/Generate exactly (\d+)/)?.[1] ?? 5);
      const types = (
        prompt.match(/using these types: ([^.]+)\./)?.[1] ?? "choice"
      ).split(", ");
      const result = quiz
        ? {
            sufficient: true,
            title: "Water cycle practice",
            questions: Array.from({ length: count }, (_, i) => ({
              question: "Practice question " + (i + 1) + " about evaporation",
              kind: types[i % types.length],
              options:
                types[i % types.length] === "boolean"
                  ? ["True", "False"]
                  : ["Vapor", "Ice", "Soil", "Stone"],
              correct: 0,
              reference: "S1",
              explanation: "The selected source describes water vapor.",
            })),
          }
        : {
            sufficient: true,
            title: "Water cycle reviewer",
            sections: [
              {
                heading: "Evaporation",
                body: "Water can become vapor.",
                keyPoints: ["During evaporation, liquid water becomes vapor."],
                selfCheck: {
                  question:
                    "What change of state takes place during evaporation?",
                  answer: "Liquid water changes to water vapor.",
                },
                reference: "S1",
              },
            ],
          };
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          candidates: [
            {
              content: {
                role: "model",
                parts: [{ text: JSON.stringify(result) }],
              },
              finishReason: "STOP",
            },
          ],
        }),
      );
    } catch {
      res.writeHead(400);
      res.end();
    }
  });
  return new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve(server)),
  );
}
