import { ReactNode } from 'react';

function Sidebar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col gap-2 px-[1rem] py-1 h-full overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 ${className ?? ''}`}
    >
      {children}
    </div>
  );
}

export default Sidebar;
