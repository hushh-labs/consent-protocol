/**
 * Hushh Local Agent - Web Implementation
 * 
 * DEV: Routes to remote API by default (useRemoteLLM: true).
 * When set to local, uses on-device intent classification and agents.
 */

import type { HushhAgentPlugin, AgentResponse, AgentInfo } from "../index";
import { SettingsService } from "../../services/settings-service";

const AGENT_IDS = {
  orchestrator: 'agent_orchestrator',
  foodDining: 'agent_food_dining',
  professionalProfile: 'agent_professional_profile',
  identity: 'agent_identity',
  shopper: 'agent_shopper',
};

const AGENT_PORTS = {
  agent_orchestrator: 10000,
  agent_food_dining: 10001,
  agent_professional_profile: 10002,
  agent_identity: 10003,
  agent_shopper: 10004,
};

const FOOD_KEYWORDS = ['food', 'diet', 'restaurant', 'cuisine', 'eat', 'meal', 'dining', 'vegetarian', 'vegan', 'allergy', 'budget', 'hungry'];
const PROFESSIONAL_KEYWORDS = ['resume', 'job', 'career', 'skill', 'professional', 'experience', 'work', 'employment', 'title', 'linkedin'];

export class HushhAgentWeb implements HushhAgentPlugin {
  
  async handleMessage(options: {
    message: string;
    userId: string;
    agentId?: string;
    sessionState?: Record<string, unknown>;
  }): Promise<AgentResponse> {
    const { message, userId, agentId, sessionState } = options;
    
    // DEV default: use remote API
    const useLocal = await SettingsService.shouldUseLocalAgents();
    if (!useLocal) {
      // Signal to caller to use remote API
      return {
        response: '__USE_REMOTE_API__',
        isComplete: false,
        needsConsent: false,
      };
    }
    
    // Local mode: use on-device agents
    if (agentId && agentId !== AGENT_IDS.orchestrator) {
      return this.routeToAgent(agentId, message, userId, sessionState || {});
    }
    
    const delegation = this.classifyIntentSync(message);
    if (delegation.hasDelegate) {
      return this.routeToAgent(delegation.targetAgent, message, userId, sessionState || {});
    }
    
    return {
      response: `👋 Hi! I can help you with:\n\n• 🍽️ **Food & Dining** preferences\n• 💼 **Professional profile**\n\nWhat would you like to set up?`,
      isComplete: false,
      needsConsent: false,
    };
  }
  
  async classifyIntent(options: { message: string }): Promise<{
    hasDelegate: boolean;
    targetAgent: string;
    targetPort?: number;
    domain: string;
  }> {
    return this.classifyIntentSync(options.message);
  }
  
  async getAgentInfo(): Promise<{
    agents: AgentInfo[];
    version: string;
    protocolVersion: string;
  }> {
    return {
      agents: [
        { id: AGENT_IDS.orchestrator, name: 'Orchestrator', port: AGENT_PORTS.agent_orchestrator, available: true },
        { id: AGENT_IDS.foodDining, name: 'Food & Dining', port: AGENT_PORTS.agent_food_dining, available: true },
        { id: AGENT_IDS.professionalProfile, name: 'Professional Profile', port: AGENT_PORTS.agent_professional_profile, available: true },
        { id: AGENT_IDS.identity, name: 'Identity', port: AGENT_PORTS.agent_identity, available: false },
        { id: AGENT_IDS.shopper, name: 'Shopper', port: AGENT_PORTS.agent_shopper, available: false },
      ],
      version: '1.0.0-dev',
      protocolVersion: 'HCT-1.0',
    };
  }
  
  private classifyIntentSync(message: string): {
    hasDelegate: boolean;
    targetAgent: string;
    targetPort?: number;
    domain: string;
  } {
    const msg = message.toLowerCase();
    
    for (const keyword of FOOD_KEYWORDS) {
      if (msg.includes(keyword)) {
        return {
          hasDelegate: true,
          targetAgent: AGENT_IDS.foodDining,
          targetPort: AGENT_PORTS.agent_food_dining,
          domain: 'food_dining',
        };
      }
    }
    
    for (const keyword of PROFESSIONAL_KEYWORDS) {
      if (msg.includes(keyword)) {
        return {
          hasDelegate: true,
          targetAgent: AGENT_IDS.professionalProfile,
          targetPort: AGENT_PORTS.agent_professional_profile,
          domain: 'professional',
        };
      }
    }
    
    return {
      hasDelegate: false,
      targetAgent: AGENT_IDS.orchestrator,
      domain: 'general',
    };
  }
  
  private routeToAgent(
    agentId: string,
    message: string,
    userId: string,
    sessionState: Record<string, unknown>
  ): AgentResponse {
    // For now, return a message indicating local mode is available
    // Full agent logic is in the Swift implementation
    const step = (sessionState.step as string) || 'greeting';
    
    if (agentId === AGENT_IDS.foodDining) {
      if (step === 'greeting') {
        return {
          response: `👋 Hi! I'm your Food & Dining assistant.\n\nLet's start with **dietary restrictions**.`,
          sessionState: { step: 'dietary', collected: {} },
          isComplete: false,
          needsConsent: false,
          uiType: 'checkbox',
          options: ['Vegetarian', 'Vegan', 'Gluten-free', 'Dairy-free', 'Nut-free', 'Halal', 'Kosher'],
          allowCustom: true,
          allowNone: true,
        };
      }
    }
    
    if (agentId === AGENT_IDS.professionalProfile) {
      if (step === 'greeting') {
        return {
          response: `👋 Hi! I'm your Professional Profile assistant.\n\nWhat's your **job title**?`,
          sessionState: { step: 'title', collected: {} },
          isComplete: false,
          needsConsent: false,
        };
      }
    }
    
    return {
      response: 'This agent conversation is in progress.',
      sessionState,
      isComplete: false,
      needsConsent: false,
    };
  }
}
