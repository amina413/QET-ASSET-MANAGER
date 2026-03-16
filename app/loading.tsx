export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4" />
      <p className="text-slate-600 font-medium">Loading ABDC Asset Manager...</p>
      <p className="text-slate-400 text-sm mt-1">Please wait</p>
    </div>
  );
}
