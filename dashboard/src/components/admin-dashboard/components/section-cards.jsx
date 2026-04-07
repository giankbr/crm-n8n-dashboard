import { IconTrendingDown, IconTrendingUp } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card";

export function SectionCards({ stats }) {
  return (
    <div
      className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Total Threads</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {stats.totalThreads}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconTrendingUp />
              live
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Thread aktif dan historis <IconTrendingUp className="size-4" />
          </div>
          <div className="text-muted-foreground">Masuk dari webhook WAHA</div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Today Bookings</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {stats.todayBookings}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconTrendingDown />
              today
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Booking perlu ditindak <IconTrendingDown className="size-4" />
          </div>
          <div className="text-muted-foreground">Follow-up scheduler dan CS</div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Open Escalations</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {stats.openEscalations}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconTrendingUp />
              open
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Kasus perlu intervensi manusia <IconTrendingUp className="size-4" />
          </div>
          <div className="text-muted-foreground">Komplain, out-of-knowledge, routing</div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>WAHA Sessions</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {stats.wahaSessions}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconTrendingUp />
              ready
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Session WhatsApp siap pakai <IconTrendingUp className="size-4" />
          </div>
          <div className="text-muted-foreground">Buat/start/scan QR dari dashboard</div>
        </CardFooter>
      </Card>
    </div>
  );
}
