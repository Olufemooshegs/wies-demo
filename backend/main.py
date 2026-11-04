import os
import json
import sys
import time
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

# Connect to the local python script safely
MCP_TRANSPORT = StdioTransport(
    command=sys.executable,
    args=["mcp_server.py"],
    env={}
)

class ChatRequest(BaseModel):
    message: str

# Helper function to handle Groq rate limits
def safe_chat_completion(**kwargs):
    for attempt in range(3):
        try:
            return client.chat.completions.create(**kwargs)
        except Exception as e:
            if "429" in str(e) and attempt < 2:
                time.sleep(2 ** attempt)
                continue
            raise

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
            
            response = safe_chat_completion(
                model="qwen/qwen3.8-27b",
                messages=messages,
                tools=groq_tools,
                tool_choice="auto",
                max_tokens=900, # FIXED: Under 1000 limit
            )
            
            tool_calls = response.choices[0].message.tool_calls
            map_data = None
            final_response = ""
            trace_data = [] 
            
            if tool_calls:
                for tc in tool_calls:
                    func_name = tc.function.name
                    args = json.loads(tc.function.arguments)
                    
                    result = await mcp_client.call_tool(func_name, args)
                    result_text = result.content[0].text if (result and hasattr(result, 'content') and len(result.content) > 0) else "{}"
                    
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
                
                second_response = safe_chat_completion(
                    model="qwen/qwen3.8-27b",
                    messages=messages,
                    max_tokens=900, # FIXED: Under 1000 limit
                )
                final_response = second_response.choices[0].message.content
            else:
                final_response = response.choices[0].message.content
            
            return {
                "response": final_response,
                "map_data": map_data if map_data and "latitude" in map_data else None,
                "trace": trace_data 
            }
            
    except Exception as e:
        print(f"Error: {e}")
        return {"response": f"An error occurred: {str(e)}", "map_data": None, "trace": []}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)