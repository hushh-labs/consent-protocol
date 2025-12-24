/**
 * Hushh Unified Chat Service
 * 
 * Routes chat messages to either local agents or remote API based on settings.
 * DEVELOPMENT: Uses remote API by default for web parity.
 */

import { Capacitor } from '@capacitor/core';
import { HushhAgent } from '../capacitor';
import { SettingsService } from './settings-service';

// ==================== Types ====================

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  agentId?: string;
}

export interface ChatResponse {
  message: string;
  sessionState?: Record<string, unknown>;
  collectedData?: Record<string, unknown>;
  isComplete: boolean;
  needsConsent: boolean;
  consentScope?: string;
  uiType?: 'buttons' | 'checkbox' | 'text';
  options?: string[];
  allowCustom?: boolean;
  allowNone?: boolean;
  consentToken?: string;
  source: 'local' | 'remote';
}

export interface ChatSession {
  id: string;
  userId: string;
  agentId?: string;
  sessionState?: Record<string, unknown>;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

// ==================== Chat Service ====================

class ChatServiceImpl {
  private sessions: Map<string, ChatSession> = new Map();
  
  /**
   * Send a message and get response.
   * DEV: Routes to remote API by default.
   */
  async sendMessage(
    message: string,
    userId: string,
    sessionId?: string,
    agentId?: string
  ): Promise<ChatResponse> {
    // Get or create session
    const session = sessionId 
      ? this.sessions.get(sessionId) || this.createSession(userId)
      : this.createSession(userId);
    
    // Add user message to history
    session.messages.push({
      role: 'user',
      content: message,
      timestamp: Date.now(),
      agentId,
    });
    session.updatedAt = Date.now();
    
    // Check settings - DEV default is remote
    const useLocal = await SettingsService.shouldUseLocalAgents();
    
    let response: ChatResponse;
    
    if (useLocal && Capacitor.isNativePlatform()) {
      // Only use local on native when explicitly set
      response = await this.handleLocalMessage(message, userId, session, agentId);
    } else {
      // DEV default: use remote API
      response = await this.handleRemoteMessage(message, userId, session, agentId);
    }
    
    // Add assistant message to history
    session.messages.push({
      role: 'assistant',
      content: response.message,
      timestamp: Date.now(),
      agentId: session.agentId,
    });
    
    // Update session state
    if (response.sessionState) {
      session.sessionState = response.sessionState;
    }
    
    this.sessions.set(session.id, session);
    
    return response;
  }
  
  /**
   * Handle message using local agents
   */
  private async handleLocalMessage(
    message: string,
    userId: string,
    session: ChatSession,
    agentId?: string
  ): Promise<ChatResponse> {
    try {
      const result = await HushhAgent.handleMessage({
        message,
        userId,
        agentId: agentId || session.agentId,
        sessionState: session.sessionState,
      });
      
      return {
        message: result.response,
        sessionState: result.sessionState,
        collectedData: result.collectedData,
        isComplete: result.isComplete,
        needsConsent: result.needsConsent,
        consentScope: result.consentScope,
        uiType: result.uiType,
        options: result.options,
        allowCustom: result.allowCustom,
        allowNone: result.allowNone,
        consentToken: result.consentToken,
        source: 'local',
      };
    } catch (error) {
      console.error('[ChatService] Local agent error, falling back to remote:', error);
      return this.handleRemoteMessage(message, userId, session, agentId);
    }
  }
  
  /**
   * Handle message using remote API (DEV default)
   */
  private async handleRemoteMessage(
    message: string,
    userId: string,
    session: ChatSession,
    agentId?: string
  ): Promise<ChatResponse> {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          userId,
          agentId: agentId || session.agentId,
          sessionState: session.sessionState,
          conversationHistory: session.messages.slice(-10),
        }),
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Handle both snake_case and camelCase responses
      return {
        message: data.response || data.message,
        sessionState: data.sessionState || data.session_state,
        collectedData: data.collectedData || data.collected_data,
        isComplete: data.isComplete || data.is_complete || false,
        needsConsent: data.needsConsent || data.needs_consent || false,
        consentScope: data.consentScope || data.consent_scope,
        uiType: data.uiType || data.ui_type,
        options: data.options,
        allowCustom: data.allowCustom || data.allow_custom,
        allowNone: data.allowNone || data.allow_none,
        consentToken: data.consentToken || data.consent_token,
        source: 'remote',
      };
    } catch (error) {
      console.error('[ChatService] Remote API error:', error);
      
      return {
        message: '⚠️ Unable to connect to server. Please check your connection.',
        isComplete: false,
        needsConsent: false,
        source: 'remote',
      };
    }
  }
  
  /**
   * Create a new chat session
   */
  createSession(userId: string, agentId?: string): ChatSession {
    const session: ChatSession = {
      id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      agentId,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    
    this.sessions.set(session.id, session);
    return session;
  }
  
  getSession(sessionId: string): ChatSession | undefined {
    return this.sessions.get(sessionId);
  }
  
  clearSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }
  
  getUserSessions(userId: string): ChatSession[] {
    return Array.from(this.sessions.values())
      .filter(s => s.userId === userId)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }
}

export const ChatService = new ChatServiceImpl();

// ==================== React Hook ====================

import { useState, useCallback } from 'react';

export interface UseChatResult {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  sessionId: string | null;
  sendMessage: (message: string) => Promise<ChatResponse>;
  clearSession: () => void;
  lastResponse: ChatResponse | null;
}

export function useChat(userId: string, initialAgentId?: string): UseChatResult {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<ChatResponse | null>(null);
  
  const sendMessage = useCallback(async (message: string): Promise<ChatResponse> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await ChatService.sendMessage(
        message,
        userId,
        sessionId || undefined,
        initialAgentId
      );
      
      if (!sessionId) {
        const sessions = ChatService.getUserSessions(userId);
        if (sessions.length > 0) {
          setSessionId(sessions[0].id);
          setMessages(sessions[0].messages);
        }
      } else {
        const session = ChatService.getSession(sessionId);
        if (session) {
          setMessages(session.messages);
        }
      }
      
      setLastResponse(response);
      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [userId, sessionId, initialAgentId]);
  
  const clearSession = useCallback(() => {
    if (sessionId) {
      ChatService.clearSession(sessionId);
    }
    setSessionId(null);
    setMessages([]);
    setLastResponse(null);
    setError(null);
  }, [sessionId]);
  
  return {
    messages,
    isLoading,
    error,
    sessionId,
    sendMessage,
    clearSession,
    lastResponse,
  };
}
