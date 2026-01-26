"""
Hushh ADK Manifest

Defines the configuration schema for Hushh Agents.
This serves as the robust Source of Truth for:
1. ADK Agent Construction (Model, System Prompt)
2. MCP Server Capability Reporting
3. Frontend UI Capability Flags
"""

from typing import List, Optional, Dict
from pydantic import BaseModel, Field
import yaml
import os

class AgentToolConfig(BaseModel):
    name: str
    description: str
    py_func: str  # Path to python function e.g. "hushh_mcp.operons.food.recommend"
    required_scope: str

class AgentInputConfig(BaseModel):
    name: str
    type: str

class AgentOutputConfig(BaseModel):
    name: str
    type: str

class AgentManifest(BaseModel):
    id: str
    name: str
    version: str = "1.0.0"
    description: str
    model: str = "gemini-1.5-flash"
    system_instruction: str
    
    required_scopes: List[str] = Field(default_factory=list)
    tools: List[AgentToolConfig] = Field(default_factory=list)
    inputs: List[AgentInputConfig] = Field(default_factory=list)
    outputs: List[AgentOutputConfig] = Field(default_factory=list)
    
    # Metadata for UI/Behavior
    ui_type: Optional[str] = "chat"  # chat, form, dashboard
    icon: Optional[str] = None

class ManifestLoader:
    @staticmethod
    def load(path: str) -> AgentManifest:
        """Load manifest from a YAML file."""
        if not os.path.exists(path):
            raise FileNotFoundError(f"Manifest not found at {path}")
            
        with open(path, 'r') as f:
            data = yaml.safe_load(f)
            
        return AgentManifest(**data)
