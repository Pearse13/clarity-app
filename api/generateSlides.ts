import { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';

// Initialize Claude client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Slide type definitions to match your mobile app
interface BaseSlide {
  id: string;
  tag: string;
}

interface DefinitionSlide extends BaseSlide {
  type: 'definition';
  term: string;
  definition: string;
}

interface QuizSlide extends BaseSlide {
  type: 'quiz';
  question: string;
  options: string[];
  correctOptionIndex: number;
}

type Slide = DefinitionSlide | QuizSlide;

interface SlideGenerationResponse {
  slides: Slide[];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  // Check if API key is configured
  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ 
      error: 'ANTHROPIC_API_KEY environment variable not set' 
    });
    return;
  }

  const { ocrText, userId, documentId } = req.body;
  
  if (!ocrText) {
    res.status(400).json({ 
      error: 'Missing required field: ocrText' 
    });
    return;
  }

  console.log('Generating slides for document:', documentId);
  console.log('OCR text length:', ocrText.length);
  console.log('User:', userId);

  try {
    // System prompt for interactive slide generation
    const systemPrompt = `You are an expert educational content creator specializing in transforming academic text into engaging, interactive learning slides optimized for mobile "doomscroll" consumption.

PROTOTYPE FOCUS: Create interactive slides that encourage active learning and engagement.

SLIDE ALGORITHM TO FOLLOW:
1. FLASHCARD for definitions - Show term, user swipes/taps to reveal definition
2. 5-OPTION QUIZ for key concepts - Multiple choice with exactly 5 options
3. SWIPE-TO-REVEAL questions for deeper understanding

RANDOMIZATION: Mix slide types randomly to maintain engagement and prevent predictable patterns.

SLIDE TYPES SPECIFICATION:
- "definition": Interactive flashcard format
  - term: The concept/word to learn
  - definition: The explanation (revealed on interaction)
  - tag: Subject category
  
- "quiz": 5-option multiple choice
  - question: Clear, testable question
  - options: Exactly 5 choices (including plausible distractors)
  - correctOptionIndex: Index (0-4) of correct answer
  - tag: Subject category

RESPONSE FORMAT:
Always respond with JSON array, randomized order:
{
  "slides": [
    {"id": "1", "type": "definition", "tag": "biology", "term": "Mitochondria", "definition": "The powerhouse of the cell..."},
    {"id": "2", "type": "quiz", "tag": "biology", "question": "What produces ATP in cells?", "options": ["Mitochondria", "Nucleus", "Ribosome", "Cytoplasm", "Membrane"], "correctOptionIndex": 0}
  ]
}

ENGAGEMENT RULES:
- Create 6-8 slides per session
- Mix 60% quiz, 40% definition for optimal interaction
- Randomize order to prevent patterns
- Ensure questions test understanding, not memorization
- Keep content mobile-optimized and concise`;

    const userPrompt = `Analyze this extracted text and create interactive slides following the algorithm:

${ocrText}

Focus on:
- Key definitions that work well as flashcards
- Testable concepts for 5-option quizzes
- Random distribution of slide types
- Mobile-optimized content length

Generate slides that encourage active engagement rather than passive consumption.`;

    console.log('Sending request to Claude...');
    
    const message = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 4000,
      messages: [
        {
          role: "user",
          content: `${systemPrompt}\n\n${userPrompt}`
        }
      ]
    });

    console.log('✅ Claude response received');
    
    // Extract the text content from Claude's response
    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
    
    // Parse the JSON response from Claude
    let slidesData: SlideGenerationResponse;
    try {
      // Extract JSON from the response (Claude might include explanation text)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        slidesData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in Claude response');
      }
    } catch (parseError) {
      console.error('Error parsing Claude response:', parseError);
      console.log('Raw response:', responseText);
      
      res.status(500).json({
        success: false,
        error: 'Failed to parse slide data from Claude response',
        rawResponse: responseText.substring(0, 500) + '...'
      });
      return;
    }

    // Validate and add IDs to slides if missing
    const processedSlides = slidesData.slides.map((slide, index) => ({
      ...slide,
      id: slide.id || `${documentId}_slide_${index + 1}`,
    }));

    console.log(`✅ Generated ${processedSlides.length} interactive slides`);
    console.log('Slide types:', processedSlides.map(s => s.type).join(', '));
    
    // Return success response
    res.status(200).json({
      success: true,
      message: 'Interactive slides generated successfully!',
      slides: processedSlides,
      slideCount: processedSlides.length,
      documentId,
      usage: message.usage,
      debugInfo: {
        ocrTextLength: ocrText.length,
        userId,
        documentId,
        model: message.model
      }
    });
    
  } catch (error) {
    console.error('Error generating slides:', error);
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error generating slides',
      documentId
    });
  }
} 