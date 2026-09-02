import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AddEventMediaSchema,
  ReorderEventMediaSchema,
  UpdateEventMediaSchema,
  parseVideoUrl,
  embedUrlFor,
} from '@ekklesia/shared';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditLogService } from '../../common/audit-log.service.js';

/** Enough for a gallery; past this a page becomes a scroll, not a showcase. */
const MAX_ITEMS = 30;

export interface MediaView {
  id: string;
  kind: 'IMAGE' | 'VIDEO';
  url: string;
  thumbnailUrl: string | null;
  caption: string | null;
  position: number;
  /** Present for video only — built from provider + id, never stored. */
  embedUrl?: string;
}

@Injectable()
export class EventMediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  /**
   * The gallery, in order.
   *
   * `embedUrl` is rebuilt from the stored provider and id on every read rather
   * than persisted. A stored URL would be a string we hand to an iframe having
   * validated it once, months ago; rebuilding means the check happens now,
   * against the current rules.
   */
  async list(eventId: string): Promise<MediaView[]> {
    const rows = await this.prisma.eventMedia.findMany({
      where: { eventId },
      orderBy: { position: 'asc' },
    });

    return rows.map((m) => {
      const view: MediaView = {
        id: m.id,
        kind: m.kind,
        url: m.url,
        thumbnailUrl: m.thumbnailUrl,
        caption: m.caption,
        position: m.position,
      };
      if (m.kind === 'VIDEO' && m.provider && m.providerId) {
        const embed = embedUrlFor(m.provider, m.providerId);
        if (embed) view.embedUrl = embed;
      }
      return view;
    });
  }

  async add(eventId: string, actorUserId: string, body: unknown): Promise<MediaView> {
    const input = AddEventMediaSchema.parse(body);

    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, organizationId: true, coverImageUrl: true },
    });
    if (!event) throw new NotFoundException('Event not found');

    const count = await this.prisma.eventMedia.count({ where: { eventId } });
    if (count >= MAX_ITEMS) {
      throw new BadRequestException(`An event can have at most ${MAX_ITEMS} gallery items`);
    }

    let data: {
      kind: 'IMAGE' | 'VIDEO';
      url: string;
      thumbnailUrl: string | null;
      provider: string | null;
      providerId: string | null;
    };

    if (input.kind === 'VIDEO') {
      const parsed = parseVideoUrl(input.url);
      // Rejected rather than stored as-is: an unrecognised link would render as
      // a broken player later, with nothing to tell the host why.
      if (!parsed) {
        throw new BadRequestException(
          'That link is not a YouTube or Vimeo video we recognise. Paste the address from the video page.',
        );
      }
      data = {
        kind: 'VIDEO',
        url: parsed.url,
        thumbnailUrl: parsed.thumbnailUrl,
        provider: parsed.provider,
        providerId: parsed.providerId,
      };
    } else {
      data = {
        kind: 'IMAGE',
        url: input.url,
        thumbnailUrl: null,
        provider: null,
        providerId: null,
      };
    }

    // Appended, not inserted. Position is only meaningful relative to siblings,
    // and reorder rewrites the whole set anyway.
    const created = await this.prisma.eventMedia.create({
      data: { eventId, caption: input.caption ?? null, position: count, ...data },
    });

    // The first image an event ever gets becomes its cover, because an event
    // with a gallery and no card image looks broken everywhere else in the app.
    if (data.kind === 'IMAGE' && !event.coverImageUrl) {
      await this.prisma.event.update({
        where: { id: eventId },
        data: { coverImageUrl: data.url },
      });
    }

    await this.audit.write({
      actorUserId,
      organizationId: event.organizationId,
      action: 'event.media.add',
      targetType: 'event',
      targetId: eventId,
    });

    return (await this.list(eventId)).find((m) => m.id === created.id)!;
  }

  async update(eventId: string, mediaId: string, body: unknown): Promise<MediaView> {
    const input = UpdateEventMediaSchema.parse(body);
    // Scoped to the event so a media id from another event cannot be edited by
    // someone who happens to have rights on this one.
    const existing = await this.prisma.eventMedia.findFirst({
      where: { id: mediaId, eventId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Media not found');

    await this.prisma.eventMedia.update({
      where: { id: mediaId },
      data: { caption: input.caption ?? null },
    });
    return (await this.list(eventId)).find((m) => m.id === mediaId)!;
  }

  async remove(eventId: string, mediaId: string, actorUserId: string): Promise<void> {
    const media = await this.prisma.eventMedia.findFirst({
      where: { id: mediaId, eventId },
      select: { id: true, url: true, kind: true, event: { select: { organizationId: true, coverImageUrl: true } } },
    });
    if (!media) throw new NotFoundException('Media not found');

    await this.prisma.eventMedia.delete({ where: { id: mediaId } });

    // Removing the item that happened to be the cover would otherwise leave the
    // event pointing at a file nobody can see any more.
    if (media.kind === 'IMAGE' && media.event.coverImageUrl === media.url) {
      const next = await this.prisma.eventMedia.findFirst({
        where: { eventId, kind: 'IMAGE' },
        orderBy: { position: 'asc' },
        select: { url: true },
      });
      await this.prisma.event.update({
        where: { id: eventId },
        data: { coverImageUrl: next?.url ?? null },
      });
    }

    // Close the gap so positions stay 0..n-1 and a later reorder has no holes.
    const rest = await this.prisma.eventMedia.findMany({
      where: { eventId },
      orderBy: { position: 'asc' },
      select: { id: true },
    });
    await this.prisma.$transaction(
      rest.map((m, i) =>
        this.prisma.eventMedia.update({ where: { id: m.id }, data: { position: i } }),
      ),
    );

    await this.audit.write({
      actorUserId,
      organizationId: media.event.organizationId,
      action: 'event.media.remove',
      targetType: 'event',
      targetId: eventId,
    });
  }

  /**
   * Apply a new order.
   *
   * Takes the complete list rather than a moved id and a destination: the client
   * already knows the order it is showing, and sending it whole means a dropped
   * request leaves the gallery as it was rather than half-shuffled.
   */
  async reorder(eventId: string, body: unknown): Promise<MediaView[]> {
    const { ids } = ReorderEventMediaSchema.parse(body);

    const owned = await this.prisma.eventMedia.findMany({
      where: { eventId },
      select: { id: true },
    });
    const ownedIds = new Set(owned.map((m) => m.id));

    if (ids.length !== ownedIds.size || ids.some((id) => !ownedIds.has(id))) {
      throw new BadRequestException(
        'The order must list every item in this gallery exactly once',
      );
    }
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('The order contains a duplicate');
    }

    await this.prisma.$transaction(
      ids.map((id, i) =>
        this.prisma.eventMedia.update({ where: { id }, data: { position: i } }),
      ),
    );
    return this.list(eventId);
  }

  /** Promote one gallery image to the event's cover. */
  async setCover(eventId: string, mediaId: string): Promise<{ coverImageUrl: string }> {
    const media = await this.prisma.eventMedia.findFirst({
      where: { id: mediaId, eventId, kind: 'IMAGE' },
      select: { url: true },
    });
    if (!media) throw new NotFoundException('Image not found in this gallery');

    await this.prisma.event.update({
      where: { id: eventId },
      data: { coverImageUrl: media.url },
    });
    return { coverImageUrl: media.url };
  }
}
