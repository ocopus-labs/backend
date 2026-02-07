import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { SearchService } from './search.service';

@Controller('business/:businessId/search')
@UsePipes(new ValidationPipe({ transform: true }))
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  async search(
    @Param('businessId') businessId: string,
    @Query('q') query: string,
    @Query('types') types?: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 5,
  ) {
    if (!query || query.length < 2) {
      return { query: '', results: [], totalCount: 0 };
    }
    return this.searchService.globalSearch(
      businessId,
      query,
      types?.split(','),
      Math.min(limit, 10),
    );
  }
}
