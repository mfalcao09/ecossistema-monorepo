#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "mistralai/codestral-2508";
const KEY = process.env.OPENROUTER_API_KEY || "";

async function call(system, user) {
  const res = await fetch(URL, { method:"POST", headers:{"Content-Type":"application/json","Authorization":`Bearer ${KEY}`,"HTTP-Referer":"https://intentusrealestate.com.br","X-Title":"FIC"}, body:JSON.stringify({model:MODEL,max_tokens:8192,temperature:0.2,messages:[{role:"system",content:system},{role:"user",content:user}]})});
  if(!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
  return (await res.json()).choices[0].message.content;
}

const server = new Server({name:"codestral-ai-assistant",version:"0.1.0"},{capabilities:{tools:{}}});
server.setRequestHandler(ListToolsRequestSchema, async()=>({tools:[
  {name:"codestral_ask",description:"Ask Codestral (Mistral, 80+ languages) a question",inputSchema:{type:"object",properties:{question:{type:"string"},context:{type:"string"}},required:["question"]}},
  {name:"codestral_code_review",description:"Code review by Codestral",inputSchema:{type:"object",properties:{code:{type:"string"},language:{type:"string"},context:{type:"string"}},required:["code","language"]}},
  {name:"codestral_alternative",description:"Alternative implementation by Codestral",inputSchema:{type:"object",properties:{code:{type:"string"},language:{type:"string"},goal:{type:"string"}},required:["code","language"]}}
]}));
server.setRequestHandler(CallToolRequestSchema, async(req)=>{
  const {name,arguments:a}=req.params;
  try {
    let r;
    if(name==="codestral_ask") r=await call("You are Codestral, Mistral AI code model for 80+ languages. Be precise and idiomatic.",a.context?`${a.context}\n\n${a.question}`:a.question);
    else if(name==="codestral_code_review") r=await call("You are Codestral, expert code reviewer across 80+ languages.",`Review this ${a.language} code:\n\`\`\`${a.language}\n${a.code}\n\`\`\`${a.context?'\nContext: '+a.context:''}`);
    else if(name==="codestral_alternative") r=await call("You are Codestral, expert at refactoring.",`Alternative for this ${a.language} code, optimizing for: ${a.goal||'readability'}\n\`\`\`${a.language}\n${a.code}\n\`\`\``);
    else throw new Error(`Unknown: ${name}`);
    return {content:[{type:"text",text:`## Codestral\n\n${r}`}]};
  } catch(e){return {content:[{type:"text",text:`Error: ${e.message}`}],isError:true};}
});
const t=new StdioServerTransport();await server.connect(t);console.error("Codestral MCP Server running");
