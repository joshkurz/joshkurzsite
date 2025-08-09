import { parseStream } from '../../lib/parseJokeStream';

describe('parseStream', () => {
  it('removes labels from output while streaming', () => {
    const chunks = [
      'Question: Why did the chicken cross the road? Ans',
      'wer: To get to the other side.'
    ];
    let raw = '';
    let state = {
      question: '',
      answer: '',
      questionTokens: [],
      answerTokens: [],
      pendingQuestion: ''
    };
    for (const chunk of chunks) {
      raw += chunk;
      state = parseStream(raw, state);
      expect(state.questionTokens.join('')).not.toMatch(/Question|Answer/i);
      expect(state.answerTokens.join('')).not.toMatch(/Question|Answer/i);
    }
    expect(state.question).toBe('Why did the chicken cross the road?');
    expect(state.answer).toBe('To get to the other side.');
  });
});
