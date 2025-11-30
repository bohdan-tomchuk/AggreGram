# Task ID: 6

**Title:** Implement Posts Module with Feed and Search

**Status:** pending

**Dependencies:** 5

**Priority:** high

**Description:** Create posts endpoints with unified feed, filtering by date/topic, pagination, full-text search with PostgreSQL tsvector, and search result highlighting.

**Details:**

1. Create apps/api/src/modules/posts/dto/feed-query.dto.ts:
```typescript
import { IsOptional, IsUUID, IsDateString, IsInt, Min, Max, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class FeedQueryDto {
  @IsOptional()
  @IsUUID()
  channelId?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  topic?: string;

  @IsOptional()
  @IsIn(['date', 'views', 'forwards'])
  sort?: 'date' | 'views' | 'forwards';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
```

2. Create apps/api/src/modules/posts/dto/search-query.dto.ts:
```typescript
import { IsString, IsOptional, IsDateString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchQueryDto {
  @IsString()
  q: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  topic?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
```

3. Create apps/api/src/modules/posts/posts.service.ts:
```typescript
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
      qb.andWhere('post.channelId = :channelId', { channelId: query.channelId });
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
    const [posts, total] = await qb
      .skip(skip)
      .take(limit)
      .getManyAndCount();

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
    const searchTerm = query.q.replace(/[^\w\s]/g, ' ').trim().split(/\s+/).join(' & ');

    let qb = this.postsRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.channel', 'channel')
      .where('post.isDeleted = :isDeleted', { isDeleted: false })
      .andWhere('channel.isActive = :isActive', { isActive: true })
      .andWhere('post.search_vector @@ to_tsquery(:searchTerm)', { searchTerm });

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
      .addSelect(
        'ts_rank(post.search_vector, to_tsquery(:searchTerm))',
        'rank',
      )
      .addSelect(
        `ts_headline('english', post.text_content, to_tsquery(:searchTerm), 'MaxWords=50, MinWords=20, StartSel=<mark>, StopSel=</mark>')`,
        'highlight',
      )
      .orderBy('rank', 'DESC');

    const [posts, total] = await qb
      .skip(skip)
      .take(limit)
      .getManyAndCount();

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

  async getMediaUrl(id: string): Promise<{ mediaFileId: string; mediaType: string }> {
    const post = await this.findOne(id);
    if (!post.hasMedia || !post.mediaFileId) {
      throw new NotFoundException('Post has no media');
    }
    return {
      mediaFileId: post.mediaFileId,
      mediaType: post.mediaType || 'photo',
    };
  }
}
```

4. Create apps/api/src/modules/posts/posts.controller.ts:
```typescript
import { Controller, Get, Param, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { PostsService } from './posts.service';
import { FeedQueryDto } from './dto/feed-query.dto';
import { SearchQueryDto } from './dto/search-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('posts')
@UseGuards(JwtAuthGuard)
export class PostsController {
  constructor(private postsService: PostsService) {}

  @Get()
  async getFeed(@Query() query: FeedQueryDto) {
    return this.postsService.getFeed(query);
  }

  @Get('search')
  async search(@Query() query: SearchQueryDto) {
    return this.postsService.search(query);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.postsService.findOne(id);
  }

  @Get(':id/media')
  async getMedia(@Param('id', ParseUUIDPipe) id: string) {
    return this.postsService.getMediaUrl(id);
  }
}
```

5. Create apps/api/src/modules/posts/posts.module.ts:
```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Post } from '../../database/entities/post.entity';
import { Channel } from '../../database/entities/channel.entity';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Post, Channel]),
    AuthModule,
  ],
  providers: [PostsService],
  controllers: [PostsController],
  exports: [PostsService],
})
export class PostsModule {}
```

6. Update apps/api/src/app.module.ts to import new modules:
```typescript
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ChannelsModule } from './modules/channels/channels.module';
import { PostsModule } from './modules/posts/posts.module';

@Module({
  imports: [
    // ... existing imports
    AuthModule,
    UsersModule,
    ChannelsModule,
    PostsModule,
  ],
})
```

**Test Strategy:**

1. Unit tests for PostsService:
   - getFeed applies all filter combinations correctly
   - getFeed pagination works (page, limit, skip calculation)
   - search sanitizes query and uses tsvector
   - search ranking orders by relevance
   - findOne returns post with channel relation
   - getMediaUrl throws for posts without media
2. Integration tests for PostsController:
   - GET /posts returns paginated feed
   - GET /posts?topic=tech filters by topic
   - GET /posts?dateFrom=2025-01-01&dateTo=2025-01-31 filters by date range
   - GET /posts/search?q=election returns ranked results
   - GET /posts/search?q=climate&topic=news combines search with filters
   - GET /posts/:id returns single post
   - GET /posts/:id/media returns media file ID
3. Test full-text search:
   - Insert test posts with known content
   - Search for terms and verify results contain those terms
   - Verify highlights contain <mark> tags around matched terms
4. Performance test: search across 10,000 posts completes in <2s
5. E2E test: create posts -> search -> filter -> paginate

## Subtasks

### 6.1. Create Feed and Search Query DTOs with Validation

**Status:** pending  
**Dependencies:** None  

Implement FeedQueryDto and SearchQueryDto with comprehensive class-validator decorators for type safety, transformation, and input validation.

**Details:**

Create apps/api/src/modules/posts/dto/feed-query.dto.ts with optional filters (channelId, dateFrom, dateTo, topic, sort, order, page, limit) using @IsOptional, @IsUUID, @IsDateString, @IsIn, @Type transformers. Create apps/api/src/modules/posts/dto/search-query.dto.ts with required 'q' field and optional filters. Ensure proper validation decorators (@Min, @Max for pagination) and class-transformer @Type() for numeric fields.

