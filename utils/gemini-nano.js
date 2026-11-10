// SwitchMate - Local Gemini Nano AI Integration (Chrome Built-in Prompt API)

/**
 * Interface to Chrome's on-device Gemini Nano model (window.ai / ai.languageModel).
 * Operates 100% locally on-device without cloud API keys, preserving privacy & zero-latency.
 */
class GeminiNanoService {
  constructor() {
    this.session = null;
    this.availability = 'checking'; // 'readily', 'after-download', 'no', 'unsupported'
  }

  /**
   * Check if Gemini Nano is available on this Chrome instance.
   */
  async checkCapabilities() {
    try {
      // Check modern standard: window.ai.languageModel or self.ai.languageModel
      const aiObject = (typeof ai !== 'undefined' && ai.languageModel) 
        ? ai.languageModel 
        : (typeof window !== 'undefined' && window.ai && window.ai.languageModel) 
          ? window.ai.languageModel 
          : null;

      if (!aiObject) {
        // Check older preview: window.ai.canCreateTextSession
        if (typeof window !== 'undefined' && window.ai && window.ai.canCreateTextSession) {
          const legacyStatus = await window.ai.canCreateTextSession();
          this.availability = legacyStatus === 'readily' ? 'readily' : legacyStatus;
          return { available: this.availability, type: 'legacy' };
        }
        this.availability = 'unsupported';
        return { available: 'unsupported' };
      }

      const caps = await aiObject.capabilities();
      this.availability = caps.available; // 'readily' | 'after-download' | 'no'
      return caps;
    } catch (err) {
      console.warn('[GeminiNano] Capability check error:', err);
      this.availability = 'unsupported';
      return { available: 'unsupported', error: err.message };
    }
  }

  /**
   * Initializes or returns an active Gemini Nano session with the given system prompt.
   */
  async getSession(systemPrompt = "You are SwitchMate AI, a smart focus and accountability coach helping a software developer ace their Android interviews, maintain daily workout/mobility, and track investments wisely.") {
    try {
      const aiObject = (typeof ai !== 'undefined' && ai.languageModel) 
        ? ai.languageModel 
        : (typeof window !== 'undefined' && window.ai && window.ai.languageModel) 
          ? window.ai.languageModel 
          : null;

      if (aiObject) {
        if (!this.session) {
          this.session = await aiObject.create({
            systemPrompt: systemPrompt,
            temperature: 0.3,
            topK: 3
          });
        }
        return this.session;
      }

      // Legacy fallback
      if (typeof window !== 'undefined' && window.ai && window.ai.createTextSession) {
        if (!this.session) {
          this.session = await window.ai.createTextSession();
        }
        return this.session;
      }

      return null;
    } catch (err) {
      console.warn('[GeminiNano] Session initialization error:', err);
      return null;
    }
  }

  /**
   * Classify page content and user intent using local Gemini Nano.
   * Returns: { category: 'goal_android'|'goal_investments'|'goal_workout'|'distraction', confidence: number, reasoning: string }
   */
  async classifyPageIntent({ url, title, metaDescription, headings = '' }, currentGoals) {
    const session = await this.getSession();
    if (!session) {
      // Fallback heuristic if local model not yet downloaded
      return this.fallbackHeuristicClassification({ url, title, metaDescription });
    }

    const currentTopic = currentGoals?.androidPrep?.currentTopic || 'Android Architecture, Coroutines, Jetpack Compose';

    const prompt = `
Task: Analyze this webpage and classify whether it is aligned with the user's daily goals or is a distraction.

User's daily goals:
1. "goal_android": Android Developer interview prep, Kotlin, Coroutines, Jetpack, LeetCode, DSA, System Design, tech architecture. (Today's topic: ${currentTopic})
2. "goal_investments": Portfolio review, stock market analysis, mutual funds, personal finance.
3. "goal_workout": Fitness, stretching, mobility exercises, workouts.
4. "distraction": Entertainment, memes, social media doom-scrolling, celebrity gossip, gaming, non-essential videos.

Page Info:
- URL: ${url}
- Title: ${title}
- Description: ${metaDescription}
- Excerpt / Headings: ${headings.slice(0, 300)}

Respond strictly in valid JSON format with keys:
{
  "category": "goal_android" | "goal_investments" | "goal_workout" | "distraction",
  "reasoning": "one short sentence explaining why"
}
`;

    try {
      const responseText = await session.prompt(prompt);
      // Clean possible markdown code fences
      const cleaned = responseText.replace(/```json/gi, '').replace(/```/gi, '').trim();
      const parsed = JSON.parse(cleaned);
      if (['goal_android', 'goal_investments', 'goal_workout', 'distraction'].includes(parsed.category)) {
        return parsed;
      }
      return { category: 'distraction', reasoning: parsed.reasoning || 'Uncategorized content' };
    } catch (err) {
      console.warn('[GeminiNano] Error during prompt classification:', err);
      return this.fallbackHeuristicClassification({ url, title, metaDescription });
    }
  }

