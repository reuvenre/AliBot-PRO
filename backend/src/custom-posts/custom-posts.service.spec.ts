import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CustomPostsService } from './custom-posts.service';
import { CustomPost } from './custom-post.entity';
import { PostsService } from '../posts/posts.service';

/**
 * The real incident behind these tests: the owner pulled a coupon-sequence post forward as a
 * test, it dispatched (one-off → disabled), then he edited the time back to the original date
 * expecting it to fire there — and the edit silently re-armed a DISABLED post.
 */
describe('CustomPostsService.update — re-arming a fired one-off', () => {
  let service: CustomPostsService;
  let row: Partial<CustomPost>;

  beforeEach(async () => {
    row = {};
    const module = await Test.createTestingModule({
      providers: [
        CustomPostsService,
        {
          provide: getRepositoryToken(CustomPost),
          useValue: {
            findOne: jest.fn(async () => row),
            save: jest.fn(async (cp: CustomPost) => cp),
          },
        },
        { provide: PostsService, useValue: {} },
      ],
    }).compile();
    service = module.get(CustomPostsService);
  });

  it('re-enables a one-off that already fired when its send time is edited', async () => {
    // Post-dispatch state of a one-off: disabled, cursor cleared.
    Object.assign(row, {
      id: 'cp1', user_id: 'u1', repeat: 'none',
      enabled: false, next_send_at: null, sent_count: 1,
    });
    const out = await service.update('u1', 'cp1', { send_at: '2026-08-21T09:00:00.000Z' });
    expect(out.enabled).toBe(true);
    expect(out.next_send_at?.toISOString()).toBe('2026-08-21T09:00:00.000Z');
  });

  it('keeps a user-PAUSED post paused through a time edit — pausing was a choice', async () => {
    // A paused post still holds its cursor; only dispatch clears it.
    Object.assign(row, {
      id: 'cp2', user_id: 'u1', repeat: 'none',
      enabled: false, next_send_at: new Date('2026-08-20T10:00:00.000Z'),
    });
    const out = await service.update('u1', 'cp2', { send_at: '2026-08-22T10:00:00.000Z' });
    expect(out.enabled).toBe(false);
    expect(out.next_send_at?.toISOString()).toBe('2026-08-22T10:00:00.000Z');
  });

  it('respects an explicit enabled:false sent alongside the new time', async () => {
    Object.assign(row, {
      id: 'cp3', user_id: 'u1', repeat: 'none',
      enabled: false, next_send_at: null, sent_count: 1,
    });
    const out = await service.update('u1', 'cp3', { send_at: '2026-08-21T09:00:00.000Z', enabled: false });
    expect(out.enabled).toBe(false);
  });
});

/**
 * A hand-written post used to publish with an empty `affiliate_url`, which is the field the
 * publish path turns into a tracked /r/<code>. So it went out fine and then counted for
 * nothing — no clicks, nothing for the learning brain, on exactly the posts the owner writes
 * himself for a holiday push.
 */
describe('CustomPostsService.dispatchDue — the body\'s link is the post\'s link', () => {
  const dispatch = async (body: string) => {
    const row: any = {
      id: 'cp1', user_id: 'u1', body, repeat: 'none',
      enabled: true, next_send_at: new Date('2020-01-01T00:00:00.000Z'),
      target_channels: ['-100123'], image_urls: [],
    };
    const createQueuedPost = jest.fn(async (..._args: any[]) => ({}));
    const module = await Test.createTestingModule({
      providers: [
        CustomPostsService,
        {
          provide: getRepositoryToken(CustomPost),
          useValue: { find: jest.fn(async () => [row]), save: jest.fn(async (cp: any) => cp) },
        },
        {
          provide: PostsService,
          useValue: {
            nextGroupSlot: jest.fn(async () => ({ slot: new Date() })),
            createQueuedPost,
          },
        },
      ],
    }).compile();
    await module.get(CustomPostsService).dispatchDue();
    return createQueuedPost.mock.calls[0]?.[1] as any;
  };

  it('carries the promo link through as the post\'s destination', async () => {
    const product = await dispatch('🍎 שנה טובה\n\nhttps://s.click.aliexpress.com/e/_c3WHSgdt');
    expect(product.affiliate_url).toBe('https://s.click.aliexpress.com/e/_c3WHSgdt');
  });

  it('publishes a link-less announcement exactly as before', async () => {
    const product = await dispatch('הקבוצה יוצאת לחופשה עד אחרי החג 🍎');
    expect(product.affiliate_url).toBe('');
  });
});
