'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { campaignsApi } from '@/lib/api-client';
import { CampaignForm } from '@/components/campaigns/CampaignForm';
import type { CampaignInput } from '@/types';

export default function EditCampaignPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [initial, setInitial] = useState<CampaignInput | null>(null);

  useEffect(() => {
    campaignsApi.get(id)
      .then((c) => setInitial({
        name: c.name,
        source: c.source ?? 'aliexpress',
        target_channels: c.target_channels ?? [],
        keywords: c.keywords ?? [],
        schedule_cron: c.schedule_cron,
        posts_per_run: c.posts_per_run,
        language: c.language,
        target_platforms: c.target_platforms ?? [],
        currency_pair: c.currency_pair,
        window_start_hour: c.window_start_hour,
        window_end_hour: c.window_end_hour,
        window_tz: c.window_tz,
        markup_percent: c.markup_percent,
        min_price: c.min_price,
        max_price: c.max_price,
        min_discount: c.min_discount,
        min_rating: c.min_rating,
        post_template: c.post_template,
        // Every field the form can EDIT has to be hydrated here, or the control renders at
        // its empty default and the owner reads a saved setting as lost. These two toggles
        // were added to the form without being added to this list, so a campaign with them
        // on always reopened showing them off — the value was in the database the whole time.
        seasonal_keywords: c.seasonal_keywords,
        learn_from_orders: c.learn_from_orders,
      }))
      .catch(() => router.push('/campaigns'));
  }, [id, router]);

  if (!initial) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 size={24} className="animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <CampaignForm
      mode="edit"
      initial={initial}
      onSubmit={(data) => campaignsApi.update(id, data)}
    />
  );
}
