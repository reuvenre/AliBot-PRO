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
