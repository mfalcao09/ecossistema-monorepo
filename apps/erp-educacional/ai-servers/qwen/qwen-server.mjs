#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "qwen/qwen3-coder";
const KEY = process.env.OPENROUTER_API_KEY || "";

async function call(system, user) {
  const res = await fetch(URL, { method:"POST", headers:{"Content-Type":"application/json","Authorization":`Bearer ${KEY}`,"HTTP-Referer":"https://intentusrealestate.com.br","X-Title":"FIC"}, body:JSON.stringify({model:MODEL,max_tokens:8192,temperature:0.3,messages:[{role:"system",content:system},{role:"user",content:user}]})});
  if(!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
  return (await res.json()).choices[0].message.content;
}

const server = new Server({name:"qwen-ai-assistant",version:"0.1.0"},{capabilities:{tools:{}}});
server.setRequestHandler(ListToolsRequestSchema, async()=>({tools:[{name:"qwen_ask",description:"Ask Qwen3-Coder (480B) a question",inputSchema:{type:"object",properties:{question:{type:"string"},context:{type:"string"}},required:["question"]}}]}));
server.setRequestHandler(CallToolRequestSchema, async(req)=>{
  const {name,arguments:a}=req.params;
  try {
    const prompt=a.context?`${a.context}\n\n${a.question}`:a.question;
    const r=await call("You are Qwen3-Coder, 480B MoE model specialized in React/TypeScript/Next.js. Be concise and practical.",prompt);
    return {content:[{type:"text",text:`## Qwen3-Coder\n\n${r}`}]};
  } catch(e){return {content:[{type:"text",text:`Error: ${e.message}`}],isError:true};}
});
const t=new StdioServerTransport();await server.connect(t);console.error("Qwen3-Coder MCP Server running");
