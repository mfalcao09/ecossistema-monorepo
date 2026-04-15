#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const URL = "https://api.deepseek.com/v1/chat/completions";
const MODEL = "deepseek-chat";
const KEY = process.env.DEEPSEEK_API_KEY || "";

async function call(system, user) {
  const res = await fetch(URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${KEY}`
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8192,
      temperature: 0.3,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    })
  });
  if (!res.ok) throw new Error(`DeepSeek API ${res.status}: ${await res.text()}`);
  return (await res.json()).choices[0].message.content;
}

const server = new Server({ name: "deepseek-ai-assistant", version: "0.1.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    { name: "deepseek_ask", description: "Ask DeepSeek V3 a question (especialista em lógica e raciocínio)", inputSchema: { type: "object", properties: { question: { type: "string" }, context: { type: "string" } }, required: ["question"] } },
    { name: "deepseek_debug", description: "Debug code with DeepSeek V3 (deep reasoning)", inputSchema: { type: "object", properties: { code: { type: "string" }, error: { type: "string" }, language: { type: "string" }, context: { type: "string" } }, required: ["code", "error", "language"] } },
    { name: "deepseek_sql", description: "Write or optimize SQL queries with DeepSeek V3", inputSchema: { type: "object", properties: { task: { type: "string" }, schema: { type: "string" }, dialect: { type: "string" } }, required: ["task"] } },
    { name: "deepseek_logic", description: "Solve complex logic/algorithm problems with DeepSeek V3", inputSchema: { type: "object", properties: { problem: { type: "string" }, context: { type: "string" } }, required: ["problem"] } },
    { name: "deepseek_code_review", description: "Code review by DeepSeek V3", inputSchema: { type: "object", properties: { code: { type: "string" }, language: { type: "string" }, context: { type: "string" } }, required: ["code", "language"] } }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: a } = req.params;
  try {
    let r;
    if (name === "deepseek_ask") {
      r = await call("You are DeepSeek V3, specialized in complex reasoning, logic, and problem solving. Be precise and analytical.", a.context ? `${a.context}\n\n${a.question}` : a.question);
    } else if (name === "deepseek_debug") {
      r = await call("You are DeepSeek V3, deep debugging specialist. Analyze root causes with rigorous reasoning.", `Debug this ${a.language} code.\nError: ${a.error}\n\`\`\`${a.language}\n${a.code}\n\`\`\`${a.context ? '\nContext: ' + a.context : ''}`);
    } else if (name === "deepseek_sql") {
      r = await call("You are DeepSeek V3, SQL and database expert. Write optimized, correct queries.", `Task: ${a.task}${a.schema ? '\nSchema:\n' + a.schema : ''}${a.dialect ? '\nDialect: ' + a.dialect : '\nDialect: PostgreSQL'}`);
    } else if (name === "deepseek_logic") {
      r = await call("You are DeepSeek V3, expert in algorithms, logic, and complex problem solving. Think step by step.", a.context ? `${a.context}\n\n${a.problem}` : a.problem);
    } else if (name === "deepseek_code_review") {
      r = await call("You are DeepSeek V3, expert code reviewer focused on correctness and logic.", `Review this ${a.language} code:\n\`\`\`${a.language}\n${a.code}\n\`\`\`${a.context ? '\nContext: ' + a.context : ''}`);
    } else {
      throw new Error(`Unknown tool: ${name}`);
    }
    return { content: [{ type: "text", text: `## DeepSeek V3\n\n${r}` }] };
  } catch (e) {
    return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
  }
});

const t = new StdioServerTransport();
await server.connect(t);
console.error("DeepSeek V3 MCP Server running");
