import os
import json
import sys
from typing import List, Dict, Any
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from groq import Groq
from fastmcp import Client
from fastmcp.client.transports import StdioTransport

load_dotenv()

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# Connect directly to our local python script!
# Create the explicit STDIO transport
MCP_TRANSPORT = StdioTransport(
    command=sys.executable,
    args=["mcp_server.py"],
    env={}
)

class ChatRequest(BaseModel):
    message: str

@app.post("/chat")
async def chat(req: ChatRequest):
    try:
        async with Client(MCP_TRANSPORT) as mcp_client:
            tools = await mcp_client.list_tools()
            
            groq_tools = []
            for t in tools:
                groq_tools.append({
                    "type": "function",
                    "function": {
                        "name": t.name,
                        "description": t.description,
                        "parameters": t.inputSchema,
                    }
                })
            
            messages = [
                {"role": "system", "content": """You are a GIS assistant for California water data. 
If the user asks about a specific lake's water level, use the get_water_level tool.
If the user asks what lakes are near a city, use the get_lakes_near_city tool and list the results in a table with their distance.
Do not try to chain multiple tools in a single turn. 
Always format your final response using clean Markdown tables. Be professional."""},
                {"role": "user", "content": req.message}
            ]
            
            response = client.chat.completions.create(
                model="qwen/qwen3.8-27b",
                messages=messages,
                tools=groq_tools,
                tool_choice="auto",
            )
            
            tool_calls = response.choices[0].message.tool_calls
            map_data = None
            final_response = ""
            trace_data = [] # NEW: Store the agent's steps
            
            if tool_calls:
                for tc in tool_calls:
                    func_name = tc.function.name
                    args = json.loads(tc.function.arguments)
                    
                    result = await mcp_client.call_tool(func_name, args)
                    result_text = result.content[0].text if (result and hasattr(result, 'content') and len(result.content) > 0) else "{}"
                    
                    # NEW: Log the trace
                    trace_data.append({
                        "tool": func_name,
                        "args": args,
                        "result": result_text
                    })
                    
                    try:
                        map_data = json.loads(result_text)
                    except:
                        map_data = None
                    
                    messages.append(response.choices[0].message)
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": result_text,
                    })
                
                second_response = client.chat.completions.create(
                    model="qwen/qwen3.8-27b",
                    messages=messages,
                )
                final_response = second_response.choices[0].message.content
            else:
                final_response = response.choices[0].message.content
            
            return {
                "response": final_response,
                "map_data": map_data if map_data and "latitude" in map_data else None,
                "trace": trace_data # NEW: Send trace to frontend
            }
            
    except Exception as e:
        print(f"Error: {e}")
        return {"response": f"An error occurred: {str(e)}", "map_data": None, "trace": []}
            
    except Exception as e:
        print(f"Error: {e}")
        return {"response": f"An error occurred: {str(e)}", "map_data": None}