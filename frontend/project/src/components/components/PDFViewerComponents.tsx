export const LoadingComponent = () => (
  <div className="flex items-center justify-center p-4">
    <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
  </div>
);

export const ErrorComponent = ({ error }: { error: string }) => (
  <div className="flex items-center justify-center p-4 text-red-500">
    <p>{error}</p>
  </div>
); 