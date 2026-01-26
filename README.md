Demo: https://audnex-listen.web.app/

## Setup

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
VITE_FIREBASE_APP_ID=your_firebase_app_id
VITE_FIREBASE_DATABASE_URL=your_firebase_database_url
VITE_GEMINI_API_KEY=your_gemini_api_key
```

### Getting Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the API key and add it to your `.env` file as `VITE_GEMINI_API_KEY`

The free tier of Gemini API provides sufficient quota for testing and development.

## Features

- **Listening Practice**: Play audio lessons with transcripts
- **Vocabulary Review**: Review vocabulary words from lessons
- **AI-Powered QA**: Get AI-generated questions based on conversation content with detailed evaluation
  - Spelling, grammar, relevance, and content matching scores
  - Detailed feedback and suggestions for improvement
  - Corrected answer suggestions
