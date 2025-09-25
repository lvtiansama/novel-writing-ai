import sys
from pathlib import Path

# 添加agno的路径
project_root = Path("/home")
sys.path.insert(0, str(project_root))

from fastapi.middleware.cors import CORSMiddleware
from agno.playground import Playground

from novel_agent import novel_team, lifespan


playground = Playground(
    agents=[],
    teams=[novel_team],  # 添加你的team
    app_id="mixed-playground",
    name="Mixed Agent and Team Playground",
    description="包含独立Agent和协作Team的综合Playground"
)
app = playground.get_app(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://app.agno.com",               # Agno playground domain
        "http://localhost:8895",              # Local development
        "http://localhost:8896",              # Local API server
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
)

if __name__ == "__main__":
    playground.serve("main:app", reload=True, port=8896, host="0.0.0.0")