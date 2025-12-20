"use client";

import React, { Component, type ReactNode } from "react";
import { Button } from "./button";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Fallback UI to show when error occurs. If not provided, default error UI is shown. */
  fallback?: ReactNode;
  /** Custom error handler called when error is caught */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /** Section name for display in error message */
  sectionName?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary component to catch JavaScript errors in child components.
 * Prevents entire page crashes by containing errors to specific sections.
 * 
 * Usage:
 * ```tsx
 * <ErrorBoundary sectionName="Photo Gallery">
 *   <PhotoGallery />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error to console in development
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    
    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Return custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
          <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-error"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold mb-2">
            {this.props.sectionName
              ? `Something went wrong loading ${this.props.sectionName}`
              : "Something went wrong"}
          </h3>
          <p className="text-text-muted text-sm mb-6 max-w-md">
            We encountered an unexpected error. Please try again.
          </p>
          <Button variant="outline-solid" size="md" onClick={this.handleRetry}>
            Try Again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Compact error fallback for smaller sections (cards, strips, etc.)
 */
export function CompactErrorFallback({ 
  message = "Failed to load",
  onRetry 
}: { 
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex items-center justify-center gap-3 py-8 px-4 text-center bg-bg-elevated rounded-lg border border-white/5">
      <svg
        className="w-5 h-5 text-error shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span className="text-text-muted text-sm">{message}</span>
      {onRetry && (
        <button 
          onClick={onRetry}
          className="text-accent hover:text-accent-light text-sm underline"
        >
          Retry
        </button>
      )}
    </div>
  );
}

