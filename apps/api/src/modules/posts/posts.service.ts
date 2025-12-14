import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from '../../database/entities/post.entity';
import { Channel } from '../../database/entities/channel.entity';
import { FeedQueryDto } from './dto/feed-query.dto';
import { SearchQueryDto } from './dto/search-query.dto';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private postsRepository: Repository<Post>,
    @InjectRepository(Channel)
    private channelsRepository: Repository<Channel>,
  ) {}

  async getFeed(query: FeedQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;
    const sort = query.sort || 'date';
    const order = query.order || 'desc';

    const qb = this.postsRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.channel', 'channel')
      .where('post.isDeleted = :isDeleted', { isDeleted: false })
      .andWhere('channel.isActive = :isActive', { isActive: true });

    // Apply filters
    if (query.channelId) {
      qb.andWhere('post.channelId = :channelId', {
        channelId: query.channelId,
      });
    }

    if (query.topic) {
      qb.andWhere('channel.topic = :topic', { topic: query.topic });
    }

    if (query.dateFrom) {
      qb.andWhere('post.postedAt >= :dateFrom', { dateFrom: query.dateFrom });
    }

    if (query.dateTo) {
      qb.andWhere('post.postedAt <= :dateTo', { dateTo: query.dateTo });
    }

    // Apply sorting
    const sortField = sort === 'date' ? 'post.postedAt' : `post.${sort}`;
    qb.orderBy(sortField, order.toUpperCase() as 'ASC' | 'DESC');

    // Get total count and results
    const [posts, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return {
      data: posts,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async search(query: SearchQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    // Sanitize search query for PostgreSQL
    const searchTerm = query.q
      .replace(/[^\w\s]/g, ' ')
      .trim()
      .split(/\s+/)
      .join(' & ');

    let qb = this.postsRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.channel', 'channel')
      .where('post.isDeleted = :isDeleted', { isDeleted: false })
      .andWhere('channel.isActive = :isActive', { isActive: true })
      .andWhere('post.search_vector @@ to_tsquery(:searchTerm)', {
        searchTerm,
      });

    // Apply additional filters
    if (query.topic) {
      qb.andWhere('channel.topic = :topic', { topic: query.topic });
    }

    if (query.dateFrom) {
      qb.andWhere('post.postedAt >= :dateFrom', { dateFrom: query.dateFrom });
    }

    if (query.dateTo) {
      qb.andWhere('post.postedAt <= :dateTo', { dateTo: query.dateTo });
    }

    // Add ranking and highlighting
    qb = qb
      .addSelect('ts_rank(post.search_vector, to_tsquery(:searchTerm))', 'rank')
      .addSelect(
        `ts_headline('english', post.text_content, to_tsquery(:searchTerm), 'MaxWords=50, MinWords=20, StartSel=<mark>, StopSel=</mark>')`,
        'highlight',
      )
      .orderBy('rank', 'DESC');

    const [posts, total] = await qb.skip(skip).take(limit).getManyAndCount();

    // Map results to include highlights
    const results = posts.map((post: any) => ({
      ...post,
      highlight: post.highlight,
    }));

    return {
      data: results,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        query: query.q,
      },
    };
  }

  async findOne(id: string): Promise<Post> {
    const post = await this.postsRepository.findOne({
      where: { id },
      relations: ['channel'],
    });
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }
}
