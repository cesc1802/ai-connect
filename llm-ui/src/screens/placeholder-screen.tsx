import { PageHeader } from "@/components/ui/page-header";
import { Icon } from "@/lib/icons";

type Props = {
  title: string;
  description: string;
};

export function PlaceholderScreen({ title, description }: Props) {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <PageHeader title={title} description={description} />
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-card py-20 text-center">
        <Icon name="sparkles" className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">Đang chuẩn bị</p>
        <p className="max-w-sm text-sm text-muted-foreground">Màn hình này sẽ được hoàn thiện trong pha tiếp theo của lộ trình.</p>
      </div>
    </div>
  );
}
