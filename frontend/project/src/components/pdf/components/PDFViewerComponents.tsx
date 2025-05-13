export const LoadingComponent = () => (
  <div className="flex items-center justify-center h-full">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
  </div>
);

export const ErrorComponent = ({ error }: { error: string }) => (
  <div className="flex items-center justify-center h-full">
    <div className="text-red-500">{error}</div>
  </div>
); 