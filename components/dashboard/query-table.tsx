"use client";

import React, { useState } from "react";
import { Search, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { TopQuery } from "./dashboard-data";

interface QueryTableProps {
  keywords: TopQuery[];
}

export function QueryTable({ keywords }: QueryTableProps) {
  const [search, setSearch] = useState("");
  const filteredKeywords = keywords.filter((item) => item.keyword.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <section className="bg-surface rounded-xl border border-default overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-default flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-serif text-lg font-medium">Top Performing Entities & Queries</h3>
          <p className="text-xs text-text-muted">Demo keywords: search volume, rank changes, and clicks for the selected period</p>
        </div>
        <div className="relative flex-1 sm:flex-initial">
          <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden="true" />
          <Input
            type="search"
            aria-label="Search keywords"
            placeholder="Filter keywords..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="text-xs pl-8 pr-3 py-1.5 w-full sm:w-48 h-8"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <caption className="sr-only">Keyword performance for the selected client and date range</caption>
          <thead className="bg-surface border-b border-default text-text-muted font-medium font-mono text-[11px]">
            <tr>
              <th scope="col" className="py-3 px-4 sm:px-5">Keyword</th>
              <th scope="col" className="py-3 px-3 sm:px-4">Clicks</th>
              <th scope="col" className="py-3 px-3 sm:px-4">Search Volume</th>
              <th scope="col" className="py-3 px-3 sm:px-4">Rank</th>
              <th scope="col" className="py-3 px-3 sm:px-4">Position Change</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-default">
            {filteredKeywords.map((item) => (
              <tr key={item.keyword} className="hover:bg-secondary/30 transition-colors">
                <td className="py-3 px-4 sm:px-5 font-medium text-text-primary">
                  <span className="block min-w-40">{item.keyword}</span>
                </td>
                <td className="py-3 px-3 sm:px-4 font-mono">{item.clicks.toLocaleString("en-US")}</td>
                <td className="py-3 px-3 sm:px-4 font-mono text-text-muted">{item.volume.toLocaleString("en-US")}</td>
                <td className="py-3 px-3 sm:px-4 font-mono font-medium">#{item.rank}</td>
                <td className="py-3 px-3 sm:px-4">
                  {item.change > 0 ? (
                    <span className="inline-flex items-center text-state-success font-mono font-medium gap-0.5">
                      <ArrowUpRight className="size-3" aria-hidden="true" /> {item.change} gained
                    </span>
                  ) : item.change < 0 ? (
                    <span className="inline-flex items-center text-state-error font-mono font-medium gap-0.5">
                      <ArrowDownRight className="size-3" aria-hidden="true" /> {Math.abs(item.change)} lost
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-text-muted font-mono">Unchanged</span>
                  )}
                </td>
              </tr>
            ))}
            {filteredKeywords.length === 0 && (
              <tr>
                <td colSpan={5} className="p-5 text-center text-text-muted">No keywords match your search.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