### 6.2. Implement Feed Service with Dynamic QueryBuilder

**Status:** pending  
**Dependencies:** 6.1  

Build getFeed method in PostsService using TypeORM QueryBuilder with dynamic filtering by channelId, topic, date range, and sorting options.

**Details:**

Create PostsService in apps/api/src/modules/posts/posts.service.ts. Implement getFeed(query: FeedQueryDto) method that: 1) Creates QueryBuilder with leftJoinAndSelect for channel relation, 2) Applies base filters (isDeleted=false, isActive=true), 3) Conditionally adds WHERE clauses for channelId, topic, dateFrom, dateTo, 4) Implements dynamic sorting by date/views/forwards with asc/desc order, 5) Returns paginated results with metadata.

### 6.3. Add Search Query Sanitization for SQL Injection Prevention

**Status:** pending  
**Dependencies:** 6.1  

Implement robust search query sanitization that converts user input to safe PostgreSQL tsquery format by removing special characters and preventing injection attacks.

**Details:**

In PostsService.search() method, sanitize the search query: 1) Use regex to strip non-alphanumeric characters except whitespace: query.q.replace(/[^\w\s]/g, ' '), 2) Trim and split on whitespace, 3) Join terms with ' & ' operator for AND logic in tsquery, 4) Pass sanitized term to parameterized query to prevent SQL injection. Document the sanitization logic clearly.

### 6.4. Build Full-Text Search with PostgreSQL tsvector Queries

**Status:** pending  
**Dependencies:** 6.3  

Implement search method using PostgreSQL full-text search with tsvector column and to_tsquery for matching against sanitized search terms.

**Details:**

In PostsService.search(query: SearchQueryDto): 1) Create QueryBuilder with channel join and base filters, 2) Add WHERE clause using 'post.search_vector @@ to_tsquery(:searchTerm)' with sanitized searchTerm parameter, 3) Apply optional filters (topic, dateFrom, dateTo) same as feed, 4) Use parameterized queries for all user inputs to prevent injection, 5) Return posts that match the full-text search criteria.

### 6.5. Implement ts_rank for Search Relevance Scoring

**Status:** pending  
**Dependencies:** 6.4  

Add PostgreSQL ts_rank function to score search results by relevance and order results by rank in descending order.

**Details:**

In PostsService.search() QueryBuilder: 1) Use addSelect() to add 'ts_rank(post.search_vector, to_tsquery(:searchTerm))' as 'rank' column, 2) Add orderBy('rank', 'DESC') to sort by relevance score, 3) Ensure rank is calculated using same searchTerm as the WHERE clause, 4) Include rank in result mapping if needed for debugging or display.

### 6.6. Create ts_headline for Search Result Highlighting

**Status:** pending  
**Dependencies:** 6.4  

Implement PostgreSQL ts_headline to generate highlighted excerpts of matching text with <mark> tags around search terms.

**Details:**

In PostsService.search() QueryBuilder: 1) Use addSelect() to add ts_headline('english', post.text_content, to_tsquery(:searchTerm), 'MaxWords=50, MinWords=20, StartSel=<mark>, StopSel=</mark>') as 'highlight', 2) Map query results to include highlight field in response objects, 3) Configure headline options for readable excerpts (50 max words, 20 min words), 4) Use <mark> tags for frontend styling.

### 6.7. Implement Comprehensive Pagination Logic

**Status:** pending  
**Dependencies:** 6.2, 6.4  

Build pagination for both feed and search endpoints with page, limit, skip calculation, total count, and metadata response formatting.

**Details:**

For both getFeed() and search() methods: 1) Extract page (default 1) and limit (default 20) from query DTO, 2) Calculate skip = (page - 1) * limit, 3) Apply .skip(skip).take(limit) to QueryBuilder, 4) Use getManyAndCount() to get both results and total count, 5) Return response with data array and meta object containing { total, page, limit, totalPages: Math.ceil(total / limit) }, 6) For search, add query term to meta.

### 6.8. Create PostsController with All REST Endpoints

**Status:** pending  
**Dependencies:** 6.2, 6.4, 6.5, 6.6, 6.7  

Implement PostsController with GET /posts (feed), GET /posts/search, GET /posts/:id, and GET /posts/:id/media endpoints protected by JWT authentication.

**Details:**

Create apps/api/src/modules/posts/posts.controller.ts with: 1) @Controller('posts') and @UseGuards(JwtAuthGuard), 2) GET / endpoint using @Query() FeedQueryDto, 3) GET /search endpoint using @Query() SearchQueryDto, 4) GET /:id endpoint with @Param('id', ParseUUIDPipe), 5) GET /:id/media endpoint, 6) Implement findOne() and getMediaUrl() methods in service. Create PostsModule importing TypeOrmModule, AuthModule, and exporting PostsService.

### 6.9. Write Performance Tests for Large Dataset Search

**Status:** pending  
**Dependencies:** 6.8  

Create performance and load tests to validate search and feed performance with large datasets (10k+ posts), measure query execution time, and identify optimization opportunities.

**Details:**

Create performance test suite: 1) Seed test database with 10k-50k posts across multiple channels, 2) Test search query performance with various term combinations, 3) Measure ts_rank and ts_headline overhead, 4) Test pagination performance at different offsets, 5) Test feed with multiple filter combinations, 6) Verify query execution time <500ms for typical queries, 7) Use EXPLAIN ANALYZE to identify missing indexes, 8) Document performance benchmarks and recommendations.
