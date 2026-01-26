/**
 * Service for interacting with Google Gemini AI Studio API
 */

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY
// Use only gemini-2.5-flash as specified
const GEMINI_MODEL = 'gemini-2.5-flash'

function getApiUrl(): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`
}

/**
 * Extract retry delay from error response
 */
function extractRetryDelay(errorData: any): number {
  try {
    const retryInfo = errorData?.error?.details?.find((d: any) => d['@type'] === 'type.googleapis.com/google.rpc.RetryInfo')
    if (retryInfo?.retryDelay) {
      // Convert from seconds to milliseconds
      return parseFloat(retryInfo.retryDelay) * 1000
    }
  } catch (e) {
    // Ignore parsing errors
  }
  return 60000 // Default 60 seconds
}

/**
 * Make API call with retry logic
 */
async function makeApiCall(prompt: string): Promise<any> {
  const url = getApiUrl()

  const response = await fetch(`${url}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: prompt
        }]
      }]
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    
    // Handle 429 (Quota Exceeded)
    if (response.status === 429) {
      const retryDelay = extractRetryDelay(errorData)
      const delaySeconds = Math.ceil(retryDelay / 1000)
      throw new Error(
        `Quota exceeded. Please wait ${delaySeconds} seconds before retrying. ` +
        `You can check your quota at: https://ai.dev/rate-limit. ` +
        `If this persists, you may need to upgrade your plan or wait for quota reset.`
      )
    }
    
    // Handle 404 (Model not found)
    if (response.status === 404) {
      throw new Error(
        `Model ${GEMINI_MODEL} is not found or not supported. ` +
        `Please check available models at: https://ai.google.dev/models`
      )
    }
    
    throw new Error(`Gemini API error: ${response.status} ${response.statusText}. ${JSON.stringify(errorData)}`)
  }

  return await response.json()
}

export interface QAQuestion {
  question: string
  questionNumber: number
}

export interface QAEvaluation {
  score: number // 0-10
  feedback: string // Short feedback comment
  correctedAnswer?: string // Suggested correction
}

/**
 * Generate questions based on conversation transcript
 */
export async function generateQuestions(transcript: string, numQuestions: number = 4): Promise<QAQuestion[]> {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key is not configured. Please set VITE_GEMINI_API_KEY in your environment variables.')
  }

  const prompt = `Based on the following English conversation transcript, generate exactly ${numQuestions} comprehension questions in English. 
The questions should test understanding of the conversation content, key points, and details.

Conversation transcript:
${transcript}

Please generate ${numQuestions} questions in the following JSON format (array of objects):
[
  {"questionNumber": 1, "question": "Question text here"},
  {"questionNumber": 2, "question": "Question text here"},
  ...
]

Return ONLY the JSON array, no additional text or explanation.`

  try {
    const data = await makeApiCall(prompt)
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    
    // Extract JSON from response (handle cases where AI adds extra text)
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      throw new Error('Failed to parse questions from AI response')
    }

    const questions: QAQuestion[] = JSON.parse(jsonMatch[0])
    
    // Validate and ensure we have the right number of questions
    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error('Invalid questions format from AI')
    }

    return questions.slice(0, numQuestions)
  } catch (error) {
    console.error('Error generating questions:', error)
    throw error
  }
}

/**
 * Evaluate user's answer using AI
 */
export async function evaluateAnswer(
  question: string,
  userAnswer: string,
  transcript: string
): Promise<QAEvaluation> {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key is not configured. Please set VITE_GEMINI_API_KEY in your environment variables.')
  }

  const prompt = `You are an English teacher evaluating a student's answer. Please evaluate the following answer considering spelling, grammar, relevance to the question, and relevance to the conversation content.

Question: ${question}
Student's Answer: ${userAnswer}
Conversation Content: ${transcript}

Please provide an evaluation in the following JSON format:
{
  "score": <overall score 0-10, where 10 is perfect and 0 is completely wrong>,
  "feedback": "<brief feedback comment in English, keep it short and concise>",
  "correctedAnswer": "<provide a corrected version if there are significant errors, otherwise omit this field>"
}

Return ONLY the JSON object, no additional text.`

  try {
    const data = await makeApiCall(prompt)
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Failed to parse evaluation from AI response')
    }

    const evaluation: QAEvaluation = JSON.parse(jsonMatch[0])
    
    // Validate score is within range (0-10)
    evaluation.score = Math.max(0, Math.min(10, evaluation.score || 0))
    
    // Ensure feedback exists
    if (!evaluation.feedback) {
      evaluation.feedback = 'No feedback provided.'
    }

    return evaluation
  } catch (error) {
    console.error('Error evaluating answer:', error)
    throw error
  }
}

