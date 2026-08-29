/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import Home from '../../pages/index';

describe('Home page (SSR-seeded joke)', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network disabled in test'));
  });

  it('renders the SSR-provided joke text immediately, with no loading spinner', () => {
    const initialJoke = {
      id: 'fatherhood-999',
      opener: 'Why did the scarecrow win an award?',
      response: 'Because he was outstanding in his field.',
      text: 'Question: Why did the scarecrow win an award?\nAnswer: Because he was outstanding in his field.',
      author: 'fatherhood.gov'
    };

    render(
      <Home
        initialJoke={initialJoke}
        initialFeaturedJoke={null}
        initialGlobalVotes={42}
      />
    );

    expect(screen.getByText(/scarecrow win an award/i)).toBeTruthy();
    expect(screen.getByText(/outstanding in his field/i)).toBeTruthy();
    expect(screen.queryByRole('status', { name: /loading/i })).toBeNull();
  });

  it('falls back to the loading spinner when no SSR joke is provided', () => {
    render(<Home initialJoke={null} initialFeaturedJoke={null} initialGlobalVotes={null} />);
    expect(screen.getByRole('status', { name: /loading/i })).toBeTruthy();
  });
});
