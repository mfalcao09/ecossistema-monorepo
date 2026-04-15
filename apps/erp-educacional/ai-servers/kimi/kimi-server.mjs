#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "moonshotai/kimi-k2";
const KEY = process.env.OPENROUTER_API_KEY || "";

async function call(system, user) {
  const res = await fetch(URL, { method:"POST", headers:{"Content-Type":"application/json","Authorization":`Bearer ${KEY}`,"HTTP-Referer":"https://intentusrealestate.com.br","X-Title":"FIC"}, body:JSON.stringify({model:MODEL,max_tokens:16384,temperature:0.2,messages:[{role:"system",content:system},{role:"user",content:user}]})});
  if(!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
  return (await res.json()).choices[0].message.content;
}

const server = new Server({name:"kimi-ai-assistant",version:"0.1.0"},{capabilities:{tools:{}}});
server.setRequestHandler(ListToolsRequestSchema, async()=>({tools:[
  {name:"kimi_ask",description:"Ask Kimi K2 a question",inputSchema:{type:"object",properties:{question:{type:"string"},context:{type:"string"}},required:["question"]}},
  {name:"kimi_fix",description:"Fix bugs with Kimi K2",inputSchema:{type:"object",properties:{code:{type:"string"},issue:{type:"string"},language:{type:"string"}},required:["code","issue","language"]}},
  {name:"kimi_debug",description:"Debug code with Kimi K2",inputSchema:{type:"object",properties:{code:{type:"string"},error:{type:"string"},language:{type:"string"}},required:["code","error","language"]}}
]}));
server.setRequestHandler(CallToolRequestSchema, async(req)=>{
  const {name,arguments:a}=req.params;
  try {
    let r;
    if(name==="kimi_ask") r=await call("You are Kimi K2, 1T MoE by Moonshot AI, specialized in large codebases and precise fixes.",a.context?`${a.context}\n\n${a.question}`:a.question);
    else if(name==="kimi_fix") r=await call("You are Kimi K2, bug fix specialist. Provide corrected code with explanation.",`Fix this ${a.language} code.\nIssue: ${a.issue}\n\`\`\`${a.language}\n${a.code}\n\`\`\``);
    else if(name==="kimi_debug") r=await call("You are Kimi K2, debugging expert.",`Debug this ${a.language} code.\nError: ${a.error}\n\`\`\`${a.language}\n${a.code}\n\`\`\``);
    else throw new Error(`Unknown: ${name}`);
    return {content:[{type:"text",text:`## Kimi K2\n\n${r}`}]};
  } catch(e){return {content:[{type:"text",text:`Error: ${e.message}`}],isError:true};}
});
const t=new StdioServerTransport();await server.connect(t);console.error("Kimi K2 MCP Server running");