  /**
   * Generate a sharp, context-aware prompt/nudge for the user.
   */
  async generateContextualNudge(pageData, currentGoals) {
    const session = await this.getSession();
    const topic = currentGoals?.androidPrep?.currentTopic || 'Android Dev Prep';
    if (!session) {
      return `You're browsing ${pageData.title || pageData.url}. Your current target is "${topic}". Ready to get back to interview prep?`;
    }

    const prompt = `
The user is currently browsing: "${pageData.title}" on ${pageData.url}.
Their primary goal today is: Android Developer Interview Prep, focusing specifically on "${topic}".
Write a 1-to-2 sentence encouraging, direct, and slightly witty nudge asking them if this site is helping them master "${topic}" or if they want to get back to coding.
Do not use quotes. Keep it under 35 words.
`;

    try {
      const response = await session.prompt(prompt);
      return response.trim();
    } catch (err) {
      return `Stay sharp! Is this helping you master ${topic}? Let's crush your Android developer interview!`;
    }
  }

  /**
   * Generates a rapid mock interview question for Android development.
   */
  async generateInterviewQuestion(topic = 'Kotlin Coroutines') {
    const session = await this.getSession();
    if (!session) {
      return {
        question: "Explain the difference between launch and async in Kotlin Coroutines, and how exception propagation differs.",
        difficulty: "Intermediate",
        keyConcepts: ["CoroutineScope", "Job vs Deferred", "SupervisorJob"]
      };
    }

    const prompt = `
Generate 1 practical Android Developer interview question on the topic: "${topic}".
Format as JSON:
{
  "question": "the question",
  "difficulty": "Junior" | "Mid-level" | "Senior",
  "hint": "one short hint"
}
`;

    try {
      const response = await session.prompt(prompt);
      const cleaned = response.replace(/```json/gi, '').replace(/```/gi, '').trim();
      return JSON.parse(cleaned);
    } catch (e) {
      return {
        question: `How does Flow backpressure handling work compared to RxJava in Android?`,
        difficulty: "Mid-level",
        hint: "Think about suspend functions and buffer operators"
      };
    }
  }

  /**
   * Fallback rule-based heuristic when Gemini Nano is not loaded yet.
   */
  fallbackHeuristicClassification({ url = '', title = '', metaDescription = '' }) {
    const text = `${url} ${title} ${metaDescription}`.toLowerCase();

    // Check Android interview prep keywords
    const androidKeywords = ['android', 'kotlin', 'coroutine', 'jetpack', 'compose', 'leetcode', 'dsa', 'algorithm', 'system design', 'viewmodel', 'dagger', 'hilt', 'room db', 'flow', 'proandroiddev', 'droidcon'];
    if (androidKeywords.some(kw => text.includes(kw))) {
      return { category: 'goal_android', reasoning: 'Contains Android developer prep concepts' };
    }

    // Check investment keywords
    const investKeywords = ['zerodha', 'groww', 'tradingview', 'portfolio', 'mutual fund', 'nifty', 'sensex', 'stock', 'dividend', 'market watch'];
    if (investKeywords.some(kw => text.includes(kw))) {
      return { category: 'goal_investments', reasoning: 'Contains investment & market analysis terms' };
    }

    // Check workout keywords
    const workoutKeywords = ['workout', 'exercise', 'mobility', 'stretching', 'squat', 'pushup', 'posture', 'warmup'];
    if (workoutKeywords.some(kw => text.includes(kw))) {
      return { category: 'goal_workout', reasoning: 'Contains physical fitness & mobility topics' };
    }

    return { category: 'distraction', reasoning: 'Not clearly matched to daily prep goals' };
  }
}

// Export for ES modules and standard script inclusion
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GeminiNanoService;
}
if (typeof window !== 'undefined') {
  window.GeminiNanoService = GeminiNanoService;
}
