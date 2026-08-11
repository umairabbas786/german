import { FEEDBACK_API_URL, apiFetchUrl } from './api';

export interface FeedbackData {
  consumer_id: string;
  feedback?: string;
  stars: number;
}

export interface FeedbackResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export async function submitFeedback(feedbackData: FeedbackData): Promise<FeedbackResponse> {
  try {
    const response = await apiFetchUrl(`${FEEDBACK_API_URL}/user_feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(feedbackData),
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json() as FeedbackResponse;
  } catch (error) {
    console.error('Error submitting feedback:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
