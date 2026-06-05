import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { ToolCallCard } from '@/components/chat/tool-call-card';

describe('ToolCallCard', () => {
  it('renders tool name in mono font', () => {
    render(<ToolCallCard toolName="search_docs" />);
    const name = screen.getByText('search_docs');
    expect(name).toBeInTheDocument();
    expect(name.className).toMatch(/font-mono/);
  });

  it('renders args and result as JSON when payloads provided', () => {
    render(
      <ToolCallCard
        toolName="lookup"
        args={{ query: 'hello' }}
        result={{ count: 2 }}
      />,
    );
    expect(screen.getByText('Tham số')).toBeInTheDocument();
    expect(screen.getByText('Kết quả')).toBeInTheDocument();
    expect(screen.getByText(/"query": "hello"/)).toBeInTheDocument();
    expect(screen.getByText(/"count": 2/)).toBeInTheDocument();
  });

  it('omits args/result sections when payloads are empty', () => {
    render(<ToolCallCard toolName="ping" />);
    expect(screen.queryByText('Tham số')).toBeNull();
    expect(screen.queryByText('Kết quả')).toBeNull();
  });

  it('shows wobble indicator and running label when active', () => {
    const { container } = render(
      <ToolCallCard toolName="grep" active />,
    );
    expect(screen.getByText('Đang chạy')).toBeInTheDocument();
    const wobbler = container.querySelector('.animate-wobble');
    expect(wobbler).not.toBeNull();
  });

  it('renders string args as raw text without JSON encoding', () => {
    render(<ToolCallCard toolName="echo" args="just a string" />);
    expect(screen.getByText('just a string')).toBeInTheDocument();
  });
});
