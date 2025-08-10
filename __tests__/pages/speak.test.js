/** @jest-environment jsdom */
import { render, fireEvent } from '@testing-library/react';
import SpeechHelper from '../../pages/speak';

describe('Speak page', () => {
  it('updates URL when voice changes', () => {
    const { getByLabelText } = render(<SpeechHelper />);
    const select = getByLabelText(/voice/i);
    fireEvent.change(select, { target: { value: 'nova' } });
    expect(select.value).toBe('nova');
    expect(new URL(window.location.href).searchParams.get('voice')).toBe('nova');
  });
});
