function Page({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`
  ${className} size-full`}
    >
      {children}
    </div>
  );
}

export default Page;
