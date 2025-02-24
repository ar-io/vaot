import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import React, { ReactNode } from 'react';

export function ResizablePanels({
  children,
  showHandle = true,
  direction = 'horizontal',
  className,
  size,
}: {
  children: ReactNode[];
  showHandle?: boolean;
  direction?: 'horizontal' | 'vertical';
  className?: string;
  size?: (index: number) => number;
}) {
  return (
    <ResizablePanelGroup direction={direction} className={className}>
      {children.map((child, index) => (
        <React.Fragment key={index}>
          <ResizablePanel defaultSize={size?.(index) ?? 50}>
            {child}
          </ResizablePanel>
          {showHandle && index < children.length - 1 && (
            <ResizableHandle withHandle={showHandle} />
          )}
        </React.Fragment>
      ))}
    </ResizablePanelGroup>
  );
}
