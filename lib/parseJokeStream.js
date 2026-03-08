export function splitSafe(pending, label) {
  const lowerPending = pending.toLowerCase();
  const lowerLabel = label.toLowerCase();
  for (let i = Math.min(pending.length, lowerLabel.length - 1); i > 0; i--) {
    if (lowerLabel.startsWith(lowerPending.slice(-i))) {
      return {
        emit: pending.slice(0, pending.length - i),
        hold: pending.slice(pending.length - i)
      };
    }
  }
  return { emit: pending, hold: '' };
}

export function syncTokensWithText(tokens, text) {
  let remaining = text;
  const out = [];
  for (const token of tokens) {
    if (remaining.startsWith(token)) {
      out.push(token);
      remaining = remaining.slice(token.length);
    } else {
      break;
    }
  }
  if (remaining) out.push(remaining);
  return out;
}

export function parseStream(rawJoke, prevState) {
  const lower = rawJoke.toLowerCase();
  const qLabel = 'question:';
  const aLabel = 'answer:';
  const qIndex = lower.indexOf(qLabel);
  const aIndex = lower.indexOf(aLabel);
  let questionText = prevState.question;
  let answerText = prevState.answer;

  if (qIndex !== -1) {
    if (aIndex !== -1 && aIndex > qIndex) {
      questionText = rawJoke
        .slice(qIndex + qLabel.length, aIndex)
        .replace(/^\s*/, '')
        .replace(/\s*$/, '');
      answerText = rawJoke
        .slice(aIndex + aLabel.length)
        .replace(/^\s*/, '');
    } else {
      questionText = rawJoke
        .slice(qIndex + qLabel.length)
        .replace(/^\s*/, '');
    }
  }

  const questionDelta = questionText.slice(prevState.question.length);
  const answerDelta = answerText.slice(prevState.answer.length);

  let pendingQuestion = prevState.pendingQuestion + questionDelta;
  let questionTokens = prevState.questionTokens;
  if (aIndex !== -1 && prevState.answer === '') {
    questionTokens = syncTokensWithText(prevState.questionTokens, questionText);
    pendingQuestion = '';
  } else {
    const { emit, hold } = splitSafe(pendingQuestion, aLabel);
    if (emit) {
      questionTokens = [...prevState.questionTokens, emit];
    }
    pendingQuestion = hold;
  }

  const answerTokens = answerDelta ? [...prevState.answerTokens, answerDelta] : prevState.answerTokens;

  return {
    isLoaded: true,
    question: questionText,
    answer: answerText,
    questionTokens,
    answerTokens,
    pendingQuestion
  };
}
