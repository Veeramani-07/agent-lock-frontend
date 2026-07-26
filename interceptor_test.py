import requests
import time

# Fixed: Live Render Backend Base Endpoint
BACKEND_URL = "https://agent-lock-backend.onrender.com/api/agent"

test_commands = [
    {
        "commandId": "CMD_201",
        "agentName": "Codex-Refactor-Bot",
        "command": "git commit -m 'refactor code'",
        "riskScore": 15,
        "reasoning": "Standard git operation",
        "status": "EXECUTED"
    },
    {
        "commandId": "CMD_202",
        "agentName": "Codex-DB-Agent",
        "command": "DROP TABLE users CASCADE;",
        "riskScore": 90,
        "reasoning": "Destructive database drop",
        "status": "PAUSED"
    }
]

print("🚀 Starting Agent Interceptor Test Stream with Feedback Loop...\n")

for item in test_commands:
    print(f"Sending Command [{item['commandId']}] - Risk Score: {item['riskScore']}")
    
    try:
        res = requests.post(f"{BACKEND_URL}/intercept", json=item)
        res.raise_for_status()
        data = res.json()
        status = data.get("status", item.get("status"))
        
        print(f"✅ Intercepted! Backend Status: {status}")
        
        # If high-risk PAUSED, poll backend until supervisor Approves or Rejects via React UI
        if status == "PAUSED":
            print(f"⏳ Action [{item['commandId']}] PAUSED! Waiting for Human Supervisor decision...")
            resolved = False
            
            while not resolved:
                time.sleep(2) # Poll every 2 seconds
                logs_res = requests.get(f"{BACKEND_URL}/actions")
                if logs_res.status_code == 200:
                    logs = logs_res.json()
                    for action in logs:
                        if action.get("commandId") == item["commandId"] and action.get("status") != "PAUSED":
                            print(f"🎯 Supervisor Decision Received: {action.get('status')}")
                            if action.get("feedbackPrompt"):
                                print(f"🤖 AI Feedback Received: \"{action.get('feedbackPrompt')}\"")
                                print("🤖 AI Agent is re-planning execution based on human feedback...")
                            resolved = True
                            break
                            
    except Exception as e:
        print(f"❌ Error communicating with backend: {e}")
        
    print("-" * 50)