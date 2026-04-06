"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-8 w-40 rounded-md bg-muted" />
        <div className="h-4 w-56 rounded-md bg-muted" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="p-5">
              <div className="space-y-3">
                <div className="h-4 w-24 rounded-md bg-muted" />
                <div className="h-8 w-20 rounded-md bg-muted" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <Card key={index}>
            <CardHeader>
              <div className="h-5 w-36 rounded-md bg-muted" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 5 }).map((__, line) => (
                <div key={line} className="h-8 rounded-md bg-muted" />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
