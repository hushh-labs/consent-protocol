import { Spinner } from "@/components/ui/spinner";

export default function Loading() {
  return (
    <div className="flex h-screen w-full items-center justify-center">
      <Spinner size={32} />
    </div>
  );
}
