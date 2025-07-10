import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ErrorBoundary from '../components/ErrorBoundary';

// A component that throws an error for testing purposes
const ErrorComponent = ({ shouldThrow }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>Component loaded successfully</div>;
};

describe('ErrorBoundary', () => {
  beforeAll(() => {
    // Suppress console.error for the error boundary test
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    // Restore console.error
    console.error.mockRestore();
  });

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div>Child component</div>
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Child component')).toBeInTheDocument();
  });

  it('displays error message when child component throws', () => {
    render(
      <ErrorBoundary>
        <ErrorComponent shouldThrow={true} />
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Test error')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('calls onRetry and resets error state when retry button is clicked', () => {
    const handleRetry = jest.fn();
    
    const { rerender } = render(
      <ErrorBoundary onRetry={handleRetry}>
        <ErrorComponent shouldThrow={true} />
      </ErrorBoundary>
    );
    
    // Click the retry button
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    
    // Verify onRetry was called
    expect(handleRetry).toHaveBeenCalledTimes(1);
    
    // Re-render with no error to test error state reset
    rerender(
      <ErrorBoundary onRetry={handleRetry}>
        <ErrorComponent shouldThrow={false} />
      </ErrorBoundary>
    );
    
    // Should now show the child component
    expect(screen.getByText('Component loaded successfully')).toBeInTheDocument();
  });

  it('displays default error message when error has no message', () => {
    // Mock console.error to prevent logging the error
    const originalError = console.error;
    console.error = jest.fn();
    
    // Create a component that throws an error without a message
    const ComponentWithUndefinedError = () => {
      throw {}; // Throw an empty object
    };
    
    render(
      <ErrorBoundary>
        <ComponentWithUndefinedError />
      </ErrorBoundary>
    );
    
    expect(screen.getByText('An unexpected error occurred')).toBeInTheDocument();
    
    // Restore console.error
    console.error = originalError;
  });
});
